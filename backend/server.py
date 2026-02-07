from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, BackgroundTasks, Query, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from enum import Enum
import csv
import io
import re
import hashlib
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'warmreach-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', 'sk-emergent-8552bB41fB80dB5501')

# Create the main app
app = FastAPI(title="Warm Outreach Engine API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ========================
# AI SERVICE
# ========================

async def generate_ai_message(contact: Dict, blueprint: Dict, previous_messages: List[str] = None) -> str:
    """Generate a unique message using OpenAI GPT-5.2 via Emergent"""
    try:
        from emergentintegrations.llm.chat import LlmChat
        
        # Build context about the contact
        contact_context = f"""
Contact Information:
- Name: {contact.get('first_name', '')} {contact.get('last_name', '')}
- Company: {contact.get('company_name', 'their company')}
- Job Title: {contact.get('job_title', '')}
- City: {contact.get('city', '')}
- Country: {contact.get('country', '')}
"""
        
        # Build blueprint context
        blueprint_context = f"""
Message Blueprint:
- Channel: {blueprint.get('channel', 'email')}
- Intent: {blueprint.get('intent', 'awareness')}
- Angle: {blueprint.get('angle', 'cost')}
- Tone: {blueprint.get('tone', 'calm_authority')}
- Structure Template:
{blueprint.get('structure', '')}
"""
        
        # Channel-specific constraints
        channel_constraints = {
            "email": "Keep it plain text, 4-6 lines max. No emojis. No links in first touch. One idea only.",
            "whatsapp": "Max 3 short lines. One question max. Conversational tone. End with opt-out note.",
            "linkedin": "No links. Use numbers over adjectives. One thought per post. Add line breaks."
        }
        
        constraints = channel_constraints.get(blueprint.get('channel', 'email'), channel_constraints['email'])
        
        # Build prompt for unique message
        previous_context = ""
        if previous_messages and len(previous_messages) > 0:
            previous_context = f"""
IMPORTANT - Avoid similarity to these previously generated messages:
{chr(10).join(['- ' + msg[:200] + '...' if len(msg) > 200 else '- ' + msg for msg in previous_messages[:5]])}

Generate a COMPLETELY DIFFERENT message with a unique opening, different phrasing, and varied structure.
"""
        
        prompt = f"""You are a B2B outreach expert. Generate a personalized {blueprint.get('channel', 'email')} message.

{contact_context}

{blueprint_context}

Channel Constraints: {constraints}

{previous_context}

RULES:
1. DO NOT invent facts or make claims about the contact's company
2. DO NOT add links unless explicitly in the template
3. Replace placeholders with actual contact data
4. Make the message feel human, not templated
5. Vary the opening hook each time
6. Keep the same intent and angle but use different words/phrases
7. Be concise and respectful of their time

Generate ONLY the message text, nothing else. No subject line, no signature block unless in template."""

        config = ChatConfig(
            api_key=EMERGENT_LLM_KEY,
            model="gpt-5.2"
        )
        
        response = await chat(
            config=config,
            user_message=prompt,
            system_message="You are a professional B2B outreach writer. Generate unique, personalized messages that feel human and respect the recipient. Never repeat the same phrasing twice."
        )
        
        return response.strip()
        
    except Exception as e:
        logger.error(f"AI generation failed: {e}")
        # Fallback to template replacement with variation
        return generate_fallback_message(contact, blueprint, previous_messages)

def generate_fallback_message(contact: Dict, blueprint: Dict, previous_messages: List[str] = None) -> str:
    """Fallback message generation with variation if AI fails"""
    structure = blueprint.get("structure", "")
    
    # Basic placeholder replacement - handle None values
    content = structure.replace("{{first_name}}", contact.get("first_name") or "")
    content = content.replace("{{last_name}}", contact.get("last_name") or "")
    content = content.replace("{{company_name}}", contact.get("company_name") or "your company")
    content = content.replace("{{job_title}}", contact.get("job_title") or "")
    content = content.replace("{{city}}", contact.get("city") or "")
    content = content.replace("{{country}}", contact.get("country") or "")
    
    # Add variation hooks based on angle
    angle = blueprint.get("angle", "cost")
    angle_hooks = {
        "cost": [
            "Quick question about",
            "Noticed something about",
            "Been thinking about",
            "Curious if you've considered",
            "Brief thought on"
        ],
        "risk": [
            "Something caught my attention",
            "A concern came to mind",
            "Worth flagging",
            "Quick heads up about",
            "Noticed a pattern"
        ],
        "growth": [
            "Opportunity worth exploring",
            "Quick growth idea",
            "Potential unlock",
            "Thought you'd find this interesting",
            "Growth angle"
        ],
        "downtime": [
            "Reliability question",
            "Uptime thought",
            "Quick operational note",
            "Continuity consideration",
            "System resilience"
        ],
        "compliance": [
            "Compliance consideration",
            "Regulatory thought",
            "Quick governance note",
            "Standards alignment",
            "Policy consideration"
        ]
    }
    
    # Create message hash to track uniqueness
    base_hash = hashlib.md5(content.encode()).hexdigest()[:8]
    
    # Add some randomization to make messages different
    if previous_messages:
        random.seed(len(previous_messages) + hash(contact.get("email", "")))
        hooks = angle_hooks.get(angle, angle_hooks["cost"])
        hook = random.choice(hooks)
        
        # Modify opening if it exists
        lines = content.split('\n')
        if lines and len(lines) > 0:
            lines[0] = f"{hook} - {lines[0]}"
            content = '\n'.join(lines)
    
    return content

# ========================
# ENUMS
# ========================

class UserRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    SALES_USER = "sales_user"
    READ_ONLY = "read_only"

class ContactStatus(str, Enum):
    NEW = "new"
    CONTACTED = "contacted"
    REPLIED = "replied"
    INTERESTED = "interested"
    NOT_INTERESTED = "not_interested"
    BLACKLISTED = "blacklisted"

class Channel(str, Enum):
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    LINKEDIN = "linkedin"

class Intent(str, Enum):
    AWARENESS = "awareness"
    CONVERSATION = "conversation"
    FOLLOW_UP = "follow_up"

class Angle(str, Enum):
    COST = "cost"
    RISK = "risk"
    DOWNTIME = "downtime"
    GROWTH = "growth"
    COMPLIANCE = "compliance"

class Tone(str, Enum):
    CALM_AUTHORITY = "calm_authority"
    OBSERVATIONAL = "observational"
    DIRECT = "direct"

class MessageStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    SCHEDULED = "scheduled"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    BOUNCED = "bounced"

class ApprovalMode(str, Enum):
    MANUAL = "manual"
    AUTO_KNOWN = "auto_known"
    AUTOPILOT = "autopilot"

class Sentiment(str, Enum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"

# ========================
# MODELS
# ========================

class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: UserRole = UserRole.SALES_USER

class UserCreate(UserBase):
    password: str
    tenant_id: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None

class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: UserRole
    tenant_id: str
    is_active: bool

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class TenantBase(BaseModel):
    name: str
    company_name: Optional[str] = None

class TenantCreate(TenantBase):
    pass

class Tenant(TenantBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approval_mode: ApprovalMode = ApprovalMode.MANUAL
    rate_limits: Dict[str, int] = Field(default_factory=lambda: {
        "email_daily": 10,
        "whatsapp_daily": 10,
        "linkedin_weekly": 3
    })

class ContextFlags(BaseModel):
    has_open_support_ticket: bool = False
    recent_inbound_email: bool = False
    deal_stage_not_cold: bool = False
    do_not_contact: bool = False
    negative_sentiment_detected: bool = False

class ContactBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    source: str = "manual"
    notes: Optional[str] = None

class ContactCreate(ContactBase):
    pass

class Contact(ContactBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    status: ContactStatus = ContactStatus.NEW
    context_flags: ContextFlags = Field(default_factory=ContextFlags)
    last_contacted: Dict[str, Optional[datetime]] = Field(default_factory=lambda: {
        "email": None, "whatsapp": None, "linkedin": None
    })
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    status: Optional[ContactStatus] = None
    notes: Optional[str] = None
    context_flags: Optional[ContextFlags] = None

class BlueprintBase(BaseModel):
    name: str
    description: Optional[str] = None
    channel: Channel
    intent: Intent
    angle: Angle
    tone: Tone
    structure: str
    cooldown_days: int = 7

class BlueprintCreate(BlueprintBase):
    pass

class Blueprint(BlueprintBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    is_approved: bool = False
    usage_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageBase(BaseModel):
    contact_id: str
    blueprint_id: str
    channel: Channel

class MessageCreate(MessageBase):
    pass

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    contact_id: str
    blueprint_id: str
    channel: Channel
    content: str
    status: MessageStatus = MessageStatus.DRAFT
    scheduled_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    content_hash: Optional[str] = None  # For deduplication

class MessageApprove(BaseModel):
    message_ids: List[str]

class MessageSchedule(BaseModel):
    message_id: str
    scheduled_at: datetime

class ReplyBase(BaseModel):
    message_id: str
    content: str
    channel: Channel

class Reply(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    contact_id: str
    message_id: str
    channel: Channel
    content: str
    sentiment: Optional[Sentiment] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    user_id: str
    action: str
    resource_type: str
    resource_id: str
    details: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DashboardMetrics(BaseModel):
    total_contacts: int
    total_messages_sent: int
    total_replies: int
    positive_sentiment_rate: float
    blacklist_rate: float
    meetings_booked: int
    rate_limits_remaining: Dict[str, int]
    recent_activity: List[Dict[str, Any]]

class BulkStatusUpdate(BaseModel):
    contact_ids: List[str]
    status: ContactStatus

class GenerateMessageRequest(BaseModel):
    contact_id: str
    blueprint_id: str

class BatchGenerateRequest(BaseModel):
    channel: Optional[Channel] = None
    max_messages: int = 10
    blueprint_id: Optional[str] = None  # If not provided, auto-select blueprints

class BatchGenerateResponse(BaseModel):
    generated_count: int
    skipped_count: int
    errors: List[str]
    messages: List[Dict[str, Any]]

# ========================
# HELPER FUNCTIONS
# ========================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, tenant_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def can_contact(contact: Dict) -> tuple[bool, str]:
    """Check if contact can be reached based on context flags"""
    flags = contact.get("context_flags", {})
    if flags.get("has_open_support_ticket"):
        return False, "Contact has open support ticket"
    if flags.get("recent_inbound_email"):
        return False, "Contact has recent inbound email (< 14 days)"
    if flags.get("deal_stage_not_cold"):
        return False, "Contact deal stage is not cold"
    if flags.get("do_not_contact"):
        return False, "Contact marked as do not contact"
    if flags.get("negative_sentiment_detected"):
        return False, "Negative sentiment detected"
    if contact.get("status") == ContactStatus.BLACKLISTED:
        return False, "Contact is blacklisted"
    return True, "OK"

async def check_rate_limit(tenant_id: str, channel: Channel) -> tuple[bool, int]:
    """Check if tenant can send message on channel"""
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        return False, 0
    
    rate_limits = tenant.get("rate_limits", {})
    
    if channel == Channel.EMAIL:
        limit = rate_limits.get("email_daily", 10)
        window_start = datetime.now(timezone.utc) - timedelta(days=1)
    elif channel == Channel.WHATSAPP:
        limit = rate_limits.get("whatsapp_daily", 10)
        window_start = datetime.now(timezone.utc) - timedelta(days=1)
    else:  # LinkedIn
        limit = rate_limits.get("linkedin_weekly", 3)
        window_start = datetime.now(timezone.utc) - timedelta(weeks=1)
    
    sent_count = await db.messages.count_documents({
        "tenant_id": tenant_id,
        "channel": channel,
        "status": {"$in": ["sent", "delivered"]},
        "sent_at": {"$gte": window_start}
    })
    
    remaining = max(0, limit - sent_count)
    return remaining > 0, remaining

async def check_cooldown(contact: Dict, blueprint: Dict) -> tuple[bool, str]:
    """Check if contact is in cooldown for this blueprint's channel"""
    channel = blueprint.get("channel")
    last_contacted = contact.get("last_contacted", {}).get(channel)
    
    if last_contacted:
        if isinstance(last_contacted, str):
            last_contacted = datetime.fromisoformat(last_contacted.replace('Z', '+00:00'))
        cooldown_end = last_contacted + timedelta(days=blueprint.get("cooldown_days", 7))
        if datetime.now(timezone.utc) < cooldown_end:
            return False, f"Contact in cooldown until {cooldown_end.isoformat()}"
    
    return True, "OK"

async def get_previous_messages_for_contact(tenant_id: str, contact_id: str, channel: str, limit: int = 5) -> List[str]:
    """Get previous messages sent to this contact on this channel"""
    messages = await db.messages.find(
        {
            "tenant_id": tenant_id,
            "contact_id": contact_id,
            "channel": channel
        },
        {"_id": 0, "content": 1}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return [m.get("content", "") for m in messages]

async def log_audit(tenant_id: str, user_id: str, action: str, resource_type: str, resource_id: str, details: Dict = None):
    """Log an audit entry"""
    log = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details
    )
    doc = log.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.audit_logs.insert_one(doc)

# ========================
# AUTH ROUTES
# ========================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if not user_data.tenant_id:
        tenant = Tenant(name=f"{user_data.first_name}'s Organization")
        tenant_doc = tenant.model_dump()
        tenant_doc['created_at'] = tenant_doc['created_at'].isoformat()
        await db.tenants.insert_one(tenant_doc)
        tenant_id = tenant.id
        role = UserRole.OWNER
    else:
        tenant_id = user_data.tenant_id
        role = user_data.role
    
    user = User(
        email=user_data.email,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        role=role,
        tenant_id=tenant_id
    )
    
    user_doc = user.model_dump()
    user_doc['password_hash'] = hash_password(user_data.password)
    user_doc['created_at'] = user_doc['created_at'].isoformat()
    if user_doc.get('last_login'):
        user_doc['last_login'] = user_doc['last_login'].isoformat()
    
    await db.users.insert_one(user_doc)
    token = create_token(user.id, tenant_id, role)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user.id, email=user.email, first_name=user.first_name,
            last_name=user.last_name, role=user.role, tenant_id=user.tenant_id,
            is_active=user.is_active
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user.get('password_hash', '')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    token = create_token(user["id"], user["tenant_id"], user["role"])
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"], email=user["email"], first_name=user["first_name"],
            last_name=user["last_name"], role=user["role"], tenant_id=user["tenant_id"],
            is_active=user.get("is_active", True)
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: Dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"], email=current_user["email"],
        first_name=current_user["first_name"], last_name=current_user["last_name"],
        role=current_user["role"], tenant_id=current_user["tenant_id"],
        is_active=current_user.get("is_active", True)
    )

# ========================
# CONTACTS ROUTES
# ========================

@api_router.get("/contacts", response_model=List[Contact])
async def get_contacts(
    status: Optional[ContactStatus] = None,
    search: Optional[str] = None,
    eligible_only: bool = False,
    skip: int = 0,
    limit: int = 50,
    current_user: Dict = Depends(get_current_user)
):
    query = {"tenant_id": current_user["tenant_id"]}
    
    if status:
        query["status"] = status
    
    if eligible_only:
        # Only contacts that can be contacted
        query["status"] = {"$nin": [ContactStatus.BLACKLISTED, ContactStatus.NOT_INTERESTED]}
        query["context_flags.do_not_contact"] = {"$ne": True}
        query["context_flags.negative_sentiment_detected"] = {"$ne": True}
        query["context_flags.has_open_support_ticket"] = {"$ne": True}
    
    if search:
        query["$or"] = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"company_name": {"$regex": search, "$options": "i"}}
        ]
    
    contacts = await db.contacts.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return contacts

@api_router.post("/contacts", response_model=Contact)
async def create_contact(
    contact_data: ContactCreate,
    current_user: Dict = Depends(get_current_user)
):
    existing = await db.contacts.find_one({
        "tenant_id": current_user["tenant_id"],
        "$or": [
            {"email": contact_data.email},
            {"phone": contact_data.phone} if contact_data.phone else {}
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Contact with this email or phone already exists")
    
    contact = Contact(
        **contact_data.model_dump(),
        tenant_id=current_user["tenant_id"]
    )
    
    doc = contact.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    for ch in doc['last_contacted']:
        if doc['last_contacted'][ch]:
            doc['last_contacted'][ch] = doc['last_contacted'][ch].isoformat()
    
    await db.contacts.insert_one(doc)
    await log_audit(current_user["tenant_id"], current_user["id"], "create", "contact", contact.id)
    
    return contact

@api_router.get("/contacts/{contact_id}", response_model=Contact)
async def get_contact(
    contact_id: str,
    current_user: Dict = Depends(get_current_user)
):
    contact = await db.contacts.find_one(
        {"id": contact_id, "tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact

@api_router.put("/contacts/{contact_id}", response_model=Contact)
async def update_contact(
    contact_id: str,
    update_data: ContactUpdate,
    current_user: Dict = Depends(get_current_user)
):
    contact = await db.contacts.find_one(
        {"id": contact_id, "tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if "context_flags" in update_dict:
        update_dict["context_flags"] = update_dict["context_flags"].model_dump() if hasattr(update_dict["context_flags"], 'model_dump') else update_dict["context_flags"]
    
    await db.contacts.update_one({"id": contact_id}, {"$set": update_dict})
    await log_audit(current_user["tenant_id"], current_user["id"], "update", "contact", contact_id, update_dict)
    
    updated = await db.contacts.find_one({"id": contact_id}, {"_id": 0})
    return updated

@api_router.delete("/contacts/{contact_id}")
async def delete_contact(
    contact_id: str,
    current_user: Dict = Depends(get_current_user)
):
    result = await db.contacts.delete_one(
        {"id": contact_id, "tenant_id": current_user["tenant_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    await log_audit(current_user["tenant_id"], current_user["id"], "delete", "contact", contact_id)
    return {"message": "Contact deleted"}

@api_router.post("/contacts/bulk-status")
async def bulk_update_status(
    data: BulkStatusUpdate,
    current_user: Dict = Depends(get_current_user)
):
    result = await db.contacts.update_many(
        {"id": {"$in": data.contact_ids}, "tenant_id": current_user["tenant_id"]},
        {"$set": {"status": data.status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await log_audit(current_user["tenant_id"], current_user["id"], "bulk_update", "contact", ",".join(data.contact_ids), {"status": data.status})
    
    return {"updated_count": result.modified_count}

@api_router.post("/contacts/import")
async def import_contacts(
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    content = await file.read()
    decoded = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))
    
    imported = 0
    duplicates = 0
    errors = []
    
    for row in reader:
        try:
            email = row.get('email') or row.get('Email') or row.get('EMAIL')
            if not email:
                errors.append(f"Row missing email: {row}")
                continue
            
            existing = await db.contacts.find_one({
                "tenant_id": current_user["tenant_id"],
                "email": email
            })
            if existing:
                duplicates += 1
                continue
            
            contact = Contact(
                first_name=row.get('first_name') or row.get('First Name') or row.get('FirstName') or '',
                last_name=row.get('last_name') or row.get('Last Name') or row.get('LastName') or '',
                email=email,
                phone=row.get('phone') or row.get('Phone') or row.get('PHONE'),
                company_name=row.get('company_name') or row.get('Company') or row.get('Company Name'),
                job_title=row.get('job_title') or row.get('Title') or row.get('Job Title'),
                city=row.get('city') or row.get('City'),
                country=row.get('country') or row.get('Country'),
                source="import",
                tenant_id=current_user["tenant_id"]
            )
            
            doc = contact.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            doc['updated_at'] = doc['updated_at'].isoformat()
            for ch in doc['last_contacted']:
                if doc['last_contacted'][ch]:
                    doc['last_contacted'][ch] = doc['last_contacted'][ch].isoformat()
            
            await db.contacts.insert_one(doc)
            imported += 1
            
        except Exception as e:
            errors.append(f"Error processing row: {str(e)}")
    
    await log_audit(current_user["tenant_id"], current_user["id"], "import", "contact", "bulk", {
        "imported": imported,
        "duplicates": duplicates,
        "errors": len(errors)
    })
    
    return {
        "imported": imported,
        "duplicates": duplicates,
        "errors": errors[:10]
    }

# ========================
# BLUEPRINTS ROUTES
# ========================

@api_router.get("/blueprints", response_model=List[Blueprint])
async def get_blueprints(
    channel: Optional[Channel] = None,
    current_user: Dict = Depends(get_current_user)
):
    query = {"tenant_id": current_user["tenant_id"]}
    if channel:
        query["channel"] = channel
    
    blueprints = await db.blueprints.find(query, {"_id": 0}).to_list(100)
    return blueprints

@api_router.post("/blueprints", response_model=Blueprint)
async def create_blueprint(
    blueprint_data: BlueprintCreate,
    current_user: Dict = Depends(get_current_user)
):
    if current_user["role"] not in [UserRole.OWNER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only owners and admins can create blueprints")
    
    blueprint = Blueprint(
        **blueprint_data.model_dump(),
        tenant_id=current_user["tenant_id"]
    )
    
    doc = blueprint.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.blueprints.insert_one(doc)
    await log_audit(current_user["tenant_id"], current_user["id"], "create", "blueprint", blueprint.id)
    
    return blueprint

@api_router.get("/blueprints/{blueprint_id}", response_model=Blueprint)
async def get_blueprint(
    blueprint_id: str,
    current_user: Dict = Depends(get_current_user)
):
    blueprint = await db.blueprints.find_one(
        {"id": blueprint_id, "tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    if not blueprint:
        raise HTTPException(status_code=404, detail="Blueprint not found")
    return blueprint

@api_router.put("/blueprints/{blueprint_id}", response_model=Blueprint)
async def update_blueprint(
    blueprint_id: str,
    blueprint_data: BlueprintCreate,
    current_user: Dict = Depends(get_current_user)
):
    if current_user["role"] not in [UserRole.OWNER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only owners and admins can update blueprints")
    
    blueprint = await db.blueprints.find_one(
        {"id": blueprint_id, "tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    if not blueprint:
        raise HTTPException(status_code=404, detail="Blueprint not found")
    
    update_dict = blueprint_data.model_dump()
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.blueprints.update_one({"id": blueprint_id}, {"$set": update_dict})
    await log_audit(current_user["tenant_id"], current_user["id"], "update", "blueprint", blueprint_id)
    
    updated = await db.blueprints.find_one({"id": blueprint_id}, {"_id": 0})
    return updated

@api_router.delete("/blueprints/{blueprint_id}")
async def delete_blueprint(
    blueprint_id: str,
    current_user: Dict = Depends(get_current_user)
):
    if current_user["role"] not in [UserRole.OWNER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only owners and admins can delete blueprints")
    
    result = await db.blueprints.delete_one(
        {"id": blueprint_id, "tenant_id": current_user["tenant_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Blueprint not found")
    
    await log_audit(current_user["tenant_id"], current_user["id"], "delete", "blueprint", blueprint_id)
    return {"message": "Blueprint deleted"}

@api_router.post("/blueprints/{blueprint_id}/approve")
async def approve_blueprint(
    blueprint_id: str,
    current_user: Dict = Depends(get_current_user)
):
    if current_user["role"] not in [UserRole.OWNER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only owners and admins can approve blueprints")
    
    result = await db.blueprints.update_one(
        {"id": blueprint_id, "tenant_id": current_user["tenant_id"]},
        {"$set": {"is_approved": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Blueprint not found")
    
    await log_audit(current_user["tenant_id"], current_user["id"], "approve", "blueprint", blueprint_id)
    return {"message": "Blueprint approved"}

# ========================
# MESSAGES ROUTES
# ========================

@api_router.get("/messages", response_model=List[Message])
async def get_messages(
    status: Optional[MessageStatus] = None,
    channel: Optional[Channel] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: Dict = Depends(get_current_user)
):
    query = {"tenant_id": current_user["tenant_id"]}
    
    if status:
        query["status"] = status
    if channel:
        query["channel"] = channel
    
    messages = await db.messages.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return messages

@api_router.post("/messages/generate")
async def generate_message(
    request: GenerateMessageRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Generate a single message for a specific contact and blueprint"""
    contact = await db.contacts.find_one(
        {"id": request.contact_id, "tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    can_reach, reason = can_contact(contact)
    if not can_reach:
        raise HTTPException(status_code=400, detail=f"Cannot contact: {reason}")
    
    blueprint = await db.blueprints.find_one(
        {"id": request.blueprint_id, "tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    if not blueprint:
        raise HTTPException(status_code=404, detail="Blueprint not found")
    
    # Check cooldown
    can_send, cooldown_reason = await check_cooldown(contact, blueprint)
    if not can_send:
        raise HTTPException(status_code=400, detail=cooldown_reason)
    
    # Check rate limit
    channel = blueprint["channel"]
    can_send_rate, remaining = await check_rate_limit(current_user["tenant_id"], channel)
    if not can_send_rate:
        raise HTTPException(status_code=429, detail=f"Rate limit exceeded for {channel}")
    
    # Get previous messages for deduplication
    previous_messages = await get_previous_messages_for_contact(
        current_user["tenant_id"], request.contact_id, channel
    )
    
    # Generate unique message using AI
    content = await generate_ai_message(contact, blueprint, previous_messages)
    
    # Create content hash for deduplication
    content_hash = hashlib.md5(content.encode()).hexdigest()
    
    message = Message(
        tenant_id=current_user["tenant_id"],
        contact_id=request.contact_id,
        blueprint_id=request.blueprint_id,
        channel=channel,
        content=content,
        status=MessageStatus.PENDING_APPROVAL,
        content_hash=content_hash
    )
    
    doc = message.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    for field in ['scheduled_at', 'sent_at', 'delivered_at', 'approved_at']:
        if doc.get(field):
            doc[field] = doc[field].isoformat()
    
    await db.messages.insert_one(doc)
    await db.blueprints.update_one({"id": request.blueprint_id}, {"$inc": {"usage_count": 1}})
    await log_audit(current_user["tenant_id"], current_user["id"], "generate", "message", message.id)
    
    return {
        "message": message.model_dump(),
        "contact": contact,
        "blueprint": blueprint,
        "rate_limit_remaining": remaining
    }

@api_router.post("/messages/generate-batch", response_model=BatchGenerateResponse)
async def generate_batch_messages(
    request: BatchGenerateRequest,
    current_user: Dict = Depends(get_current_user)
):
    """
    Automatically generate multiple unique messages at once.
    System auto-selects eligible contacts and appropriate blueprints.
    """
    tenant_id = current_user["tenant_id"]
    generated = []
    skipped = 0
    errors = []
    
    # Get all blueprints (filter by channel if specified)
    blueprint_query = {"tenant_id": tenant_id}
    if request.channel:
        blueprint_query["channel"] = request.channel
    if request.blueprint_id:
        blueprint_query["id"] = request.blueprint_id
    
    blueprints = await db.blueprints.find(blueprint_query, {"_id": 0}).to_list(100)
    
    if not blueprints:
        raise HTTPException(status_code=400, detail="No blueprints found. Create blueprints first.")
    
    # Get eligible contacts
    contact_query = {
        "tenant_id": tenant_id,
        "status": {"$nin": [ContactStatus.BLACKLISTED, ContactStatus.NOT_INTERESTED, ContactStatus.INTERESTED]},
        "context_flags.do_not_contact": {"$ne": True},
        "context_flags.negative_sentiment_detected": {"$ne": True},
        "context_flags.has_open_support_ticket": {"$ne": True}
    }
    
    contacts = await db.contacts.find(contact_query, {"_id": 0}).to_list(500)
    
    if not contacts:
        raise HTTPException(status_code=400, detail="No eligible contacts found.")
    
    # Track which contacts we've already processed
    processed_contacts = set()
    
    # Shuffle contacts for variety
    random.shuffle(contacts)
    
    for contact in contacts:
        if len(generated) >= request.max_messages:
            break
        
        if contact["id"] in processed_contacts:
            continue
        
        # Find a suitable blueprint for this contact
        for blueprint in blueprints:
            channel = blueprint["channel"]
            
            # Check rate limit for this channel
            can_send_rate, remaining = await check_rate_limit(tenant_id, channel)
            if not can_send_rate:
                continue
            
            # Check cooldown
            can_send_cool, _ = await check_cooldown(contact, blueprint)
            if not can_send_cool:
                skipped += 1
                continue
            
            # Check if we already have a pending message for this contact+channel
            existing = await db.messages.find_one({
                "tenant_id": tenant_id,
                "contact_id": contact["id"],
                "channel": channel,
                "status": {"$in": [MessageStatus.PENDING_APPROVAL, MessageStatus.APPROVED, MessageStatus.SCHEDULED]}
            })
            if existing:
                skipped += 1
                continue
            
            try:
                # Get previous messages for this contact
                previous_messages = await get_previous_messages_for_contact(
                    tenant_id, contact["id"], channel
                )
                
                # Generate unique message using AI
                content = await generate_ai_message(contact, blueprint, previous_messages)
                
                # Create content hash
                content_hash = hashlib.md5(content.encode()).hexdigest()
                
                # Check for duplicate content
                duplicate = await db.messages.find_one({
                    "tenant_id": tenant_id,
                    "content_hash": content_hash
                })
                if duplicate:
                    # Regenerate with different seed
                    content = await generate_ai_message(contact, blueprint, previous_messages + [content])
                    content_hash = hashlib.md5(content.encode()).hexdigest()
                
                message = Message(
                    tenant_id=tenant_id,
                    contact_id=contact["id"],
                    blueprint_id=blueprint["id"],
                    channel=channel,
                    content=content,
                    status=MessageStatus.PENDING_APPROVAL,
                    content_hash=content_hash
                )
                
                doc = message.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                for field in ['scheduled_at', 'sent_at', 'delivered_at', 'approved_at']:
                    if doc.get(field):
                        doc[field] = doc[field].isoformat()
                
                await db.messages.insert_one(doc)
                await db.blueprints.update_one({"id": blueprint["id"]}, {"$inc": {"usage_count": 1}})
                
                generated.append({
                    "message_id": message.id,
                    "contact_name": f"{contact['first_name']} {contact['last_name']}",
                    "contact_email": contact['email'],
                    "channel": channel,
                    "blueprint_name": blueprint['name'],
                    "content_preview": content[:150] + "..." if len(content) > 150 else content
                })
                
                processed_contacts.add(contact["id"])
                break  # Move to next contact after successful generation
                
            except Exception as e:
                errors.append(f"Error generating for {contact['email']}: {str(e)}")
                logger.error(f"Batch generation error: {e}")
    
    await log_audit(tenant_id, current_user["id"], "batch_generate", "message", "bulk", {
        "generated": len(generated),
        "skipped": skipped
    })
    
    return BatchGenerateResponse(
        generated_count=len(generated),
        skipped_count=skipped,
        errors=errors[:10],
        messages=generated
    )

@api_router.post("/messages/approve")
async def approve_messages(
    data: MessageApprove,
    current_user: Dict = Depends(get_current_user)
):
    if current_user["role"] not in [UserRole.OWNER, UserRole.ADMIN, UserRole.SALES_USER]:
        raise HTTPException(status_code=403, detail="Not authorized to approve messages")
    
    result = await db.messages.update_many(
        {
            "id": {"$in": data.message_ids},
            "tenant_id": current_user["tenant_id"],
            "status": MessageStatus.PENDING_APPROVAL
        },
        {
            "$set": {
                "status": MessageStatus.APPROVED,
                "approved_by": current_user["id"],
                "approved_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    for msg_id in data.message_ids:
        await log_audit(current_user["tenant_id"], current_user["id"], "approve", "message", msg_id)
    
    return {"approved_count": result.modified_count}

@api_router.post("/messages/schedule")
async def schedule_message(
    data: MessageSchedule,
    current_user: Dict = Depends(get_current_user)
):
    message = await db.messages.find_one(
        {"id": data.message_id, "tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message["status"] not in [MessageStatus.APPROVED, MessageStatus.DRAFT]:
        raise HTTPException(status_code=400, detail="Message must be approved before scheduling")
    
    await db.messages.update_one(
        {"id": data.message_id},
        {
            "$set": {
                "status": MessageStatus.SCHEDULED,
                "scheduled_at": data.scheduled_at.isoformat()
            }
        }
    )
    
    await log_audit(current_user["tenant_id"], current_user["id"], "schedule", "message", data.message_id)
    
    return {"message": "Message scheduled"}

@api_router.put("/messages/{message_id}/content")
async def update_message_content(
    message_id: str,
    content: str = Query(...),
    current_user: Dict = Depends(get_current_user)
):
    message = await db.messages.find_one(
        {"id": message_id, "tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message["status"] not in [MessageStatus.DRAFT, MessageStatus.PENDING_APPROVAL]:
        raise HTTPException(status_code=400, detail="Cannot edit message after approval")
    
    content_hash = hashlib.md5(content.encode()).hexdigest()
    
    await db.messages.update_one(
        {"id": message_id},
        {"$set": {"content": content, "content_hash": content_hash}}
    )
    
    await log_audit(current_user["tenant_id"], current_user["id"], "edit", "message", message_id)
    
    return {"message": "Message content updated"}

@api_router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    current_user: Dict = Depends(get_current_user)
):
    message = await db.messages.find_one(
        {"id": message_id, "tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message["status"] in [MessageStatus.SENT, MessageStatus.DELIVERED]:
        raise HTTPException(status_code=400, detail="Cannot delete sent messages")
    
    await db.messages.delete_one({"id": message_id})
    await log_audit(current_user["tenant_id"], current_user["id"], "delete", "message", message_id)
    
    return {"message": "Message deleted"}

# ========================
# INBOX/REPLIES ROUTES
# ========================

@api_router.get("/inbox", response_model=List[Reply])
async def get_inbox(
    sentiment: Optional[Sentiment] = None,
    is_read: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: Dict = Depends(get_current_user)
):
    query = {"tenant_id": current_user["tenant_id"]}
    
    if sentiment:
        query["sentiment"] = sentiment
    if is_read is not None:
        query["is_read"] = is_read
    
    replies = await db.replies.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return replies

@api_router.post("/inbox/{reply_id}/sentiment")
async def update_reply_sentiment(
    reply_id: str,
    sentiment: Sentiment,
    current_user: Dict = Depends(get_current_user)
):
    reply = await db.replies.find_one(
        {"id": reply_id, "tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")
    
    await db.replies.update_one({"id": reply_id}, {"$set": {"sentiment": sentiment}})
    
    if sentiment == Sentiment.NEGATIVE:
        await db.contacts.update_one(
            {"id": reply["contact_id"]},
            {
                "$set": {
                    "status": ContactStatus.BLACKLISTED,
                    "context_flags.negative_sentiment_detected": True,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    elif sentiment == Sentiment.POSITIVE:
        await db.contacts.update_one(
            {"id": reply["contact_id"]},
            {
                "$set": {
                    "status": ContactStatus.INTERESTED,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    
    await log_audit(current_user["tenant_id"], current_user["id"], "sentiment", "reply", reply_id, {"sentiment": sentiment})
    
    return {"message": "Sentiment updated"}

@api_router.post("/inbox/{reply_id}/read")
async def mark_reply_read(
    reply_id: str,
    current_user: Dict = Depends(get_current_user)
):
    result = await db.replies.update_one(
        {"id": reply_id, "tenant_id": current_user["tenant_id"]},
        {"$set": {"is_read": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Reply not found")
    
    return {"message": "Reply marked as read"}

# ========================
# ANALYTICS ROUTES
# ========================

@api_router.get("/analytics/dashboard", response_model=DashboardMetrics)
async def get_dashboard_metrics(current_user: Dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    
    total_contacts = await db.contacts.count_documents({"tenant_id": tenant_id})
    total_messages_sent = await db.messages.count_documents({
        "tenant_id": tenant_id,
        "status": {"$in": ["sent", "delivered"]}
    })
    total_replies = await db.replies.count_documents({"tenant_id": tenant_id})
    
    positive_replies = await db.replies.count_documents({
        "tenant_id": tenant_id,
        "sentiment": Sentiment.POSITIVE
    })
    positive_sentiment_rate = (positive_replies / total_replies * 100) if total_replies > 0 else 0
    
    blacklisted = await db.contacts.count_documents({
        "tenant_id": tenant_id,
        "status": ContactStatus.BLACKLISTED
    })
    blacklist_rate = (blacklisted / total_contacts * 100) if total_contacts > 0 else 0
    
    meetings_booked = await db.contacts.count_documents({
        "tenant_id": tenant_id,
        "status": ContactStatus.INTERESTED
    })
    
    _, email_remaining = await check_rate_limit(tenant_id, Channel.EMAIL)
    _, whatsapp_remaining = await check_rate_limit(tenant_id, Channel.WHATSAPP)
    _, linkedin_remaining = await check_rate_limit(tenant_id, Channel.LINKEDIN)
    
    recent_messages = await db.messages.find(
        {"tenant_id": tenant_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    recent_replies = await db.replies.find(
        {"tenant_id": tenant_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    recent_activity = []
    for msg in recent_messages:
        recent_activity.append({
            "type": "message",
            "channel": msg.get("channel"),
            "status": msg.get("status"),
            "created_at": msg.get("created_at")
        })
    for reply in recent_replies:
        recent_activity.append({
            "type": "reply",
            "channel": reply.get("channel"),
            "sentiment": reply.get("sentiment"),
            "created_at": reply.get("created_at")
        })
    
    recent_activity.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    return DashboardMetrics(
        total_contacts=total_contacts,
        total_messages_sent=total_messages_sent,
        total_replies=total_replies,
        positive_sentiment_rate=round(positive_sentiment_rate, 1),
        blacklist_rate=round(blacklist_rate, 1),
        meetings_booked=meetings_booked,
        rate_limits_remaining={
            "email": email_remaining,
            "whatsapp": whatsapp_remaining,
            "linkedin": linkedin_remaining
        },
        recent_activity=recent_activity[:10]
    )

# ========================
# SETTINGS ROUTES
# ========================

@api_router.get("/settings/tenant")
async def get_tenant_settings(current_user: Dict = Depends(get_current_user)):
    tenant = await db.tenants.find_one(
        {"id": current_user["tenant_id"]},
        {"_id": 0}
    )
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant

@api_router.put("/settings/tenant")
async def update_tenant_settings(
    name: Optional[str] = None,
    company_name: Optional[str] = None,
    approval_mode: Optional[ApprovalMode] = None,
    current_user: Dict = Depends(get_current_user)
):
    if current_user["role"] != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Only owner can update tenant settings")
    
    update_dict = {}
    if name:
        update_dict["name"] = name
    if company_name:
        update_dict["company_name"] = company_name
    if approval_mode:
        if approval_mode == ApprovalMode.AUTOPILOT:
            raise HTTPException(status_code=400, detail="Autopilot mode is locked and requires performance threshold")
        update_dict["approval_mode"] = approval_mode
    
    if update_dict:
        await db.tenants.update_one(
            {"id": current_user["tenant_id"]},
            {"$set": update_dict}
        )
        await log_audit(current_user["tenant_id"], current_user["id"], "update", "tenant", current_user["tenant_id"], update_dict)
    
    return {"message": "Settings updated"}

@api_router.get("/settings/users", response_model=List[UserResponse])
async def get_tenant_users(current_user: Dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.OWNER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only owner and admin can view users")
    
    users = await db.users.find(
        {"tenant_id": current_user["tenant_id"]},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    return [UserResponse(
        id=u["id"], email=u["email"], first_name=u["first_name"],
        last_name=u["last_name"], role=u["role"], tenant_id=u["tenant_id"],
        is_active=u.get("is_active", True)
    ) for u in users]

@api_router.get("/audit-logs")
async def get_audit_logs(
    resource_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: Dict = Depends(get_current_user)
):
    if current_user["role"] not in [UserRole.OWNER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only owner and admin can view audit logs")
    
    query = {"tenant_id": current_user["tenant_id"]}
    if resource_type:
        query["resource_type"] = resource_type
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return logs

# ========================
# ROOT & HEALTH
# ========================

@api_router.get("/")
async def root():
    return {"message": "Warm Outreach Engine API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    try:
        await db.command("ping")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
