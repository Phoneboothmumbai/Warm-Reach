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
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import random
        import time
        
        # Business context - IT Solutions & NeoStore
        business_context = """
ABOUT OUR COMPANY:
We are an end-to-end IT solutions company focused on keeping businesses running smoothly, securely, and without disruption. Our core services include:
- Proactive IT support and maintenance
- Device procurement and lifecycle management
- Security, backups, and infrastructure management
- Structured processes with clear SLAs
- Remote support, asset tracking, and monitoring

NeoStore (our retail/enterprise arm in Mumbai) specializes in:
- Apple products and accessories
- Corporate IT setups
- Repairs, maintenance, and troubleshooting
- Hardware, networking, and security solutions

BRANDS & SOLUTIONS WE WORK WITH:

HARDWARE BRANDS:
- Apple (iPhone, iPad, MacBook, iMac, Mac Studio, Mac Pro, Apple Watch, AirPods, Vision Pro)
- Lenovo (ThinkPad, ThinkCentre, ThinkStation, Yoga, IdeaPad, Legion)
- Dell (Latitude, OptiPlex, Precision, XPS, Vostro, PowerEdge servers)
- HP (EliteBook, ProBook, ProDesk, EliteDesk, ZBook, Z workstations)

CLOUD & PRODUCTIVITY:
- Google Workspace (Gmail, Drive, Docs, Sheets, Meet, Calendar, Admin Console)
- Microsoft 365 (Outlook, Teams, SharePoint, OneDrive, Word, Excel, PowerPoint)
- Microsoft Azure (VMs, Active Directory, Intune, Defender)

NETWORKING & SECURITY:
- Cisco (Meraki, Webex, switches, routers, firewalls)
- Ubiquiti (UniFi access points, switches, security gateways)
- Fortinet (FortiGate firewalls, FortiClient)
- SonicWall (firewalls, VPN)

BACKUP & RECOVERY:
- Veeam (backup, replication, disaster recovery)
- Acronis (cyber protection, backup)
- Datto (business continuity, backup appliances)

ENDPOINT MANAGEMENT:
- Jamf (Apple device management)
- Microsoft Intune (cross-platform MDM)
- Kandji (Apple MDM)

MONITORING & SUPPORT:
- ConnectWise (RMM, PSA, remote support)
- NinjaRMM (remote monitoring)
- Domotz (network monitoring)

VALUE PROPOSITION:
- Preventive IT that reduces downtime and hidden costs
- Long-term IT partner, not just a vendor
- Quietly reliable, responsive, and accountable
- Real technical expertise, not just sales
- Expertise across Apple, Windows, and hybrid environments

STRICT RULES:
- NEVER mention pricing, costs, or specific numbers
- NEVER mention competitor names (only mention brands we work with)
- Focus on reducing downtime, operational risk, and business continuity
- Position as a trusted IT partner, not a vendor
- Tailor message based on contact's industry and likely tech needs
- Reference relevant brands/solutions based on context (e.g., Apple for creative industries, Microsoft for enterprise)
"""
        
        # Build context about the contact
        contact_name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
        company = contact.get('company_name', '') or 'their company'
        
        contact_context = f"""
Contact Information:
- Name: {contact_name or 'the recipient'}
- Company: {company}
- Job Title: {contact.get('job_title', '')}
- Industry: {contact.get('industry', '')}
- City: {contact.get('city', '')}
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
        
        # Variation seed - ensures different outputs each time
        variation_seed = random.randint(1000, 9999)
        opening_styles = [
            "Start with a genuine observation about their IT challenges",
            "Begin with a thought-provoking question about their tech operations",
            "Open with a relevant industry trend about IT/security",
            "Start by acknowledging their role in managing technology",
            "Open with a question about their current IT support experience",
            "Start with curiosity about how they handle device management",
            "Begin by referencing common IT pain points for growing companies"
        ]
        selected_style = random.choice(opening_styles)
        
        # Build prompt for unique message
        previous_context = ""
        if previous_messages and len(previous_messages) > 0:
            # Get unique previous messages
            unique_prev = list(set(previous_messages))[:5]
            if unique_prev:
                previous_context = f"""
CRITICAL - These exact messages were already generated. You MUST write something COMPLETELY DIFFERENT:
{chr(10).join(['AVOID: "' + msg[:150] + '..."' for msg in unique_prev])}

Your message must:
- Use a different opening hook
- Use different words and sentence structure  
- Have a unique angle or observation
- NOT start with similar phrases if previous messages use them
"""
        
        prompt = f"""Generate a B2B outreach message for an IT solutions company. Variation #{variation_seed}

{business_context}

{contact_context}

{blueprint_context}

Channel Rules: {constraints}

Opening Style for THIS message: {selected_style}

{previous_context}

STRICT RULES:
1. DO NOT invent facts about the contact's company
2. DO NOT mention pricing, costs, or specific numbers
3. DO NOT mention any competitor names
4. Replace placeholders with actual contact data
5. Focus on IT pain points: downtime, security risks, device management, support quality
6. Position as a long-term IT partner, not a vendor
7. Use the specified opening style: {selected_style}
8. Be concise - respect their time
7. If you don't have company details, focus on the recipient's role/position instead

OUTPUT: Generate ONLY the message text. No subject lines, no labels, no explanations."""

        llm_chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"msg_gen_{contact.get('id', 'unknown')}_{int(time.time())}_{variation_seed}",
            system_message="You are a creative B2B copywriter. Each message you write is unique and personalized. Never use the same opening twice. Vary your sentence structure, word choice, and approach every time."
        )
        
        # Use GPT-5.2 model with temperature for variation
        llm_chat = llm_chat.with_model("openai", "gpt-5.2")
        
        response = await llm_chat.send_message(UserMessage(text=prompt))
        
        return response.strip()
        
    except Exception as e:
        logger.error(f"AI generation failed: {e}")
        # Fallback to template replacement with variation
        return generate_fallback_message(contact, blueprint, previous_messages)

async def generate_ai_blueprint(channel: str, intent: str, angle: str, tone: str, 
                                 industry: str = None, target_role: str = None,
                                 additional_context: str = None,
                                 existing_blueprints: List[str] = None) -> Dict:
    """Generate a unique blueprint structure using AI"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import random
        import time
        
        # Channel-specific guidance
        channel_guidance = {
            "email": """
- Plain text only, 4-6 lines maximum
- No emojis allowed
- No links in first touch
- One idea per email
- Clear, soft CTA at the end
- Structure: Hook → Observation → Insight → CTA""",
            "whatsapp": """
- Maximum 3 short lines
- One question maximum
- Conversational, friendly tone
- Must end with opt-out line: "Reply STOP to opt out"
- No formal greetings""",
            "linkedin": """
- No links in 70% of posts
- Use numbers over adjectives
- One thought per post
- Line breaks for readability
- Thought-leadership style"""
        }
        
        # Business context for IT Solutions & NeoStore
        business_context = """
ABOUT OUR COMPANY (Use this context for all blueprints):
We are an end-to-end IT solutions company. Our services include:
- Proactive IT support and maintenance
- Device procurement and lifecycle management
- Security, backups, and infrastructure management
- Remote support, asset tracking, and monitoring
- Corporate IT setups, repairs, and troubleshooting

NeoStore (Mumbai) specializes in Apple products, enterprise support, and hardware solutions.

BRANDS & SOLUTIONS WE WORK WITH:

HARDWARE: Apple (MacBook, iMac, iPhone, iPad), Lenovo (ThinkPad, ThinkCentre), Dell (Latitude, OptiPlex, Precision), HP (EliteBook, ProDesk, ZBook)

CLOUD & PRODUCTIVITY: Google Workspace (Gmail, Drive, Meet), Microsoft 365 (Teams, SharePoint, OneDrive), Microsoft Azure

NETWORKING & SECURITY: Cisco (Meraki), Ubiquiti (UniFi), Fortinet (FortiGate), SonicWall

BACKUP & RECOVERY: Veeam, Acronis, Datto

ENDPOINT MANAGEMENT: Jamf (Apple MDM), Microsoft Intune, Kandji

MONITORING: ConnectWise, NinjaRMM, Domotz

KEY VALUE PROPS TO HIGHLIGHT:
- Preventive IT reduces downtime and hidden costs
- Long-term IT partner, not just a vendor
- Quietly reliable, responsive, and accountable
- Real technical expertise
- Multi-platform expertise (Apple, Windows, hybrid)

STRICT RULES - NEVER MENTION:
- Pricing, costs, or specific numbers
- Competitor names (only brands we work with)
- Generic sales language
- Reference relevant brands based on target industry context
"""
        
        intent_desc = {
            "awareness": "Introduce our IT services and create initial awareness about proactive IT support",
            "conversation": "Start a dialogue about their IT challenges and how we can help",
            "follow_up": "Continue from previous interaction about IT services"
        }
        
        angle_desc = {
            "cost": "Focus on reducing hidden IT costs and operational inefficiencies",
            "risk": "Highlight IT security, data protection, and risk mitigation",
            "downtime": "Address system reliability, uptime, and business continuity",
            "growth": "Emphasize scalable IT infrastructure for growing businesses",
            "compliance": "Focus on IT compliance, security standards, and best practices"
        }
        
        tone_desc = {
            "calm_authority": "Professional, confident IT expertise without being pushy",
            "observational": "Insightful observations about IT challenges and solutions",
            "direct": "Straightforward, clear communication about IT needs"
        }
        
        # Variation seed and creative directions
        variation_seed = random.randint(1000, 9999)
        
        creative_hooks = [
            "Start with a question about their current IT support experience",
            "Open with a common IT challenge for growing businesses",
            "Begin by referencing device management or security concerns",
            "Start with an observation about reactive vs proactive IT",
            "Open with a question about their backup and recovery approach",
            "Begin by acknowledging the IT burden on business operations",
            "Start with curiosity about how they handle IT issues currently"
        ]
        selected_hook = random.choice(creative_hooks)
        
        # Build avoidance context
        avoid_context = ""
        if existing_blueprints and len(existing_blueprints) > 0:
            unique_blueprints = list(set(existing_blueprints))[:5]
            avoid_context = f"""
CRITICAL - These blueprints already exist. Create something COMPLETELY DIFFERENT:
{chr(10).join(['EXISTING: "' + bp[:100] + '..."' for bp in unique_blueprints])}

Your new blueprint MUST:
- Use a different opening approach
- Have unique phrasing and structure
- NOT start with similar words or patterns
"""
        
        prompt = f"""Generate a unique B2B outreach message blueprint for an IT solutions company. Variation #{variation_seed}

{business_context}

CHANNEL: {channel}
{channel_guidance.get(channel, channel_guidance['email'])}

INTENT: {intent} - {intent_desc.get(intent, '')}
ANGLE: {angle} - {angle_desc.get(angle, '')}
TONE: {tone} - {tone_desc.get(tone, '')}
{f'TARGET INDUSTRY: {industry}' if industry else ''}
{f'TARGET ROLE: {target_role}' if target_role else ''}
{f'ADDITIONAL CONTEXT: {additional_context}' if additional_context else ''}

CREATIVE DIRECTION: {selected_hook}

{avoid_context}

Use these placeholders:
- {{{{first_name}}}} - Contact's first name
- {{{{company_name}}}} - Contact's company
- {{{{job_title}}}} - Contact's job title

STRICT RULES:
1. Use the CREATIVE DIRECTION as your opening approach
2. Focus on IT services: support, security, devices, infrastructure
3. NEVER mention pricing or costs
4. NEVER mention competitor names
5. Position as a trusted IT partner, not a vendor
6. Keep it natural and human-sounding
7. Follow channel constraints strictly

Return ONLY the message template text."""

        llm_chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"blueprint_gen_{int(time.time())}_{variation_seed}",
            system_message="You are a creative B2B copywriter. Each blueprint you create is unique with different hooks, structures, and phrasing. Never repeat patterns."
        )
        
        llm_chat = llm_chat.with_model("openai", "gpt-5.2")
        response = await llm_chat.send_message(UserMessage(text=prompt))
        
        # Generate a unique name for the blueprint
        name_styles = [
            f"a creative {channel} name focusing on {angle}",
            f"an action-oriented name for {intent}",
            f"a benefit-driven name highlighting {angle}",
            f"a curiosity-sparking name for {channel}"
        ]
        name_style = random.choice(name_styles)
        
        name_prompt = f"Generate {name_style} outreach (3-5 words, no quotes). Make it unique and memorable. Return ONLY the name."
        name_response = await llm_chat.send_message(UserMessage(text=name_prompt))
        
        return {
            "name": name_response.strip().replace('"', '').replace("'", ""),
            "structure": response.strip(),
            "description": f"AI-generated {channel} blueprint for {intent} with {angle} focus"
        }
        
    except Exception as e:
        logger.error(f"AI blueprint generation failed: {e}")
        return generate_fallback_blueprint(channel, intent, angle, tone)

def generate_fallback_blueprint(channel: str, intent: str, angle: str, tone: str) -> Dict:
    """Fallback blueprint generation if AI fails"""
    templates = {
        "email": {
            "cost": """Hi {{first_name}},

I noticed {{company_name}} has been scaling rapidly. At this stage, many companies face rising operational costs that could be optimized.

Would a brief chat about potential quick wins be worthwhile?

Best regards""",
            "risk": """Hi {{first_name}},

Growing companies like {{company_name}} often encounter new security and operational risks as they scale.

I'd be happy to share some insights we've seen work well. Worth a quick conversation?

Best regards""",
            "growth": """Hi {{first_name}},

{{company_name}}'s growth trajectory caught my attention. Many leaders in your position are looking for ways to accelerate even further.

Would you be open to exploring some proven growth strategies?

Best regards"""
        },
        "whatsapp": {
            "cost": """Hi {{first_name}}, noticed {{company_name}}'s growth - have you looked at optimizing operational costs lately?

Reply STOP to opt out.""",
            "risk": """Hi {{first_name}}, quick question - is {{company_name}} prepared for the security challenges that come with rapid growth?

Reply STOP to opt out."""
        },
        "linkedin": {
            "cost": """Interesting observation from working with growing companies:

The biggest hidden cost isn't what you think.

It's the opportunity cost of not optimizing early.

Companies that address this at {{company_name}}'s stage see 2-3x better margins.""",
            "growth": """What separates companies that scale smoothly from those that struggle?

After working with dozens of growth-stage companies, I've noticed one pattern:

The winners invest in infrastructure before they need it.

Is {{company_name}} planning ahead?"""
        }
    }
    
    channel_templates = templates.get(channel, templates["email"])
    structure = channel_templates.get(angle, list(channel_templates.values())[0])
    
    return {
        "name": f"{intent.title()} - {angle.title()} Focus",
        "structure": structure,
        "description": f"Template-based {channel} blueprint for {intent} with {angle} focus"
    }

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
    is_super_admin: bool = False

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

# Business Profile Models
class ProductService(BaseModel):
    name: str
    description: Optional[str] = None

class BusinessProfileBase(BaseModel):
    company_name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    tagline: Optional[str] = None
    about: Optional[str] = None
    products_services: List[ProductService] = Field(default_factory=list)
    key_clients: List[str] = Field(default_factory=list)
    value_proposition: Optional[str] = None
    target_audience: Optional[str] = None
    tone_style: str = "professional"  # professional, friendly, casual, formal

class BusinessProfileCreate(BusinessProfileBase):
    pass

class BusinessProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    tagline: Optional[str] = None
    about: Optional[str] = None
    products_services: Optional[List[ProductService]] = None
    key_clients: Optional[List[str]] = None
    value_proposition: Optional[str] = None
    target_audience: Optional[str] = None
    tone_style: Optional[str] = None

class BusinessProfile(BusinessProfileBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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

class BulkMessageSchedule(BaseModel):
    message_ids: List[str]
    scheduled_at: datetime
    interval_minutes: int = 5  # Spread messages with this interval

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

# ==================== SUPER ADMIN MODELS ====================

class PlanFeature(BaseModel):
    name: str
    included: bool = True
    limit: Optional[int] = None

class PlanCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    currency: str = "INR"
    billing_cycle: str = "monthly"  # monthly, yearly, lifetime
    messages_per_day: int = 10
    contacts_limit: int = 50
    channels: List[str] = ["whatsapp"]
    features: List[str] = []
    is_popular: bool = False
    is_active: bool = True
    sort_order: int = 0

class Plan(PlanCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Subscription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    plan_id: str
    status: str = "trial"  # trial, active, cancelled, expired
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    payment_method: Optional[str] = None
    last_payment_at: Optional[datetime] = None

class TenantStats(BaseModel):
    total_tenants: int
    active_tenants: int
    trial_tenants: int
    paid_tenants: int
    inactive_tenants: int
    new_this_week: int
    total_users: int
    total_messages_sent: int
    total_revenue: float

class SuperAdminUserUpdate(BaseModel):
    is_active: Optional[bool] = None
    is_super_admin: Optional[bool] = None

class PasswordReset(BaseModel):
    new_password: str

# ==================== END SUPER ADMIN MODELS ====================

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

class AIBlueprintRequest(BaseModel):
    channel: Channel
    intent: Intent
    angle: Angle
    tone: Tone
    industry: Optional[str] = None
    target_role: Optional[str] = None
    additional_context: Optional[str] = None

class AIBlueprintResponse(BaseModel):
    blueprint: Dict[str, Any]
    requires_approval: bool = True

class BulkBlueprintImportResponse(BaseModel):
    imported: int
    errors: List[str]
    blueprints: List[Dict[str, Any]]

class WhatsAppSettings(BaseModel):
    phone_number_id: str
    access_token: str

class WhatsAppSettingsResponse(BaseModel):
    phone_number_id: Optional[str] = None
    is_configured: bool = False
    verified_at: Optional[str] = None

class WhatsAppSendRequest(BaseModel):
    to_phone: str
    message: str

# ========================
# WHATSAPP CLOUD API MODELS (Separated)
# ========================

class WACloudMessageStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"

class WACloudMessage(BaseModel):
    """WhatsApp Cloud API message - completely separate from Web messages"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    contact_id: str
    phone_number: str  # Recipient phone
    connected_number: str  # Sender's WhatsApp Business number
    direction: str  # "outbound" or "inbound"
    content: str
    message_type: str = "text"  # text, template, image, etc.
    wa_message_id: Optional[str] = None  # Meta's message ID
    status: WACloudMessageStatus = WACloudMessageStatus.PENDING
    error_message: Optional[str] = None
    template_name: Optional[str] = None  # For template messages
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None

class WACloudContact(BaseModel):
    """WhatsApp Cloud API contact - separate from Web contacts"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    connected_number: str  # Which business number they're connected to
    phone_number: str  # Contact's phone
    name: Optional[str] = None
    last_message_at: Optional[datetime] = None
    last_message_preview: Optional[str] = None
    unread_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WACloudSendRequest(BaseModel):
    to_phone: str
    message: str
    template_name: Optional[str] = None  # For first contact (requires template)

class WACloudInboxResponse(BaseModel):
    contacts: List[Dict[str, Any]]
    connected_number: str
    integration_type: str = "cloud_api"

# ========================
# WHATSAPP WEB MODELS (For Phase 2 - Baileys)
# ========================

class WAWebSessionStatus(str, Enum):
    DISCONNECTED = "disconnected"
    QR_PENDING = "qr_pending"
    CONNECTED = "connected"
    EXPIRED = "expired"

class WAWebSession(BaseModel):
    """WhatsApp Web session data"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    phone_number: str  # Connected phone number
    status: WAWebSessionStatus = WAWebSessionStatus.DISCONNECTED
    qr_code: Optional[str] = None  # Base64 QR code when pending
    last_connected_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    risk_accepted: bool = False
    risk_accepted_at: Optional[datetime] = None
    risk_accepted_by: Optional[str] = None

class WAWebMessage(BaseModel):
    """WhatsApp Web message - completely separate from Cloud API messages"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    contact_id: str
    phone_number: str  # Recipient phone
    connected_number: str  # Sender's WhatsApp Web number
    direction: str  # "outbound" or "inbound"
    content: str
    message_type: str = "text"
    wa_message_id: Optional[str] = None  # Baileys message ID
    status: WACloudMessageStatus = WACloudMessageStatus.PENDING
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None

class WAWebContact(BaseModel):
    """WhatsApp Web contact - separate from Cloud API contacts"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    connected_number: str
    phone_number: str
    name: Optional[str] = None
    last_message_at: Optional[datetime] = None
    last_message_preview: Optional[str] = None
    unread_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WAWebSendRequest(BaseModel):
    to_phone: str
    message: str

class WAWebInboxResponse(BaseModel):
    contacts: List[Dict[str, Any]]
    connected_number: str
    integration_type: str = "web"
    session_status: WAWebSessionStatus

class BatchAIBlueprintRequest(BaseModel):
    channels: List[Channel] = [Channel.EMAIL]
    intents: List[Intent] = [Intent.AWARENESS]
    angles: List[Angle] = [Angle.COST, Angle.GROWTH, Angle.RISK]
    tone: Tone = Tone.CALM_AUTHORITY
    industry: Optional[str] = None
    target_role: Optional[str] = None

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
            is_active=user.is_active, is_super_admin=False
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
            is_active=user.get("is_active", True), is_super_admin=user.get("is_super_admin", False)
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: Dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"], email=current_user["email"],
        first_name=current_user["first_name"], last_name=current_user["last_name"],
        role=current_user["role"], tenant_id=current_user["tenant_id"],
        is_active=current_user.get("is_active", True), is_super_admin=current_user.get("is_super_admin", False)
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

@api_router.post("/blueprints/generate-ai", response_model=AIBlueprintResponse)
async def generate_ai_blueprint_endpoint(
    request: AIBlueprintRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Generate a single blueprint using AI. Blueprint is created but NOT approved - requires manual approval."""
    if current_user["role"] not in [UserRole.OWNER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only owners and admins can generate blueprints")
    
    # Get existing blueprints for deduplication
    existing = await db.blueprints.find(
        {"tenant_id": current_user["tenant_id"]},
        {"_id": 0, "structure": 1}
    ).limit(20).to_list(20)
    existing_structures = [b.get("structure", "") for b in existing if b.get("structure")]
    
    # Generate blueprint using AI with existing context
    ai_result = await generate_ai_blueprint(
        channel=request.channel,
        intent=request.intent,
        angle=request.angle,
        tone=request.tone,
        industry=request.industry,
        target_role=request.target_role,
        additional_context=request.additional_context,
        existing_blueprints=existing_structures
    )
    
    # Create blueprint (not approved by default)
    blueprint = Blueprint(
        name=ai_result["name"],
        description=ai_result["description"],
        channel=request.channel,
        intent=request.intent,
        angle=request.angle,
        tone=request.tone,
        structure=ai_result["structure"],
        cooldown_days=7,
        tenant_id=current_user["tenant_id"],
        is_approved=False  # Requires manual approval
    )
    
    doc = blueprint.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.blueprints.insert_one(doc)
    await log_audit(current_user["tenant_id"], current_user["id"], "ai_generate", "blueprint", blueprint.id)
    
    # Remove MongoDB _id from response
    doc.pop('_id', None)
    
    return AIBlueprintResponse(
        blueprint=doc,
        requires_approval=True
    )

@api_router.post("/blueprints/generate-batch-ai")
async def generate_batch_ai_blueprints(
    request: BatchAIBlueprintRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Generate multiple blueprints using AI for different channel/intent/angle combinations."""
    if current_user["role"] not in [UserRole.OWNER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only owners and admins can generate blueprints")
    
    # Get existing blueprints for deduplication
    existing = await db.blueprints.find(
        {"tenant_id": current_user["tenant_id"]},
        {"_id": 0, "structure": 1}
    ).limit(30).to_list(30)
    existing_structures = [b.get("structure", "") for b in existing if b.get("structure")]
    
    generated = []
    errors = []
    
    for channel in request.channels:
        for intent in request.intents:
            for angle in request.angles:
                try:
                    # Generate blueprint using AI with existing context
                    ai_result = await generate_ai_blueprint(
                        channel=channel,
                        intent=intent,
                        angle=angle,
                        tone=request.tone,
                        industry=request.industry,
                        target_role=request.target_role,
                        existing_blueprints=existing_structures + [g.get("structure", "") for g in generated]
                    )
                    
                    # Create blueprint (not approved by default)
                    blueprint = Blueprint(
                        name=ai_result["name"],
                        description=ai_result["description"],
                        channel=channel,
                        intent=intent,
                        angle=angle,
                        tone=request.tone,
                        structure=ai_result["structure"],
                        cooldown_days=7,
                        tenant_id=current_user["tenant_id"],
                        is_approved=False
                    )
                    
                    doc = blueprint.model_dump()
                    doc['created_at'] = doc['created_at'].isoformat()
                    doc['updated_at'] = doc['updated_at'].isoformat()
                    
                    await db.blueprints.insert_one(doc)
                    
                    generated.append({
                        "id": blueprint.id,
                        "name": blueprint.name,
                        "channel": channel,
                        "intent": intent,
                        "angle": angle
                    })
                    
                except Exception as e:
                    errors.append(f"{channel}/{intent}/{angle}: {str(e)}")
                    logger.error(f"Batch blueprint generation error: {e}")
    
    await log_audit(current_user["tenant_id"], current_user["id"], "batch_ai_generate", "blueprint", "bulk", {
        "generated": len(generated)
    })
    
    return {
        "generated_count": len(generated),
        "errors": errors[:10],
        "blueprints": generated
    }

@api_router.post("/blueprints/import", response_model=BulkBlueprintImportResponse)
async def import_blueprints(
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Import blueprints from CSV file. All imported blueprints require approval before use."""
    if current_user["role"] not in [UserRole.OWNER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only owners and admins can import blueprints")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    content = await file.read()
    decoded = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))
    
    imported = 0
    errors = []
    blueprints = []
    
    valid_channels = ["email", "whatsapp", "linkedin"]
    valid_intents = ["awareness", "conversation", "follow_up"]
    valid_angles = ["cost", "risk", "downtime", "growth", "compliance"]
    valid_tones = ["calm_authority", "observational", "direct"]
    
    for row_num, row in enumerate(reader, start=2):
        try:
            # Get and validate fields
            name = row.get('name') or row.get('Name') or row.get('NAME')
            if not name:
                errors.append(f"Row {row_num}: Missing name")
                continue
            
            channel = (row.get('channel') or row.get('Channel') or row.get('CHANNEL') or 'email').lower()
            if channel not in valid_channels:
                errors.append(f"Row {row_num}: Invalid channel '{channel}'")
                continue
            
            intent = (row.get('intent') or row.get('Intent') or row.get('INTENT') or 'awareness').lower()
            if intent not in valid_intents:
                errors.append(f"Row {row_num}: Invalid intent '{intent}'")
                continue
            
            angle = (row.get('angle') or row.get('Angle') or row.get('ANGLE') or 'cost').lower()
            if angle not in valid_angles:
                errors.append(f"Row {row_num}: Invalid angle '{angle}'")
                continue
            
            tone = (row.get('tone') or row.get('Tone') or row.get('TONE') or 'calm_authority').lower().replace(' ', '_')
            if tone not in valid_tones:
                errors.append(f"Row {row_num}: Invalid tone '{tone}'")
                continue
            
            structure = row.get('structure') or row.get('Structure') or row.get('STRUCTURE') or row.get('template') or row.get('Template')
            if not structure:
                errors.append(f"Row {row_num}: Missing structure/template")
                continue
            
            cooldown = int(row.get('cooldown_days') or row.get('cooldown') or row.get('Cooldown') or 7)
            description = row.get('description') or row.get('Description') or ''
            
            # Create blueprint (not approved by default)
            blueprint = Blueprint(
                name=name,
                description=description,
                channel=channel,
                intent=intent,
                angle=angle,
                tone=tone,
                structure=structure,
                cooldown_days=cooldown,
                tenant_id=current_user["tenant_id"],
                is_approved=False  # Imported blueprints require approval
            )
            
            doc = blueprint.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            doc['updated_at'] = doc['updated_at'].isoformat()
            
            await db.blueprints.insert_one(doc)
            imported += 1
            blueprints.append({
                "id": blueprint.id,
                "name": blueprint.name,
                "channel": channel,
                "intent": intent,
                "angle": angle
            })
            
        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")
    
    await log_audit(current_user["tenant_id"], current_user["id"], "import", "blueprint", "bulk", {
        "imported": imported,
        "errors": len(errors)
    })
    
    return BulkBlueprintImportResponse(
        imported=imported,
        errors=errors[:10],
        blueprints=blueprints
    )

@api_router.get("/blueprints/import/template")
async def get_blueprint_import_template(current_user: Dict = Depends(get_current_user)):
    """Download a sample CSV template for blueprint import with example data."""
    from fastapi.responses import StreamingResponse
    
    # Create sample CSV content with example blueprints
    csv_content = """name,channel,intent,angle,tone,structure,description,cooldown_days
Cold Intro - Cost Savings,email,awareness,cost,calm_authority,"Hi {{first_name}},

I noticed {{company_name}} has been scaling rapidly. At this stage, many companies face rising operational costs that could be optimized.

Would a brief chat about potential quick wins be worthwhile?

Best regards",First touch email focused on cost optimization,7
WhatsApp Quick Touch,whatsapp,conversation,growth,direct,"Hi {{first_name}}, noticed {{company_name}}'s growth trajectory. Are you exploring ways to accelerate even further?

Reply STOP to opt out.",Quick WhatsApp conversation starter,14
Risk Awareness Email,email,awareness,risk,observational,"Hi {{first_name}},

Growing companies like {{company_name}} often encounter new security and operational risks as they scale.

I'd be happy to share some insights we've seen work well. Worth a quick conversation?

Best regards",Risk-focused awareness email,7
LinkedIn Thought Leadership,linkedin,awareness,compliance,calm_authority,"Interesting observation from working with growing companies:

The biggest compliance gap isn't what you think.

It's the assumption that yesterday's processes work for today's scale.

Companies that address this at {{company_name}}'s stage avoid costly retrofits later.",LinkedIn post for compliance awareness,21
Follow-up - Previous Interest,email,follow_up,cost,direct,"Hi {{first_name}},

Following up on my previous note about potential cost optimizations at {{company_name}}.

Has this been something you've had a chance to consider?

Happy to share a quick case study if helpful.

Best regards",Follow-up for previous contacts,14
"""
    
    # Return as downloadable CSV file
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=blueprint_template.csv"}
    )

@api_router.post("/blueprints/approve-bulk")
async def approve_bulk_blueprints(
    blueprint_ids: List[str],
    current_user: Dict = Depends(get_current_user)
):
    """Approve multiple blueprints at once."""
    if current_user["role"] not in [UserRole.OWNER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only owners and admins can approve blueprints")
    
    result = await db.blueprints.update_many(
        {
            "id": {"$in": blueprint_ids},
            "tenant_id": current_user["tenant_id"]
        },
        {"$set": {"is_approved": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await log_audit(current_user["tenant_id"], current_user["id"], "bulk_approve", "blueprint", ",".join(blueprint_ids))
    
    return {"approved_count": result.modified_count}

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
    
    # Also get recent messages globally to avoid duplicates
    recent_messages = await db.messages.find(
        {"tenant_id": current_user["tenant_id"], "channel": channel},
        {"_id": 0, "content": 1}
    ).sort("created_at", -1).limit(10).to_list(10)
    recent_contents = [m.get("content", "") for m in recent_messages if m.get("content")]
    
    all_previous = list(set(previous_messages + recent_contents))[:10]
    
    # Generate unique message using AI
    content = await generate_ai_message(contact, blueprint, all_previous)
    
    # Create content hash for deduplication
    content_hash = hashlib.md5(content.encode()).hexdigest()
    
    # Check for exact duplicate and regenerate if needed
    duplicate = await db.messages.find_one({
        "tenant_id": current_user["tenant_id"],
        "content_hash": content_hash
    })
    
    regen_attempts = 0
    while duplicate and regen_attempts < 3:
        regen_attempts += 1
        content = await generate_ai_message(contact, blueprint, all_previous + [content])
        content_hash = hashlib.md5(content.encode()).hexdigest()
        duplicate = await db.messages.find_one({
            "tenant_id": current_user["tenant_id"],
            "content_hash": content_hash
        })
    
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
            
            # Check if this blueprint was already used for this contact (any status)
            blueprint_used = await db.messages.find_one({
                "tenant_id": tenant_id,
                "contact_id": contact["id"],
                "blueprint_id": blueprint["id"]
            })
            if blueprint_used:
                # This blueprint was already used for this contact, skip
                skipped += 1
                continue
            
            try:
                # Get previous messages for this contact AND all recent messages for dedup
                previous_messages = await get_previous_messages_for_contact(
                    tenant_id, contact["id"], channel
                )
                
                # Also get recently generated messages (last 20) to avoid global duplicates
                recent_messages = await db.messages.find(
                    {"tenant_id": tenant_id, "channel": channel},
                    {"_id": 0, "content": 1}
                ).sort("created_at", -1).limit(20).to_list(20)
                recent_contents = [m.get("content", "") for m in recent_messages if m.get("content")]
                
                # Combine for deduplication context
                all_previous = list(set(previous_messages + recent_contents))[:10]
                
                # Generate unique message using AI
                content = await generate_ai_message(contact, blueprint, all_previous)
                
                # Create content hash
                content_hash = hashlib.md5(content.encode()).hexdigest()
                
                # Check for duplicate content (exact match)
                duplicate = await db.messages.find_one({
                    "tenant_id": tenant_id,
                    "content_hash": content_hash
                })
                
                # Try regenerating up to 3 times if duplicate
                regen_attempts = 0
                while duplicate and regen_attempts < 3:
                    regen_attempts += 1
                    logger.info(f"Regenerating message (attempt {regen_attempts}) due to duplicate")
                    content = await generate_ai_message(contact, blueprint, all_previous + [content])
                    content_hash = hashlib.md5(content.encode()).hexdigest()
                    duplicate = await db.messages.find_one({
                        "tenant_id": tenant_id,
                        "content_hash": content_hash
                    })
                
                if duplicate:
                    errors.append(f"Could not generate unique message for {contact['email']}")
                    continue
                
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
    
    if message["status"] not in [MessageStatus.APPROVED, MessageStatus.DRAFT, MessageStatus.PENDING_APPROVAL, MessageStatus.SCHEDULED]:
        raise HTTPException(status_code=400, detail="Cannot schedule message with current status")
    
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
    
    return {"message": "Message scheduled", "scheduled_at": data.scheduled_at.isoformat()}

@api_router.put("/messages/{message_id}/reschedule")
async def reschedule_message(
    message_id: str,
    scheduled_at: datetime = Query(...),
    current_user: Dict = Depends(get_current_user)
):
    """Reschedule a message to a new date/time (enforces 30-60 min gap)"""
    message = await db.messages.find_one(
        {"id": message_id, "tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message["status"] not in [MessageStatus.SCHEDULED, MessageStatus.APPROVED, MessageStatus.PENDING_APPROVAL, MessageStatus.DRAFT]:
        raise HTTPException(status_code=400, detail="Cannot reschedule message with current status")
    
    # Check: This exact message hasn't already been sent to this contact
    contact_id = message.get("contact_id")
    existing_sent = await db.messages.find_one({
        "id": message_id,
        "contact_id": contact_id,
        "status": {"$in": ["sent", "delivered"]}
    })
    if existing_sent:
        raise HTTPException(status_code=400, detail="This message has already been sent to this contact")
    
    # Check: Minimum 30-minute gap between ANY scheduled messages (to avoid ban)
    min_gap_minutes = 30
    scheduled_dt = scheduled_at
    
    # Find ALL other scheduled messages (any contact)
    other_scheduled = await db.messages.find({
        "tenant_id": current_user["tenant_id"],
        "id": {"$ne": message_id},
        "status": MessageStatus.SCHEDULED,
        "scheduled_at": {"$ne": None}
    }).to_list(500)
    
    for other_msg in other_scheduled:
        try:
            other_time_str = other_msg["scheduled_at"]
            if other_time_str.endswith("Z"):
                other_time_str = other_time_str.replace("Z", "+00:00")
            other_time = datetime.fromisoformat(other_time_str)
            
            # Make both timezone-aware or naive for comparison
            if scheduled_dt.tzinfo is None and other_time.tzinfo is not None:
                other_time = other_time.replace(tzinfo=None)
            elif scheduled_dt.tzinfo is not None and other_time.tzinfo is None:
                scheduled_dt = scheduled_dt.replace(tzinfo=None)
            
            time_diff = abs((scheduled_dt - other_time).total_seconds() / 60)
            if time_diff < min_gap_minutes:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Must have at least {min_gap_minutes} minutes gap between messages. Another message is scheduled at {other_msg['scheduled_at']}"
                )
        except ValueError:
            continue
    
    await db.messages.update_one(
        {"id": message_id},
        {
            "$set": {
                "status": MessageStatus.SCHEDULED,
                "scheduled_at": scheduled_at.isoformat()
            }
        }
    )
    
    await log_audit(current_user["tenant_id"], current_user["id"], "reschedule", "message", message_id)
    
    return {"message": "Message rescheduled", "scheduled_at": scheduled_at.isoformat()}

@api_router.delete("/messages/{message_id}/unschedule")
async def unschedule_message(
    message_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Remove schedule from a message (back to approved)"""
    message = await db.messages.find_one(
        {"id": message_id, "tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message["status"] != MessageStatus.SCHEDULED:
        raise HTTPException(status_code=400, detail="Message is not scheduled")
    
    await db.messages.update_one(
        {"id": message_id},
        {
            "$set": {
                "status": MessageStatus.APPROVED,
                "scheduled_at": None
            }
        }
    )
    
    await log_audit(current_user["tenant_id"], current_user["id"], "unschedule", "message", message_id)
    
    return {"message": "Schedule removed"}

@api_router.post("/messages/schedule-bulk")
async def schedule_messages_bulk(
    data: BulkMessageSchedule,
    current_user: Dict = Depends(get_current_user)
):
    """Schedule multiple messages with random 30-60 min gaps to avoid platform bans"""
    scheduled_count = 0
    errors = []
    scheduled_times = []
    
    # Track the last scheduled time globally (for all contacts)
    last_scheduled_time = data.scheduled_at
    
    for i, message_id in enumerate(data.message_ids):
        message = await db.messages.find_one(
            {"id": message_id, "tenant_id": current_user["tenant_id"]},
            {"_id": 0}
        )
        
        if not message:
            errors.append(f"Message {message_id} not found")
            continue
        
        if message["status"] not in [MessageStatus.APPROVED, MessageStatus.DRAFT, MessageStatus.PENDING_APPROVAL, MessageStatus.SCHEDULED]:
            errors.append(f"Message {message_id} cannot be scheduled")
            continue
        
        contact_id = message.get("contact_id")
        
        # Check if message already sent to this contact
        existing_sent = await db.messages.find_one({
            "id": message_id,
            "contact_id": contact_id,
            "status": {"$in": ["sent", "delivered"]}
        })
        if existing_sent:
            errors.append(f"Message to {contact_id} already sent")
            continue
        
        # For first message, use the base time
        # For subsequent messages, add random gap of 30-60 minutes
        if i == 0:
            scheduled_time = last_scheduled_time
        else:
            # Random gap between 30-60 minutes to avoid bans
            random_gap = random.randint(30, 60)
            scheduled_time = last_scheduled_time + timedelta(minutes=random_gap)
        
        last_scheduled_time = scheduled_time
        
        await db.messages.update_one(
            {"id": message_id},
            {
                "$set": {
                    "status": MessageStatus.SCHEDULED,
                    "scheduled_at": scheduled_time.isoformat()
                }
            }
        )
        
        scheduled_count += 1
        scheduled_times.append({
            "message_id": message_id, 
            "scheduled_at": scheduled_time.isoformat(),
            "contact_id": contact_id
        })
    
    await log_audit(current_user["tenant_id"], current_user["id"], "bulk_schedule", "message", ",".join(data.message_ids))
    
    return {
        "scheduled_count": scheduled_count,
        "errors": errors,
        "scheduled_times": scheduled_times,
        "note": "Messages scheduled with random 30-60 minute gaps to avoid platform bans"
    }

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

@api_router.get("/settings/whatsapp", response_model=WhatsAppSettingsResponse)
async def get_whatsapp_settings(current_user: Dict = Depends(get_current_user)):
    """Get WhatsApp Business API configuration status for the tenant."""
    if current_user["role"] not in [UserRole.OWNER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only owner and admin can view WhatsApp settings")
    
    # Check if WhatsApp credentials exist for this tenant
    wa_config = await db.whatsapp_config.find_one(
        {"tenant_id": current_user["tenant_id"]},
        {"_id": 0, "access_token": 0}  # Never expose the access token
    )
    
    if not wa_config:
        return WhatsAppSettingsResponse(is_configured=False)
    
    return WhatsAppSettingsResponse(
        phone_number_id=wa_config.get("phone_number_id"),
        is_configured=True,
        verified_at=wa_config.get("verified_at")
    )

@api_router.post("/settings/whatsapp")
async def save_whatsapp_settings(
    settings: WhatsAppSettings,
    current_user: Dict = Depends(get_current_user)
):
    """Save WhatsApp Business Cloud API credentials for the tenant."""
    if current_user["role"] != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Only owner can configure WhatsApp settings")
    
    # Validate the credentials by making a test API call
    import httpx
    
    try:
        async with httpx.AsyncClient() as client:
            # Test the credentials by fetching the phone number info
            response = await client.get(
                f"https://graph.facebook.com/v19.0/{settings.phone_number_id}",
                headers={"Authorization": f"Bearer {settings.access_token}"},
                timeout=10.0
            )
            
            if response.status_code != 200:
                error_data = response.json()
                error_msg = error_data.get("error", {}).get("message", "Invalid credentials")
                raise HTTPException(status_code=400, detail=f"WhatsApp API validation failed: {error_msg}")
                
    except httpx.RequestError as e:
        raise HTTPException(status_code=400, detail=f"Failed to validate credentials: {str(e)}")
    
    # Save the credentials (access_token should be encrypted in production)
    await db.whatsapp_config.update_one(
        {"tenant_id": current_user["tenant_id"]},
        {
            "$set": {
                "tenant_id": current_user["tenant_id"],
                "phone_number_id": settings.phone_number_id,
                "access_token": settings.access_token,  # In production, encrypt this
                "verified_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user["id"]
            }
        },
        upsert=True
    )
    
    await log_audit(
        current_user["tenant_id"], 
        current_user["id"], 
        "configure", 
        "whatsapp", 
        "settings",
        {"phone_number_id": settings.phone_number_id}
    )
    
    return {"message": "WhatsApp credentials saved and verified successfully"}

@api_router.delete("/settings/whatsapp")
async def delete_whatsapp_settings(current_user: Dict = Depends(get_current_user)):
    """Remove WhatsApp Business API credentials for the tenant."""
    if current_user["role"] != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Only owner can remove WhatsApp settings")
    
    result = await db.whatsapp_config.delete_one({"tenant_id": current_user["tenant_id"]})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="WhatsApp configuration not found")
    
    await log_audit(
        current_user["tenant_id"], 
        current_user["id"], 
        "delete", 
        "whatsapp", 
        "settings"
    )
    
    return {"message": "WhatsApp configuration removed"}

# ========================
# WHATSAPP CLOUD API ROUTES
# ========================

@api_router.post("/wa/cloud/send")
async def send_wa_cloud_message(
    request: WACloudSendRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Send a WhatsApp message using the Business Cloud API."""
    # Get WhatsApp configuration
    wa_config = await db.whatsapp_config.find_one(
        {"tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    
    if not wa_config:
        raise HTTPException(status_code=400, detail="WhatsApp Cloud API is not configured. Please add your API credentials in Settings.")
    
    # Check rate limit
    can_send, remaining = await check_rate_limit(current_user["tenant_id"], Channel.WHATSAPP)
    if not can_send:
        raise HTTPException(status_code=429, detail="Daily WhatsApp rate limit exceeded")
    
    # Format phone number (remove + and spaces)
    to_phone = re.sub(r'[^\d]', '', request.to_phone)
    connected_number = wa_config.get("phone_number_id", "")
    
    # Create message record first (pending status)
    message = WACloudMessage(
        tenant_id=current_user["tenant_id"],
        contact_id="",  # Will be updated
        phone_number=to_phone,
        connected_number=connected_number,
        direction="outbound",
        content=request.message,
        message_type="template" if request.template_name else "text",
        template_name=request.template_name,
        status=WACloudMessageStatus.PENDING
    )
    
    # Find or create contact in wa_cloud_contacts
    contact = await db.wa_cloud_contacts.find_one(
        {
            "tenant_id": current_user["tenant_id"],
            "connected_number": connected_number,
            "phone_number": to_phone
        },
        {"_id": 0}
    )
    
    if not contact:
        new_contact = WACloudContact(
            tenant_id=current_user["tenant_id"],
            connected_number=connected_number,
            phone_number=to_phone
        )
        contact_doc = new_contact.model_dump()
        contact_doc['created_at'] = contact_doc['created_at'].isoformat()
        await db.wa_cloud_contacts.insert_one(contact_doc)
        message.contact_id = new_contact.id
    else:
        message.contact_id = contact["id"]
    
    import httpx
    
    try:
        async with httpx.AsyncClient() as client:
            # Build request payload
            if request.template_name:
                # Template message (required for first contact)
                payload = {
                    "messaging_product": "whatsapp",
                    "recipient_type": "individual",
                    "to": to_phone,
                    "type": "template",
                    "template": {
                        "name": request.template_name,
                        "language": {"code": "en"}
                    }
                }
            else:
                # Regular text message
                payload = {
                    "messaging_product": "whatsapp",
                    "recipient_type": "individual",
                    "to": to_phone,
                    "type": "text",
                    "text": {"body": request.message}
                }
            
            response = await client.post(
                f"https://graph.facebook.com/v19.0/{wa_config['phone_number_id']}/messages",
                headers={
                    "Authorization": f"Bearer {wa_config['access_token']}",
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=30.0
            )
            
            response_data = response.json()
            
            if response.status_code != 200:
                error_msg = response_data.get("error", {}).get("message", "Failed to send message")
                message.status = WACloudMessageStatus.FAILED
                message.error_message = error_msg
                logger.error(f"WhatsApp Cloud API send failed: {error_msg}")
            else:
                wa_message_id = response_data.get("messages", [{}])[0].get("id")
                message.wa_message_id = wa_message_id
                message.status = WACloudMessageStatus.SENT
                message.sent_at = datetime.now(timezone.utc)
            
            # Save message to wa_cloud_messages
            message_doc = message.model_dump()
            for key in ['created_at', 'sent_at', 'delivered_at', 'read_at']:
                if message_doc.get(key):
                    message_doc[key] = message_doc[key].isoformat() if isinstance(message_doc[key], datetime) else message_doc[key]
            await db.wa_cloud_messages.insert_one(message_doc)
            
            # Update contact's last message
            await db.wa_cloud_contacts.update_one(
                {"id": message.contact_id},
                {
                    "$set": {
                        "last_message_at": datetime.now(timezone.utc).isoformat(),
                        "last_message_preview": request.message[:50]
                    }
                }
            )
            
            if message.status == WACloudMessageStatus.FAILED:
                raise HTTPException(status_code=400, detail=f"WhatsApp API error: {message.error_message}")
            
            return {
                "success": True,
                "message_id": message.id,
                "wa_message_id": message.wa_message_id,
                "rate_limit_remaining": remaining - 1,
                "integration_type": "cloud_api"
            }
            
    except httpx.RequestError as e:
        logger.error(f"WhatsApp request error: {e}")
        message.status = WACloudMessageStatus.FAILED
        message.error_message = str(e)
        message_doc = message.model_dump()
        message_doc['created_at'] = message_doc['created_at'].isoformat()
        await db.wa_cloud_messages.insert_one(message_doc)
        raise HTTPException(status_code=500, detail=f"Failed to connect to WhatsApp API: {str(e)}")

@api_router.get("/wa/cloud/inbox")
async def get_wa_cloud_inbox(
    current_user: Dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 50
):
    """Get WhatsApp Cloud API inbox - list of contacts with recent messages."""
    wa_config = await db.whatsapp_config.find_one(
        {"tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    
    if not wa_config:
        return WACloudInboxResponse(
            contacts=[],
            connected_number="Not configured",
            integration_type="cloud_api"
        )
    
    connected_number = wa_config.get("phone_number_id", "")
    
    # Get contacts sorted by last message
    contacts = await db.wa_cloud_contacts.find(
        {
            "tenant_id": current_user["tenant_id"],
            "connected_number": connected_number
        },
        {"_id": 0}
    ).sort("last_message_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "contacts": contacts,
        "connected_number": connected_number,
        "integration_type": "cloud_api"
    }

@api_router.get("/wa/cloud/chat/{contact_id}")
async def get_wa_cloud_chat(
    contact_id: str,
    current_user: Dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """Get chat thread for a specific Cloud API contact."""
    # Verify contact belongs to tenant
    contact = await db.wa_cloud_contacts.find_one(
        {"id": contact_id, "tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Get messages for this contact
    messages = await db.wa_cloud_messages.find(
        {
            "tenant_id": current_user["tenant_id"],
            "contact_id": contact_id
        },
        {"_id": 0}
    ).sort("created_at", 1).skip(skip).limit(limit).to_list(limit)
    
    # Mark messages as read
    await db.wa_cloud_messages.update_many(
        {
            "contact_id": contact_id,
            "direction": "inbound",
            "status": {"$ne": WACloudMessageStatus.READ}
        },
        {"$set": {"status": WACloudMessageStatus.READ, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Reset unread count
    await db.wa_cloud_contacts.update_one(
        {"id": contact_id},
        {"$set": {"unread_count": 0}}
    )
    
    return {
        "contact": contact,
        "messages": messages,
        "integration_type": "cloud_api"
    }

# Legacy endpoint for backward compatibility
@api_router.post("/whatsapp/send")
async def send_whatsapp_message(
    request: WhatsAppSendRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Legacy endpoint - redirects to Cloud API send."""
    cloud_request = WACloudSendRequest(to_phone=request.to_phone, message=request.message)
    return await send_wa_cloud_message(cloud_request, current_user)

# ========================
# WHATSAPP WEBHOOK ROUTES
# ========================

# Whitelisted IPs for webhook callbacks
WHITELISTED_IPS = [
    "65.20.80.78",  # WarmReach production server
    "127.0.0.1",    # Localhost for testing
    "::1",          # IPv6 localhost
]

# Add Meta's webhook verification IPs (for WhatsApp Cloud API)
META_WEBHOOK_IPS = [
    "65.20.80.78",  # WarmReach server
]

class WhatsAppWebhookMessage(BaseModel):
    object: str
    entry: List[Dict[str, Any]]

class WebhookVerification(BaseModel):
    hub_mode: str = Field(alias="hub.mode")
    hub_verify_token: str = Field(alias="hub.verify_token")  
    hub_challenge: str = Field(alias="hub.challenge")

from fastapi import Request

def get_client_ip(request: Request) -> str:
    """Extract client IP from request headers or connection"""
    # Check X-Forwarded-For header (for reverse proxies)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    # Check X-Real-IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    # Fall back to direct connection
    return request.client.host if request.client else "unknown"

def is_ip_whitelisted(ip: str) -> bool:
    """Check if IP is in whitelist"""
    return ip in WHITELISTED_IPS or ip in META_WEBHOOK_IPS

@api_router.get("/whatsapp/webhook")
async def verify_whatsapp_webhook(
    request: Request,
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge")
):
    """
    WhatsApp webhook verification endpoint.
    Meta sends a GET request to verify the webhook URL.
    """
    client_ip = get_client_ip(request)
    logger.info(f"WhatsApp webhook verification from IP: {client_ip}")
    
    # Get the verify token from environment or use default
    expected_token = os.environ.get("WHATSAPP_VERIFY_TOKEN", "warmreach_webhook_token")
    
    if hub_mode == "subscribe" and hub_verify_token == expected_token:
        logger.info("WhatsApp webhook verified successfully")
        # Return the challenge as plain text (required by Meta)
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(content=hub_challenge)
    
    logger.warning(f"WhatsApp webhook verification failed. Mode: {hub_mode}, Token match: {hub_verify_token == expected_token}")
    raise HTTPException(status_code=403, detail="Verification failed")

@api_router.post("/whatsapp/webhook")
async def receive_whatsapp_webhook(
    request: Request,
    payload: Dict[str, Any]
):
    """
    WhatsApp webhook endpoint to receive message status updates and incoming messages.
    Called by Meta when:
    - Message status changes (sent, delivered, read, failed)
    - User sends a reply to your business
    """
    client_ip = get_client_ip(request)
    logger.info(f"WhatsApp webhook received from IP: {client_ip}")
    
    # Log the webhook payload for debugging
    logger.info(f"WhatsApp webhook payload: {payload}")
    
    try:
        # Process webhook entries
        if payload.get("object") == "whatsapp_business_account":
            for entry in payload.get("entry", []):
                for change in entry.get("changes", []):
                    value = change.get("value", {})
                    
                    # Handle message status updates
                    if "statuses" in value:
                        for status in value["statuses"]:
                            await process_message_status(status)
                    
                    # Handle incoming messages (replies)
                    if "messages" in value:
                        for message in value["messages"]:
                            await process_incoming_message(message, value.get("metadata", {}))
        
        return {"status": "ok"}
        
    except Exception as e:
        logger.error(f"Error processing WhatsApp webhook: {e}")
        # Always return 200 to acknowledge receipt (Meta will retry on failures)
        return {"status": "error", "message": str(e)}

async def process_message_status(status: Dict):
    """Process message status updates from WhatsApp Cloud API"""
    message_id = status.get("id")
    status_type = status.get("status")  # sent, delivered, read, failed
    timestamp = status.get("timestamp")
    recipient_id = status.get("recipient_id")
    
    logger.info(f"Cloud API message status update: {message_id} -> {status_type}")
    
    # Map WhatsApp status to WACloudMessageStatus
    status_mapping = {
        "sent": WACloudMessageStatus.SENT,
        "delivered": WACloudMessageStatus.DELIVERED,
        "read": WACloudMessageStatus.READ,
        "failed": WACloudMessageStatus.FAILED
    }
    
    new_status = status_mapping.get(status_type)
    if new_status:
        # Update message in wa_cloud_messages
        update_fields = {"status": new_status}
        if status_type == "sent":
            update_fields["sent_at"] = datetime.now(timezone.utc).isoformat()
        elif status_type == "delivered":
            update_fields["delivered_at"] = datetime.now(timezone.utc).isoformat()
        elif status_type == "read":
            update_fields["read_at"] = datetime.now(timezone.utc).isoformat()
        elif status_type == "failed":
            errors = status.get("errors", [])
            if errors:
                update_fields["error_message"] = errors[0].get("message", "Unknown error")
        
        # Update message by WhatsApp message ID in wa_cloud_messages
        await db.wa_cloud_messages.update_one(
            {"wa_message_id": message_id},
            {"$set": update_fields}
        )

async def process_incoming_message(message: Dict, metadata: Dict):
    """Process incoming WhatsApp Cloud API messages (replies from contacts)"""
    from_number = message.get("from")  # Sender's phone number
    message_type = message.get("type")  # text, image, etc.
    timestamp = message.get("timestamp")
    wa_message_id = message.get("id")
    
    # Get the connected business number from metadata
    display_phone_number = metadata.get("display_phone_number", "")
    phone_number_id = metadata.get("phone_number_id", "")
    
    logger.info(f"Incoming Cloud API message from {from_number} to {display_phone_number}: type={message_type}")
    
    # Extract message content based on type
    content = ""
    if message_type == "text":
        content = message.get("text", {}).get("body", "")
    elif message_type == "button":
        content = message.get("button", {}).get("text", "")
    elif message_type == "interactive":
        interactive = message.get("interactive", {})
        if "button_reply" in interactive:
            content = interactive["button_reply"].get("title", "")
        elif "list_reply" in interactive:
            content = interactive["list_reply"].get("title", "")
    elif message_type == "image":
        content = "[Image message]"
    elif message_type == "audio":
        content = "[Audio message]"
    elif message_type == "document":
        content = "[Document message]"
    elif message_type == "video":
        content = "[Video message]"
    else:
        content = f"[{message_type} message]"
    
    # Find tenant by phone_number_id in whatsapp_config
    wa_config = await db.whatsapp_config.find_one(
        {"phone_number_id": phone_number_id},
        {"_id": 0}
    )
    
    if not wa_config:
        logger.warning(f"No WhatsApp config found for phone_number_id: {phone_number_id}")
        return
    
    tenant_id = wa_config["tenant_id"]
    connected_number = phone_number_id
    
    # Find or create contact in wa_cloud_contacts
    contact = await db.wa_cloud_contacts.find_one(
        {
            "tenant_id": tenant_id,
            "connected_number": connected_number,
            "phone_number": from_number
        },
        {"_id": 0}
    )
    
    if not contact:
        # Create new contact
        new_contact = WACloudContact(
            tenant_id=tenant_id,
            connected_number=connected_number,
            phone_number=from_number,
            last_message_at=datetime.now(timezone.utc),
            last_message_preview=content[:50],
            unread_count=1
        )
        contact_doc = new_contact.model_dump()
        contact_doc['created_at'] = contact_doc['created_at'].isoformat()
        contact_doc['last_message_at'] = contact_doc['last_message_at'].isoformat()
        await db.wa_cloud_contacts.insert_one(contact_doc)
        contact_id = new_contact.id
        logger.info(f"Created new Cloud API contact for {from_number}")
    else:
        contact_id = contact["id"]
        # Update contact
        await db.wa_cloud_contacts.update_one(
            {"id": contact_id},
            {
                "$set": {
                    "last_message_at": datetime.now(timezone.utc).isoformat(),
                    "last_message_preview": content[:50]
                },
                "$inc": {"unread_count": 1}
            }
        )
    
    # Create inbound message in wa_cloud_messages
    inbound_message = WACloudMessage(
        tenant_id=tenant_id,
        contact_id=contact_id,
        phone_number=from_number,
        connected_number=connected_number,
        direction="inbound",
        content=content,
        message_type=message_type,
        wa_message_id=wa_message_id,
        status=WACloudMessageStatus.DELIVERED
    )
    
    message_doc = inbound_message.model_dump()
    message_doc['created_at'] = message_doc['created_at'].isoformat()
    await db.wa_cloud_messages.insert_one(message_doc)
    
    logger.info(f"Saved inbound Cloud API message from {from_number}")

# ========================
# WHATSAPP WEB ROUTES (Phase 2)
# ========================

WA_WEB_SERVICE_URL = os.environ.get("WA_WEB_SERVICE_URL", "http://localhost:3001")

class WAWebStartRequest(BaseModel):
    risk_accepted: bool = False

class WAWebWebhookPayload(BaseModel):
    tenant_id: str
    event: str
    data: Dict[str, Any]
    timestamp: Optional[str] = None

@api_router.get("/wa/web/status")
async def get_wa_web_status(current_user: Dict = Depends(get_current_user)):
    """Get WhatsApp Web session status and QR code if pending."""
    # Check if tenant has accepted risk
    tenant_config = await db.tenant_config.find_one(
        {"tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    
    wa_web_enabled = tenant_config.get("wa_web_enabled", False) if tenant_config else False
    risk_accepted = tenant_config.get("wa_web_risk_accepted", False) if tenant_config else False
    
    if not wa_web_enabled:
        return {
            "enabled": False,
            "status": "disabled",
            "message": "WhatsApp Web integration is disabled for this tenant"
        }
    
    # Get session from wa_web_sessions collection
    session = await db.wa_web_sessions.find_one(
        {"tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    
    if not session:
        return {
            "enabled": True,
            "status": "disconnected",
            "phone_number": None,
            "qr_code": None,
            "risk_accepted": risk_accepted
        }
    
    return {
        "enabled": True,
        "status": session.get("status", "disconnected"),
        "phone_number": session.get("phone_number"),
        "qr_code": session.get("qr_code") if session.get("status") == "qr_pending" else None,
        "connected_at": session.get("connected_at"),
        "risk_accepted": risk_accepted
    }

@api_router.post("/wa/web/enable")
async def enable_wa_web(current_user: Dict = Depends(get_current_user)):
    """Enable WhatsApp Web integration for tenant (owner only)."""
    if current_user["role"] != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Only owner can enable WhatsApp Web")
    
    await db.tenant_config.update_one(
        {"tenant_id": current_user["tenant_id"]},
        {
            "$set": {
                "wa_web_enabled": True,
                "wa_web_enabled_at": datetime.now(timezone.utc).isoformat(),
                "wa_web_enabled_by": current_user["id"]
            }
        },
        upsert=True
    )
    
    await log_audit(
        current_user["tenant_id"],
        current_user["id"],
        "enable",
        "wa_web",
        "settings"
    )
    
    return {"message": "WhatsApp Web integration enabled"}

@api_router.post("/wa/web/disable")
async def disable_wa_web(current_user: Dict = Depends(get_current_user)):
    """Disable WhatsApp Web integration for tenant (owner only)."""
    if current_user["role"] != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Only owner can disable WhatsApp Web")
    
    # Also disconnect any active session
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{WA_WEB_SERVICE_URL}/session/{current_user['tenant_id']}/disconnect",
                timeout=10.0
            )
    except Exception as e:
        logger.warning(f"Failed to disconnect WA Web session: {e}")
    
    await db.tenant_config.update_one(
        {"tenant_id": current_user["tenant_id"]},
        {
            "$set": {
                "wa_web_enabled": False,
                "wa_web_risk_accepted": False
            }
        }
    )
    
    # Clear session data
    await db.wa_web_sessions.delete_one({"tenant_id": current_user["tenant_id"]})
    
    await log_audit(
        current_user["tenant_id"],
        current_user["id"],
        "disable",
        "wa_web",
        "settings"
    )
    
    return {"message": "WhatsApp Web integration disabled"}

@api_router.post("/wa/web/start")
async def start_wa_web_session(
    request: WAWebStartRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Start WhatsApp Web QR login process."""
    # Check if enabled
    tenant_config = await db.tenant_config.find_one(
        {"tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    
    if not tenant_config or not tenant_config.get("wa_web_enabled"):
        raise HTTPException(status_code=400, detail="WhatsApp Web is not enabled for this tenant")
    
    if not request.risk_accepted:
        raise HTTPException(
            status_code=400, 
            detail="You must accept the risk of account ban before using WhatsApp Web automation"
        )
    
    # Save risk acceptance
    await db.tenant_config.update_one(
        {"tenant_id": current_user["tenant_id"]},
        {
            "$set": {
                "wa_web_risk_accepted": True,
                "wa_web_risk_accepted_at": datetime.now(timezone.utc).isoformat(),
                "wa_web_risk_accepted_by": current_user["id"]
            }
        }
    )
    
    # Call Node.js service to start session
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{WA_WEB_SERVICE_URL}/session/{current_user['tenant_id']}/start",
                json={"risk_accepted": True},
                timeout=30.0
            )
            
            if response.status_code != 200:
                error_data = response.json()
                raise HTTPException(status_code=response.status_code, detail=error_data.get("error", "Failed to start session"))
            
            # Create initial session record
            session = WAWebSession(
                tenant_id=current_user["tenant_id"],
                phone_number="",
                status=WAWebSessionStatus.QR_PENDING,
                risk_accepted=True,
                risk_accepted_at=datetime.now(timezone.utc),
                risk_accepted_by=current_user["id"]
            )
            
            session_doc = session.model_dump()
            for key in ['created_at', 'last_connected_at', 'risk_accepted_at']:
                if session_doc.get(key):
                    session_doc[key] = session_doc[key].isoformat() if isinstance(session_doc[key], datetime) else session_doc[key]
            
            await db.wa_web_sessions.update_one(
                {"tenant_id": current_user["tenant_id"]},
                {"$set": session_doc},
                upsert=True
            )
            
            return response.json()
            
    except httpx.RequestError as e:
        logger.error(f"Failed to connect to WA Web service: {e}")
        raise HTTPException(status_code=503, detail="WhatsApp Web service unavailable")

@api_router.post("/wa/web/disconnect")
async def disconnect_wa_web_session(current_user: Dict = Depends(get_current_user)):
    """Disconnect WhatsApp Web session."""
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{WA_WEB_SERVICE_URL}/session/{current_user['tenant_id']}/disconnect",
                timeout=10.0
            )
            
            # Update session status
            await db.wa_web_sessions.update_one(
                {"tenant_id": current_user["tenant_id"]},
                {"$set": {"status": WAWebSessionStatus.DISCONNECTED, "qr_code": None}}
            )
            
            await log_audit(
                current_user["tenant_id"],
                current_user["id"],
                "disconnect",
                "wa_web",
                "session"
            )
            
            return {"status": "disconnected"}
            
    except httpx.RequestError as e:
        logger.error(f"Failed to disconnect WA Web session: {e}")
        raise HTTPException(status_code=503, detail="WhatsApp Web service unavailable")

@api_router.post("/wa/web/send")
async def send_wa_web_message(
    request: WAWebSendRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Send a WhatsApp message via WhatsApp Web."""
    # Check if enabled and connected
    session = await db.wa_web_sessions.find_one(
        {"tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    
    if not session or session.get("status") != "connected":
        raise HTTPException(status_code=400, detail="WhatsApp Web is not connected")
    
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{WA_WEB_SERVICE_URL}/session/{current_user['tenant_id']}/send",
                json={"to_phone": request.to_phone, "message": request.message},
                timeout=30.0
            )
            
            result = response.json()
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=result.get("error", "Failed to send message"))
            
            # Store message in wa_web_messages
            to_phone = re.sub(r'[^\d]', '', request.to_phone)
            connected_number = session.get("phone_number", "")
            
            # Find or create contact
            contact = await db.wa_web_contacts.find_one(
                {
                    "tenant_id": current_user["tenant_id"],
                    "connected_number": connected_number,
                    "phone_number": to_phone
                },
                {"_id": 0}
            )
            
            if not contact:
                new_contact = WAWebContact(
                    tenant_id=current_user["tenant_id"],
                    connected_number=connected_number,
                    phone_number=to_phone
                )
                contact_doc = new_contact.model_dump()
                contact_doc['created_at'] = contact_doc['created_at'].isoformat()
                await db.wa_web_contacts.insert_one(contact_doc)
                contact_id = new_contact.id
            else:
                contact_id = contact["id"]
            
            # Create message record
            message = WAWebMessage(
                tenant_id=current_user["tenant_id"],
                contact_id=contact_id,
                phone_number=to_phone,
                connected_number=connected_number,
                direction="outbound",
                content=request.message,
                wa_message_id=result.get("message_id"),
                status=WACloudMessageStatus.SENT,
                sent_at=datetime.now(timezone.utc)
            )
            
            message_doc = message.model_dump()
            for key in ['created_at', 'sent_at', 'delivered_at', 'read_at']:
                if message_doc.get(key):
                    message_doc[key] = message_doc[key].isoformat() if isinstance(message_doc[key], datetime) else message_doc[key]
            
            await db.wa_web_messages.insert_one(message_doc)
            
            # Update contact
            await db.wa_web_contacts.update_one(
                {"id": contact_id},
                {
                    "$set": {
                        "last_message_at": datetime.now(timezone.utc).isoformat(),
                        "last_message_preview": request.message[:50]
                    }
                }
            )
            
            return {
                "success": True,
                "message_id": message.id,
                "wa_message_id": result.get("message_id"),
                "rate_limit_remaining": result.get("rate_limit_remaining"),
                "integration_type": "web"
            }
            
    except httpx.RequestError as e:
        logger.error(f"Failed to send WA Web message: {e}")
        raise HTTPException(status_code=503, detail="WhatsApp Web service unavailable")

@api_router.get("/wa/web/inbox")
async def get_wa_web_inbox(
    current_user: Dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 50
):
    """Get WhatsApp Web inbox - list of contacts with recent messages."""
    session = await db.wa_web_sessions.find_one(
        {"tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    
    if not session:
        return {
            "contacts": [],
            "connected_number": "Not connected",
            "integration_type": "web",
            "session_status": "disconnected"
        }
    
    connected_number = session.get("phone_number", "")
    session_status = session.get("status", "disconnected")
    
    # Get contacts
    contacts = await db.wa_web_contacts.find(
        {
            "tenant_id": current_user["tenant_id"],
            "connected_number": connected_number
        },
        {"_id": 0}
    ).sort("last_message_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "contacts": contacts,
        "connected_number": connected_number,
        "integration_type": "web",
        "session_status": session_status
    }

@api_router.get("/wa/web/chat/{contact_id}")
async def get_wa_web_chat(
    contact_id: str,
    current_user: Dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """Get chat thread for a specific WhatsApp Web contact."""
    contact = await db.wa_web_contacts.find_one(
        {"id": contact_id, "tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Get messages
    messages = await db.wa_web_messages.find(
        {
            "tenant_id": current_user["tenant_id"],
            "contact_id": contact_id
        },
        {"_id": 0}
    ).sort("created_at", 1).skip(skip).limit(limit).to_list(limit)
    
    # Mark as read and reset unread count
    await db.wa_web_messages.update_many(
        {
            "contact_id": contact_id,
            "direction": "inbound",
            "status": {"$ne": WACloudMessageStatus.READ}
        },
        {"$set": {"status": WACloudMessageStatus.READ, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await db.wa_web_contacts.update_one(
        {"id": contact_id},
        {"$set": {"unread_count": 0}}
    )
    
    return {
        "contact": contact,
        "messages": messages,
        "integration_type": "web"
    }

@api_router.post("/wa/web/webhook")
async def wa_web_webhook(payload: WAWebWebhookPayload):
    """
    Internal webhook endpoint for WhatsApp Web service to notify of events.
    This is called by the Node.js Baileys service.
    """
    tenant_id = payload.tenant_id
    event = payload.event
    data = payload.data
    
    logger.info(f"WA Web webhook: {event} for tenant {tenant_id}")
    
    if event == "qr_generated":
        # Update session with QR code
        await db.wa_web_sessions.update_one(
            {"tenant_id": tenant_id},
            {
                "$set": {
                    "status": WAWebSessionStatus.QR_PENDING,
                    "qr_code": data.get("qr_code"),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    
    elif event == "connected":
        # Update session as connected
        await db.wa_web_sessions.update_one(
            {"tenant_id": tenant_id},
            {
                "$set": {
                    "status": WAWebSessionStatus.CONNECTED,
                    "phone_number": data.get("phone_number"),
                    "qr_code": None,
                    "last_connected_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    
    elif event == "disconnected":
        await db.wa_web_sessions.update_one(
            {"tenant_id": tenant_id},
            {
                "$set": {
                    "status": WAWebSessionStatus.DISCONNECTED,
                    "qr_code": None,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    
    elif event == "message_received":
        # Process incoming message
        from_number = data.get("from", "")
        content = data.get("content", "")
        wa_message_id = data.get("message_id")
        
        # Get session to find connected number
        session = await db.wa_web_sessions.find_one(
            {"tenant_id": tenant_id},
            {"_id": 0}
        )
        
        if not session:
            logger.warning(f"No session found for incoming WA Web message, tenant: {tenant_id}")
            return {"status": "ok"}
        
        connected_number = session.get("phone_number", "")
        
        # Find or create contact
        contact = await db.wa_web_contacts.find_one(
            {
                "tenant_id": tenant_id,
                "connected_number": connected_number,
                "phone_number": from_number
            },
            {"_id": 0}
        )
        
        if not contact:
            new_contact = WAWebContact(
                tenant_id=tenant_id,
                connected_number=connected_number,
                phone_number=from_number,
                last_message_at=datetime.now(timezone.utc),
                last_message_preview=content[:50],
                unread_count=1
            )
            contact_doc = new_contact.model_dump()
            contact_doc['created_at'] = contact_doc['created_at'].isoformat()
            contact_doc['last_message_at'] = contact_doc['last_message_at'].isoformat()
            await db.wa_web_contacts.insert_one(contact_doc)
            contact_id = new_contact.id
        else:
            contact_id = contact["id"]
            await db.wa_web_contacts.update_one(
                {"id": contact_id},
                {
                    "$set": {
                        "last_message_at": datetime.now(timezone.utc).isoformat(),
                        "last_message_preview": content[:50]
                    },
                    "$inc": {"unread_count": 1}
                }
            )
        
        # Create message
        message = WAWebMessage(
            tenant_id=tenant_id,
            contact_id=contact_id,
            phone_number=from_number,
            connected_number=connected_number,
            direction="inbound",
            content=content,
            wa_message_id=wa_message_id,
            status=WACloudMessageStatus.DELIVERED
        )
        
        message_doc = message.model_dump()
        message_doc['created_at'] = message_doc['created_at'].isoformat()
        await db.wa_web_messages.insert_one(message_doc)
    
    elif event == "message_status":
        # Update message status
        wa_message_id = data.get("message_id")
        status = data.get("status")
        
        status_mapping = {
            "sent": WACloudMessageStatus.SENT,
            "delivered": WACloudMessageStatus.DELIVERED,
            "read": WACloudMessageStatus.READ
        }
        
        new_status = status_mapping.get(status)
        if new_status and wa_message_id:
            update_fields = {"status": new_status}
            if status == "delivered":
                update_fields["delivered_at"] = datetime.now(timezone.utc).isoformat()
            elif status == "read":
                update_fields["read_at"] = datetime.now(timezone.utc).isoformat()
            
            await db.wa_web_messages.update_one(
                {"wa_message_id": wa_message_id},
                {"$set": update_fields}
            )
    
    elif event == "contact_sync":
        # Sync contact from WhatsApp Web
        phone_number = data.get("phone_number", "")
        name = data.get("name")
        unread_count = data.get("unread_count", 0)
        
        session = await db.wa_web_sessions.find_one(
            {"tenant_id": tenant_id},
            {"_id": 0}
        )
        
        if session and session.get("phone_number"):
            connected_number = session["phone_number"]
            
            # Upsert contact
            existing = await db.wa_web_contacts.find_one(
                {
                    "tenant_id": tenant_id,
                    "connected_number": connected_number,
                    "phone_number": phone_number
                },
                {"_id": 0}
            )
            
            if not existing:
                new_contact = WAWebContact(
                    tenant_id=tenant_id,
                    connected_number=connected_number,
                    phone_number=phone_number,
                    name=name,
                    unread_count=unread_count
                )
                contact_doc = new_contact.model_dump()
                contact_doc['created_at'] = contact_doc['created_at'].isoformat()
                await db.wa_web_contacts.insert_one(contact_doc)
            else:
                update_fields = {"unread_count": unread_count}
                if name:
                    update_fields["name"] = name
                await db.wa_web_contacts.update_one(
                    {"id": existing["id"]},
                    {"$set": update_fields}
                )
    
    return {"status": "ok"}

# ========================
# IP WHITELIST SETTINGS
# ========================

class IPWhitelistSettings(BaseModel):
    whitelisted_ips: List[str]

@api_router.get("/settings/ip-whitelist")
async def get_ip_whitelist(current_user: Dict = Depends(get_current_user)):
    """Get the current IP whitelist configuration"""
    if current_user["role"] not in [UserRole.OWNER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only owner and admin can view IP whitelist")
    
    # Get tenant-specific whitelist
    tenant_config = await db.tenant_config.find_one(
        {"tenant_id": current_user["tenant_id"]},
        {"_id": 0}
    )
    
    custom_ips = tenant_config.get("whitelisted_ips", []) if tenant_config else []
    
    return {
        "global_ips": WHITELISTED_IPS,
        "tenant_ips": custom_ips,
        "all_ips": list(set(WHITELISTED_IPS + custom_ips))
    }

@api_router.post("/settings/ip-whitelist")
async def add_ip_to_whitelist(
    ip_address: str,
    current_user: Dict = Depends(get_current_user)
):
    """Add an IP address to the tenant's whitelist"""
    if current_user["role"] != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Only owner can modify IP whitelist")
    
    # Validate IP format
    import ipaddress
    try:
        ipaddress.ip_address(ip_address)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid IP address format")
    
    # Add to tenant's whitelist
    await db.tenant_config.update_one(
        {"tenant_id": current_user["tenant_id"]},
        {
            "$addToSet": {"whitelisted_ips": ip_address},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        },
        upsert=True
    )
    
    await log_audit(
        current_user["tenant_id"],
        current_user["id"],
        "add_ip",
        "whitelist",
        ip_address
    )
    
    return {"message": f"IP {ip_address} added to whitelist"}

@api_router.delete("/settings/ip-whitelist/{ip_address}")
async def remove_ip_from_whitelist(
    ip_address: str,
    current_user: Dict = Depends(get_current_user)
):
    """Remove an IP address from the tenant's whitelist"""
    if current_user["role"] != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Only owner can modify IP whitelist")
    
    # Remove from tenant's whitelist
    result = await db.tenant_config.update_one(
        {"tenant_id": current_user["tenant_id"]},
        {
            "$pull": {"whitelisted_ips": ip_address},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    await log_audit(
        current_user["tenant_id"],
        current_user["id"],
        "remove_ip",
        "whitelist",
        ip_address
    )
    
    return {"message": f"IP {ip_address} removed from whitelist"}

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
        is_active=u.get("is_active", True), is_super_admin=u.get("is_super_admin", False)
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

# ==================== SUPER ADMIN ENDPOINTS ====================

async def get_super_admin(current_user: Dict = Depends(get_current_user)):
    """Verify user is a super admin"""
    # current_user already contains the full user document from get_current_user
    if not current_user.get("is_super_admin", False):
        raise HTTPException(status_code=403, detail="Super admin access required")
    return current_user

# Get all plans (public endpoint for landing page)
@api_router.get("/plans")
async def get_plans():
    """Get all active plans for the pricing page"""
    plans = await db.plans.find({"is_active": True}, {"_id": 0}).sort("sort_order", 1).to_list(100)
    return plans

# Super Admin: Get all plans including inactive
@api_router.get("/admin/plans")
async def admin_get_plans(current_user: Dict = Depends(get_super_admin)):
    plans = await db.plans.find({}, {"_id": 0}).sort("sort_order", 1).to_list(100)
    return plans

# Super Admin: Create plan
@api_router.post("/admin/plans")
async def admin_create_plan(plan: PlanCreate, current_user: Dict = Depends(get_super_admin)):
    plan_dict = plan.model_dump()
    plan_dict["id"] = str(uuid.uuid4())
    plan_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    plan_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.plans.insert_one(plan_dict)
    return {**plan_dict, "_id": None}

# Super Admin: Update plan
@api_router.put("/admin/plans/{plan_id}")
async def admin_update_plan(plan_id: str, plan: PlanCreate, current_user: Dict = Depends(get_super_admin)):
    existing = await db.plans.find_one({"id": plan_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    update_data = plan.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.plans.update_one({"id": plan_id}, {"$set": update_data})
    return {"message": "Plan updated"}

# Super Admin: Delete plan
@api_router.delete("/admin/plans/{plan_id}")
async def admin_delete_plan(plan_id: str, current_user: Dict = Depends(get_super_admin)):
    result = await db.plans.delete_one({"id": plan_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"message": "Plan deleted"}

# Super Admin: Get dashboard stats
@api_router.get("/admin/stats")
async def admin_get_stats(current_user: Dict = Depends(get_super_admin)):
    total_tenants = await db.tenants.count_documents({})
    total_users = await db.users.count_documents({})
    total_messages = await db.messages.count_documents({})
    sent_messages = await db.messages.count_documents({"status": "sent"})
    
    # Active tenants (has logged in within 30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    active_tenants = await db.tenants.count_documents({"last_activity": {"$gte": thirty_days_ago}})
    
    # New tenants this week
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    new_this_week = await db.tenants.count_documents({"created_at": {"$gte": week_ago}})
    
    # Subscription stats
    active_subs = await db.subscriptions.count_documents({"status": "active"})
    trial_subs = await db.subscriptions.count_documents({"status": "trial"})
    
    return {
        "total_tenants": total_tenants,
        "active_tenants": active_tenants,
        "trial_tenants": trial_subs,
        "paid_tenants": active_subs,
        "inactive_tenants": total_tenants - active_tenants,
        "new_this_week": new_this_week,
        "total_users": total_users,
        "total_messages_sent": sent_messages,
        "total_contacts": await db.contacts.count_documents({}),
        "total_blueprints": await db.blueprints.count_documents({})
    }

# Super Admin: Get all tenants
@api_router.get("/admin/tenants")
async def admin_get_tenants(
    current_user: Dict = Depends(get_super_admin),
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    status: Optional[str] = None
):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"company_name": {"$regex": search, "$options": "i"}}
        ]
    if status:
        query["status"] = status
    
    tenants = await db.tenants.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    total = await db.tenants.count_documents(query)
    
    # Enrich with subscription and user info
    for tenant in tenants:
        sub = await db.subscriptions.find_one({"tenant_id": tenant["id"]}, {"_id": 0})
        tenant["subscription"] = sub
        
        users_count = await db.users.count_documents({"tenant_id": tenant["id"]})
        tenant["users_count"] = users_count
        
        messages_sent = await db.messages.count_documents({"tenant_id": tenant["id"], "status": "sent"})
        tenant["messages_sent"] = messages_sent
        
        contacts_count = await db.contacts.count_documents({"tenant_id": tenant["id"]})
        tenant["contacts_count"] = contacts_count
    
    return {"tenants": tenants, "total": total}

# Super Admin: Update tenant status
@api_router.put("/admin/tenants/{tenant_id}")
async def admin_update_tenant(
    tenant_id: str,
    status: Optional[str] = None,
    plan_id: Optional[str] = None,
    current_user: Dict = Depends(get_super_admin)
):
    tenant = await db.tenants.find_one({"id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if status:
        update_data["status"] = status
    
    await db.tenants.update_one({"id": tenant_id}, {"$set": update_data})
    
    # Update subscription if plan_id provided
    if plan_id:
        await db.subscriptions.update_one(
            {"tenant_id": tenant_id},
            {
                "$set": {
                    "plan_id": plan_id,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
    
    return {"message": "Tenant updated"}

# Super Admin: Get all users
@api_router.get("/admin/users")
async def admin_get_users(
    current_user: Dict = Depends(get_super_admin),
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None
):
    query = {}
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}}
        ]
    
    users = await db.users.find(query, {"_id": 0, "hashed_password": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    total = await db.users.count_documents(query)
    
    # Enrich with tenant info
    for user in users:
        tenant = await db.tenants.find_one({"id": user.get("tenant_id")}, {"_id": 0, "name": 1, "company_name": 1})
        user["tenant"] = tenant
    
    return {"users": users, "total": total}

# Super Admin: Update user
@api_router.put("/admin/users/{user_id}")
async def admin_update_user(
    user_id: str,
    update: SuperAdminUserUpdate,
    current_user: Dict = Depends(get_super_admin)
):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if update.is_active is not None:
        update_data["is_active"] = update.is_active
    if update.is_super_admin is not None:
        update_data["is_super_admin"] = update.is_super_admin
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    return {"message": "User updated"}

# Super Admin: Reset user password
@api_router.post("/admin/users/{user_id}/reset-password")
async def admin_reset_password(
    user_id: str,
    reset: PasswordReset,
    current_user: Dict = Depends(get_super_admin)
):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    hashed_password = bcrypt.hashpw(reset.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"hashed_password": hashed_password, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Password reset successfully"}

# Super Admin: Delete user
@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    current_user: Dict = Depends(get_super_admin)
):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow deleting yourself
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    await db.users.delete_one({"id": user_id})
    return {"message": "User deleted"}

# Super Admin: Get subscriptions
@api_router.get("/admin/subscriptions")
async def admin_get_subscriptions(
    current_user: Dict = Depends(get_super_admin),
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None
):
    query = {}
    if status:
        query["status"] = status
    
    subs = await db.subscriptions.find(query, {"_id": 0}).skip(skip).limit(limit).sort("started_at", -1).to_list(limit)
    total = await db.subscriptions.count_documents(query)
    
    # Enrich with tenant and plan info
    for sub in subs:
        tenant = await db.tenants.find_one({"id": sub["tenant_id"]}, {"_id": 0, "name": 1, "company_name": 1})
        sub["tenant"] = tenant
        
        plan = await db.plans.find_one({"id": sub["plan_id"]}, {"_id": 0, "name": 1, "price": 1})
        sub["plan"] = plan
    
    return {"subscriptions": subs, "total": total}

# Super Admin: Update subscription
@api_router.put("/admin/subscriptions/{subscription_id}")
async def admin_update_subscription(
    subscription_id: str,
    status: Optional[str] = None,
    plan_id: Optional[str] = None,
    expires_at: Optional[datetime] = None,
    current_user: Dict = Depends(get_super_admin)
):
    sub = await db.subscriptions.find_one({"id": subscription_id})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if status:
        update_data["status"] = status
    if plan_id:
        update_data["plan_id"] = plan_id
    if expires_at:
        update_data["expires_at"] = expires_at.isoformat()
    
    await db.subscriptions.update_one({"id": subscription_id}, {"$set": update_data})
    return {"message": "Subscription updated"}

# Super Admin: Get audit logs
@api_router.get("/admin/audit-logs")
async def admin_get_audit_logs(
    current_user: Dict = Depends(get_super_admin),
    skip: int = 0,
    limit: int = 100,
    tenant_id: Optional[str] = None
):
    query = {}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    logs = await db.audit_logs.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    total = await db.audit_logs.count_documents(query)
    
    return {"logs": logs, "total": total}

# Super Admin: Make user super admin
@api_router.post("/admin/make-super-admin/{user_email}")
async def make_super_admin(
    user_email: str,
    current_user: Dict = Depends(get_super_admin)
):
    user = await db.users.find_one({"email": user_email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"email": user_email},
        {"$set": {"is_super_admin": True}}
    )
    return {"message": f"User {user_email} is now a super admin"}

# ==================== CMS/PAGES ENDPOINTS ====================

class PageCreate(BaseModel):
    slug: str
    title: str
    content: str
    is_published: bool = True
    meta_description: Optional[str] = None

class Page(PageCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Public: Get page by slug
@api_router.get("/pages/{slug}")
async def get_page(slug: str):
    page = await db.pages.find_one({"slug": slug, "is_published": True}, {"_id": 0})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page

# Super Admin: Get all pages
@api_router.get("/admin/pages")
async def admin_get_pages(current_user: Dict = Depends(get_super_admin)):
    pages = await db.pages.find({}, {"_id": 0}).sort("slug", 1).to_list(100)
    return pages

# Super Admin: Create page
@api_router.post("/admin/pages")
async def admin_create_page(page: PageCreate, current_user: Dict = Depends(get_super_admin)):
    # Check if slug already exists
    existing = await db.pages.find_one({"slug": page.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Page with this slug already exists")
    
    page_dict = page.model_dump()
    page_dict["id"] = str(uuid.uuid4())
    page_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    page_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.pages.insert_one(page_dict)
    return {**page_dict, "_id": None}

# Super Admin: Update page
@api_router.put("/admin/pages/{page_id}")
async def admin_update_page(page_id: str, page: PageCreate, current_user: Dict = Depends(get_super_admin)):
    existing = await db.pages.find_one({"id": page_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # Check if new slug conflicts with another page
    if page.slug != existing.get("slug"):
        slug_conflict = await db.pages.find_one({"slug": page.slug, "id": {"$ne": page_id}})
        if slug_conflict:
            raise HTTPException(status_code=400, detail="Page with this slug already exists")
    
    update_data = page.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.pages.update_one({"id": page_id}, {"$set": update_data})
    return {"message": "Page updated"}

# Super Admin: Delete page
@api_router.delete("/admin/pages/{page_id}")
async def admin_delete_page(page_id: str, current_user: Dict = Depends(get_super_admin)):
    result = await db.pages.delete_one({"id": page_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Page not found")
    return {"message": "Page deleted"}

# Initialize default pages
async def init_default_pages():
    count = await db.pages.count_documents({})
    if count == 0:
        default_pages = [
            {
                "id": str(uuid.uuid4()),
                "slug": "privacy-policy",
                "title": "Privacy Policy",
                "content": """# Privacy Policy

Last updated: February 2026

## Introduction
WarmReach ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information.

## Information We Collect
- **Account Information**: Email, name, company details
- **Contact Data**: Contacts you upload for outreach
- **Usage Data**: How you use our platform

## How We Use Your Information
- To provide and improve our services
- To send messages on your behalf
- To communicate with you about your account

## Data Security
We implement appropriate security measures to protect your data.

## Contact Us
For privacy-related questions, contact us at support@warmreach.in""",
                "is_published": True,
                "meta_description": "WarmReach Privacy Policy",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "slug": "terms-of-service",
                "title": "Terms of Service",
                "content": """# Terms of Service

Last updated: February 2026

## Acceptance of Terms
By using WarmReach, you agree to these terms.

## Service Description
WarmReach provides automated outreach services for businesses.

## User Responsibilities
- Maintain accurate contact information
- Comply with applicable laws
- Not use the service for spam

## Limitations
We are not liable for any indirect damages.

## Changes to Terms
We may update these terms periodically.

## Contact
Questions? Email us at support@warmreach.in""",
                "is_published": True,
                "meta_description": "WarmReach Terms of Service",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "slug": "contact",
                "title": "Contact Us",
                "content": """# Contact Us

We'd love to hear from you!

## Get in Touch

**Email**: support@warmreach.in

**Address**: Mumbai, India

## Business Hours
Monday - Friday: 9:00 AM - 6:00 PM IST

## Response Time
We typically respond within 24 hours.""",
                "is_published": True,
                "meta_description": "Contact WarmReach",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        await db.pages.insert_many(default_pages)
        logger.info("Default pages created")

# ==================== END CMS ENDPOINTS ====================

# Initialize default plans if none exist
async def init_default_plans():
    count = await db.plans.count_documents({})
    if count == 0:
        default_plans = [
            {
                "id": str(uuid.uuid4()),
                "name": "Starter",
                "description": "Perfect for trying out",
                "price": 0,
                "currency": "INR",
                "billing_cycle": "monthly",
                "messages_per_day": 10,
                "contacts_limit": 50,
                "channels": ["whatsapp"],
                "features": ["10 messages/day", "50 contacts", "WhatsApp only", "Basic templates"],
                "is_popular": False,
                "is_active": True,
                "sort_order": 1,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Professional",
                "description": "For growing businesses",
                "price": 2999,
                "currency": "INR",
                "billing_cycle": "monthly",
                "messages_per_day": 50,
                "contacts_limit": 500,
                "channels": ["whatsapp", "email"],
                "features": ["50 messages/day", "500 contacts", "WhatsApp + Email", "AI personalization", "Custom blueprints", "Priority support"],
                "is_popular": True,
                "is_active": True,
                "sort_order": 2,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Enterprise",
                "description": "For large organizations",
                "price": 9999,
                "currency": "INR",
                "billing_cycle": "monthly",
                "messages_per_day": 999999,
                "contacts_limit": 999999,
                "channels": ["whatsapp", "email", "linkedin"],
                "features": ["Unlimited messages", "Unlimited contacts", "All channels", "API access", "Dedicated support", "Custom integrations"],
                "is_popular": False,
                "is_active": True,
                "sort_order": 3,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        await db.plans.insert_many(default_plans)
        logger.info("Default plans created")

# ==================== END SUPER ADMIN ENDPOINTS ====================

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

# CORS Configuration with WarmReach IP
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')
# Add WarmReach production IP to allowed origins
WARMREACH_ORIGINS = [
    "http://65.20.80.78",
    "https://65.20.80.78",
    "http://65.20.80.78:3000",
    "http://65.20.80.78:8001",
]
# Combine origins
all_origins = list(set(CORS_ORIGINS + WARMREACH_ORIGINS))

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=all_origins if '*' not in all_origins else ['*'],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize default data on startup"""
    await init_default_plans()
    await init_default_pages()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
