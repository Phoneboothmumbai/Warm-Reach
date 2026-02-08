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

const express = require('express');
const cors = require('cors');
const { createClient } = require('redis');
const { 
  default: makeWASocket, 
  DisconnectReason, 
  useMultiFileAuthState,
  makeInMemoryStore,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

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

// Reconnection attempt tracker
const reconnectAttempts = new Map();

// Sync recent chats when connected
async function syncRecentChats(tenantId, sock) {
  try {
    logger.info(`Syncing recent chats for tenant ${tenantId}`);
    const store = sessionStores.get(tenantId);
    if (!store) return;
    
    // Get recent chats from store
    const chats = store.chats?.all() || [];
    
    for (const chat of chats.slice(0, 20)) {
      const jid = chat.id;
      if (!jid || jid.includes('@g.us') || jid.includes('@broadcast')) continue; // Skip groups
      
      const phoneNumber = jid.replace('@s.whatsapp.net', '');
      const name = chat.name || chat.notify || null;
      
      // Notify backend about this contact
      notifyBackend(tenantId, 'contact_sync', {
        phone_number: phoneNumber,
        name: name,
        unread_count: chat.unreadCount || 0
      });
    }
    
    logger.info(`Synced ${Math.min(chats.length, 20)} chats for tenant ${tenantId}`);
  } catch (error) {
    logger.error(`Error syncing chats for ${tenantId}: ${error.message}`);
  }
}

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
    
    // Create socket connection with better stability settings
    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['WarmReach', 'Chrome', '120.0.0'],
      connectTimeoutMs: 60000,
      qrTimeout: 40000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 250,
      markOnlineOnConnect: false,
      syncFullHistory: false
    });
    
    store.bind(sock.ev);
    
    // Track connection state to prevent duplicate QR generation
    let isConnected = false;
    
    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr && !isConnected) {
        // Generate QR code as data URL only if not connected
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
        isConnected = false;
        const reason = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = reason !== DisconnectReason.loggedOut && reason !== 401;
        
        logger.info(`Connection closed for ${tenantId}, reason: ${reason}, reconnect: ${shouldReconnect}`);
        
        if (reason === DisconnectReason.loggedOut || reason === 401) {
          // Clear session files on logout
          const sessionDir = path.join('/tmp', 'wa-sessions', tenantId);
          if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
          }
          await deleteSessionState(tenantId);
        }
        
        await saveSessionState(tenantId, {
          status: reason === DisconnectReason.loggedOut ? 'disconnected' : 'expired',
          updated_at: new Date().toISOString()
        });
        
        activeSessions.delete(tenantId);
        
        // Notify backend
        notifyBackend(tenantId, 'disconnected', { reason });
        
        // Attempt reconnection with backoff if not logged out
        if (shouldReconnect) {
          const delay = Math.min(30000, 5000 * (reconnectAttempts.get(tenantId) || 1));
          reconnectAttempts.set(tenantId, (reconnectAttempts.get(tenantId) || 1) + 1);
          setTimeout(() => {
            logger.info(`Attempting reconnection for ${tenantId} after ${delay}ms`);
            createConnection(tenantId);
          }, delay);
        }
      }
      
      if (connection === 'open') {
        isConnected = true;
        reconnectAttempts.delete(tenantId); // Reset reconnect counter
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
        
        // Sync recent chats
        syncRecentChats(tenantId, sock);
      }
    });
    
    // Handle credential updates
    sock.ev.on('creds.update', saveCreds);
    
    // Handle initial chat history load
    sock.ev.on('chats.set', async ({ chats }) => {
      logger.info(`Initial chat set for ${tenantId}: ${chats.length} chats`);
      for (const chat of chats.slice(0, 30)) {
        const jid = chat.id;
        if (!jid || jid.includes('@g.us') || jid.includes('@broadcast')) continue;
        
        const phoneNumber = jid.replace('@s.whatsapp.net', '');
        notifyBackend(tenantId, 'contact_sync', {
          phone_number: phoneNumber,
          name: chat.name || chat.notify || null,
          unread_count: chat.unreadCount || 0
        });
      }
    });
    
    // Handle new/updated chats
    sock.ev.on('chats.upsert', async (chats) => {
      logger.info(`Chat upsert for ${tenantId}: ${chats.length} chats`);
      for (const chat of chats) {
        const jid = chat.id;
        if (!jid || jid.includes('@g.us') || jid.includes('@broadcast')) continue;
        
        const phoneNumber = jid.replace('@s.whatsapp.net', '');
        notifyBackend(tenantId, 'contact_sync', {
          phone_number: phoneNumber,
          name: chat.name || chat.notify || null,
          unread_count: chat.unreadCount || 0
        });
      }
    });
    
    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      logger.info(`Messages upsert for ${tenantId}: ${messages.length} messages, type: ${type}`);
      
      // Process all incoming messages (not just 'notify')
      for (const msg of messages) {
        if (msg.key.fromMe) continue; // Skip outgoing messages
        
        const from = msg.key.remoteJid?.replace('@s.whatsapp.net', '');
        if (!from || from.includes('@g.us') || from.includes('@broadcast')) continue;
        
        const content = msg.message?.conversation || 
                       msg.message?.extendedTextMessage?.text ||
                       msg.message?.imageMessage?.caption ||
                       `[${Object.keys(msg.message || {})[0] || 'unknown'} message]`;
        
        logger.info(`Incoming message for ${tenantId} from ${from}: ${content.substring(0,50)}`);
        
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

async function restoreExistingSessions() {
  try {
    // Find existing session directories
    const sessionsDir = '/tmp/wa-sessions';
    if (!fs.existsSync(sessionsDir)) return;
    
    const tenantDirs = fs.readdirSync(sessionsDir);
    
    for (const tenantId of tenantDirs) {
      const sessionDir = path.join(sessionsDir, tenantId);
      const credsFile = path.join(sessionDir, 'creds.json');
      
      // Only restore if credentials exist
      if (fs.existsSync(credsFile)) {
        logger.info(`Restoring session for tenant ${tenantId}`);
        try {
          await createConnection(tenantId);
        } catch (error) {
          logger.error(`Failed to restore session for ${tenantId}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    logger.error(`Error restoring sessions: ${error.message}`);
  }
}

async function start() {
  await initRedis();
  
  app.listen(PORT, async () => {
    logger.info(`WhatsApp Web service running on port ${PORT}`);
    logger.info(`Backend URL: ${BACKEND_URL}`);
    logger.info(`Rate limit: ${RATE_LIMIT_HOUR} messages/hour`);
    
    // Restore existing sessions after startup
    setTimeout(restoreExistingSessions, 3000);
  });
}

start().catch(console.error);
