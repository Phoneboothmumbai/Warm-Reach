"""
Background Scheduler for WarmReach
Automatically sends scheduled messages when their time is due.
"""
import asyncio
import logging
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import httpx
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("scheduler")

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'warmreach_db')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# WhatsApp Web Service URL
WA_WEB_SERVICE_URL = os.environ.get('WA_WEB_SERVICE_URL', 'http://localhost:3001')

async def send_whatsapp_message(tenant_id: str, phone: str, message: str) -> dict:
    """Send message via WhatsApp Web service"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{WA_WEB_SERVICE_URL}/session/{tenant_id}/send",
                json={"to_phone": phone, "message": message}
            )
            if response.status_code == 200:
                return {"success": True, "data": response.json()}
            else:
                return {"success": False, "error": response.text}
    except Exception as e:
        logger.error(f"WhatsApp send error: {e}")
        return {"success": False, "error": str(e)}

async def send_email_message(tenant_id: str, email: str, subject: str, message: str) -> dict:
    """Send message via Email (placeholder - needs AWS SES integration)"""
    # TODO: Implement AWS SES integration
    logger.warning(f"Email sending not implemented yet. Would send to {email}")
    return {"success": False, "error": "Email integration not configured"}

async def process_scheduled_messages():
    """Process all messages that are due to be sent"""
    now = datetime.now(timezone.utc)
    logger.info(f"Checking for scheduled messages at {now.isoformat()}")
    
    # Find all scheduled messages that are due
    due_messages = await db.messages.find({
        "status": "scheduled",
        "scheduled_at": {"$lte": now.isoformat()}
    }).to_list(100)
    
    logger.info(f"Found {len(due_messages)} messages due for sending")
    
    for message in due_messages:
        message_id = message.get("id")
        tenant_id = message.get("tenant_id")
        contact_id = message.get("contact_id")
        channel = message.get("channel")
        content = message.get("content")
        
        logger.info(f"Processing message {message_id} for channel {channel}")
        
        # Get contact details
        contact = await db.contacts.find_one(
            {"id": contact_id, "tenant_id": tenant_id},
            {"_id": 0}
        )
        
        if not contact:
            logger.error(f"Contact {contact_id} not found for message {message_id}")
            await db.messages.update_one(
                {"id": message_id},
                {"$set": {
                    "status": "failed",
                    "error_message": "Contact not found"
                }}
            )
            continue
        
        # Send based on channel
        result = {"success": False, "error": "Unknown channel"}
        
        if channel == "whatsapp":
            phone = contact.get("phone")
            if not phone:
                result = {"success": False, "error": "Contact has no phone number"}
            else:
                result = await send_whatsapp_message(tenant_id, phone, content)
                
        elif channel == "email":
            email = contact.get("email")
            if not email:
                result = {"success": False, "error": "Contact has no email"}
            else:
                # Extract subject from first line or use default
                lines = content.split('\n')
                subject = f"Message from WarmReach"
                result = await send_email_message(tenant_id, email, subject, content)
                
        elif channel == "linkedin":
            # LinkedIn requires manual posting or API integration
            result = {"success": False, "error": "LinkedIn auto-send not implemented"}
        
        # Update message status
        if result.get("success"):
            await db.messages.update_one(
                {"id": message_id},
                {"$set": {
                    "status": "sent",
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                    "error_message": None
                }}
            )
            
            # Update contact's last_contacted
            await db.contacts.update_one(
                {"id": contact_id},
                {"$set": {
                    f"last_contacted.{channel}": datetime.now(timezone.utc).isoformat(),
                    "status": "contacted"
                }}
            )
            
            logger.info(f"Message {message_id} sent successfully")
        else:
            await db.messages.update_one(
                {"id": message_id},
                {"$set": {
                    "status": "failed",
                    "error_message": result.get("error", "Unknown error")
                }}
            )
            logger.error(f"Message {message_id} failed: {result.get('error')}")

async def run_scheduler():
    """Main scheduler loop - runs every 60 seconds"""
    logger.info("Starting WarmReach Scheduler")
    while True:
        try:
            await process_scheduled_messages()
        except Exception as e:
            logger.error(f"Scheduler error: {e}")
        
        # Wait 60 seconds before next check
        await asyncio.sleep(60)

if __name__ == "__main__":
    asyncio.run(run_scheduler())
