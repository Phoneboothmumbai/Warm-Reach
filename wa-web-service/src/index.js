/**
 * WhatsApp Web Microservice using Baileys
 * 
 * This service handles:
 * - QR code generation for WhatsApp Web login
 * - Session management (connect, disconnect, reconnect)
 * - Message sending via WhatsApp Web
 * - Message receiving and forwarding to FastAPI backend
 * 
 * WARNING: WhatsApp Web automation is against WhatsApp ToS and carries ban risk.
 */

import express from 'express';
import cors from 'cors';
import { createClient } from 'redis';
import pkg from '@whiskeysockets/baileys';
const { 
  default: makeWASocket, 
  DisconnectReason, 
  useMultiFileAuthState,
  makeInMemoryStore,
  fetchLatestBaileysVersion
} = pkg;
import pino from 'pino';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8001';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const RATE_LIMIT_HOUR = parseInt(process.env.WA_WEB_RATE_LIMIT_HOUR) || 20;

// Logger
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Redis client for session storage
let redisClient;

// Active WhatsApp sessions (tenantId -> socket)
const activeSessions = new Map();
const sessionStores = new Map();

// Rate limiting tracker (tenantId -> { count, resetTime })
const rateLimits = new Map();

// Initialize Redis
async function initRedis() {
  try {
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => logger.error('Redis error:', err));
    await redisClient.connect();
    logger.info('Connected to Redis');
    return true;
  } catch (error) {
    logger.warn('Redis connection failed, using in-memory storage:', error.message);
    return false;
  }
}

// Session state storage functions
async function saveSessionState(tenantId, state) {
  const key = `wa_web_session:${tenantId}`;
  if (redisClient?.isOpen) {
    await redisClient.set(key, JSON.stringify(state), { EX: 86400 }); // 24 hour expiry
  }
}

async function getSessionState(tenantId) {
  const key = `wa_web_session:${tenantId}`;
  if (redisClient?.isOpen) {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  }
  return null;
}

async function deleteSessionState(tenantId) {
  const key = `wa_web_session:${tenantId}`;
  if (redisClient?.isOpen) {
    await redisClient.del(key);
  }
}

// Rate limiting check
function checkRateLimit(tenantId) {
  const now = Date.now();
  let limit = rateLimits.get(tenantId);
  
  if (!limit || now > limit.resetTime) {
    // Reset rate limit
    limit = { count: 0, resetTime: now + 3600000 }; // 1 hour window
    rateLimits.set(tenantId, limit);
  }
  
  if (limit.count >= RATE_LIMIT_HOUR) {
    return { allowed: false, remaining: 0, resetIn: Math.ceil((limit.resetTime - now) / 60000) };
  }
  
  limit.count++;
  return { allowed: true, remaining: RATE_LIMIT_HOUR - limit.count, resetIn: 0 };
}

// Create WhatsApp connection for a tenant
async function createConnection(tenantId) {
  try {
    // Create session directory
    const sessionDir = path.join('/tmp', 'wa-sessions', tenantId);
    fs.mkdirSync(sessionDir, { recursive: true });
    
    // Get Baileys auth state
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    
    // Create in-memory store for messages
    const store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });
    sessionStores.set(tenantId, store);
    
    // Get latest Baileys version
    const { version } = await fetchLatestBaileysVersion();
    
    // Create socket connection
    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['WarmReach', 'Chrome', '120.0.0'],
      connectTimeoutMs: 60000,
      qrTimeout: 60000,
      defaultQueryTimeoutMs: 60000
    });
    
    store.bind(sock.ev);
    
    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        // Generate QR code as data URL
        const qrDataUrl = await QRCode.toDataURL(qr);
        
        // Save QR to session state
        await saveSessionState(tenantId, {
          status: 'qr_pending',
          qr_code: qrDataUrl,
          updated_at: new Date().toISOString()
        });
        
        logger.info(`QR code generated for tenant ${tenantId}`);
        
        // Notify backend
        notifyBackend(tenantId, 'qr_generated', { qr_code: qrDataUrl });
      }
      
      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = reason !== DisconnectReason.loggedOut;
        
        logger.info(`Connection closed for ${tenantId}, reason: ${reason}, reconnect: ${shouldReconnect}`);
        
        await saveSessionState(tenantId, {
          status: reason === DisconnectReason.loggedOut ? 'disconnected' : 'expired',
          updated_at: new Date().toISOString()
        });
        
        activeSessions.delete(tenantId);
        
        // Notify backend
        notifyBackend(tenantId, 'disconnected', { reason });
        
        // Attempt reconnection if not logged out
        if (shouldReconnect) {
          setTimeout(() => {
            logger.info(`Attempting reconnection for ${tenantId}`);
            createConnection(tenantId);
          }, 5000);
        }
      }
      
      if (connection === 'open') {
        const phoneNumber = sock.user?.id?.split(':')[0] || 'unknown';
        
        await saveSessionState(tenantId, {
          status: 'connected',
          phone_number: phoneNumber,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
        activeSessions.set(tenantId, sock);
        
        logger.info(`Connected to WhatsApp for tenant ${tenantId}, phone: ${phoneNumber}`);
        
        // Notify backend
        notifyBackend(tenantId, 'connected', { phone_number: phoneNumber });
      }
    });
    
    // Handle credential updates
    sock.ev.on('creds.update', saveCreds);
    
    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      
      for (const msg of messages) {
        if (msg.key.fromMe) continue; // Skip outgoing messages
        
        const from = msg.key.remoteJid?.replace('@s.whatsapp.net', '');
        const content = msg.message?.conversation || 
                       msg.message?.extendedTextMessage?.text ||
                       `[${Object.keys(msg.message || {})[0] || 'unknown'} message]`;
        
        logger.info(`Incoming message for ${tenantId} from ${from}`);
        
        // Forward to backend
        notifyBackend(tenantId, 'message_received', {
          from,
          content,
          message_id: msg.key.id,
          timestamp: msg.messageTimestamp
        });
      }
    });
    
    // Handle message status updates
    sock.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        if (update.update?.status) {
          const statusMap = {
            2: 'sent',
            3: 'delivered',
            4: 'read'
          };
          
          notifyBackend(tenantId, 'message_status', {
            message_id: update.key.id,
            status: statusMap[update.update.status] || 'unknown'
          });
        }
      }
    });
    
    return sock;
    
  } catch (error) {
    logger.error(`Error creating connection for ${tenantId}: ${error.message}`);
    logger.error(error.stack);
    throw error;
  }
}

// Notify backend of events
async function notifyBackend(tenantId, event, data) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/wa/web/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tenantId,
        event,
        data,
        timestamp: new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      logger.warn(`Backend notification failed: ${response.status}`);
    }
  } catch (error) {
    logger.error('Failed to notify backend:', error.message);
  }
}

// ========================
// API ENDPOINTS
// ========================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    redis: redisClient?.isOpen ? 'connected' : 'disconnected',
    active_sessions: activeSessions.size
  });
});

// Get session status
app.get('/session/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const state = await getSessionState(tenantId);
    
    if (!state) {
      return res.json({
        status: 'disconnected',
        phone_number: null,
        qr_code: null
      });
    }
    
    res.json(state);
  } catch (error) {
    logger.error('Error getting session:', error);
    res.status(500).json({ error: 'Failed to get session status' });
  }
});

// Start QR login
app.post('/session/:tenantId/start', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { risk_accepted } = req.body;
    
    if (!risk_accepted) {
      return res.status(400).json({ 
        error: 'Risk acceptance required',
        message: 'WhatsApp Web automation carries account ban risk. Please accept the risk before proceeding.'
      });
    }
    
    // Check if already connected
    if (activeSessions.has(tenantId)) {
      return res.status(400).json({ error: 'Session already active' });
    }
    
    // Initialize connection (will generate QR)
    await createConnection(tenantId);
    
    res.json({ 
      status: 'qr_pending',
      message: 'Scan the QR code with your WhatsApp app'
    });
  } catch (error) {
    logger.error('Error starting session:', error.message);
    logger.error(error.stack);
    res.status(500).json({ error: 'Failed to start session', details: error.message });
  }
});

// Disconnect session
app.post('/session/:tenantId/disconnect', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const sock = activeSessions.get(tenantId);
    if (sock) {
      await sock.logout();
      activeSessions.delete(tenantId);
    }
    
    // Clean up session data
    await deleteSessionState(tenantId);
    
    // Remove session files
    const sessionDir = path.join('/tmp', 'wa-sessions', tenantId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    
    logger.info(`Session disconnected for ${tenantId}`);
    
    res.json({ status: 'disconnected' });
  } catch (error) {
    logger.error('Error disconnecting session:', error);
    res.status(500).json({ error: 'Failed to disconnect session' });
  }
});

// Send message
app.post('/session/:tenantId/send', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { to_phone, message } = req.body;
    
    if (!to_phone || !message) {
      return res.status(400).json({ error: 'Missing to_phone or message' });
    }
    
    // Check rate limit
    const rateCheck = checkRateLimit(tenantId);
    if (!rateCheck.allowed) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        remaining: 0,
        reset_in_minutes: rateCheck.resetIn
      });
    }
    
    const sock = activeSessions.get(tenantId);
    if (!sock) {
      return res.status(400).json({ error: 'No active session' });
    }
    
    // Format phone number for WhatsApp
    const jid = `${to_phone.replace(/\D/g, '')}@s.whatsapp.net`;
    
    // Send message
    const result = await sock.sendMessage(jid, { text: message });
    
    logger.info(`Message sent for ${tenantId} to ${to_phone}`);
    
    res.json({
      success: true,
      message_id: result.key.id,
      rate_limit_remaining: rateCheck.remaining
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get rate limit status
app.get('/session/:tenantId/rate-limit', (req, res) => {
  const { tenantId } = req.params;
  const limit = rateLimits.get(tenantId);
  
  if (!limit) {
    return res.json({ 
      remaining: RATE_LIMIT_HOUR,
      reset_in_minutes: 60 
    });
  }
  
  const now = Date.now();
  res.json({
    remaining: Math.max(0, RATE_LIMIT_HOUR - limit.count),
    reset_in_minutes: Math.ceil((limit.resetTime - now) / 60000)
  });
});

// ========================
// SERVER STARTUP
// ========================

async function start() {
  await initRedis();
  
  app.listen(PORT, () => {
    logger.info(`WhatsApp Web service running on port ${PORT}`);
    logger.info(`Backend URL: ${BACKEND_URL}`);
    logger.info(`Rate limit: ${RATE_LIMIT_HOUR} messages/hour`);
  });
}

start().catch(console.error);
