"""
Test suite for WhatsApp Cloud API Phase 1 features:
1. POST /api/wa/cloud/send - Send message via Cloud API
2. GET /api/wa/cloud/inbox - Get Cloud API inbox contacts
3. GET /api/wa/cloud/chat/{contact_id} - Get chat messages for a contact
4. GET /api/whatsapp/webhook - Webhook verification endpoint
5. POST /api/whatsapp/webhook - Webhook for receiving messages
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "watest@example.com"
TEST_USER_PASSWORD = "Test123!"
WEBHOOK_VERIFY_TOKEN = "warmreach_webhook_token"


class TestAuthSetup:
    """Setup tests - ensure user exists and can login"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        session = requests.Session()
        
        # Try register first
        register_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "first_name": "WhatsApp",
            "last_name": "Tester"
        })
        
        if register_response.status_code == 200:
            return register_response.json()["access_token"]
        
        # Login if registration fails
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        if login_response.status_code == 200:
            return login_response.json()["access_token"]
        
        pytest.skip("Could not authenticate user")
    
    def test_health_check(self):
        """Verify API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ Health check passed: {data}")


class TestWACloudSendEndpoint:
    """Tests for POST /api/wa/cloud/send endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        session = requests.Session()
        
        register_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "first_name": "WhatsApp",
            "last_name": "Tester"
        })
        
        if register_response.status_code == 200:
            return register_response.json()["access_token"]
        
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        if login_response.status_code == 200:
            return login_response.json()["access_token"]
        
        pytest.skip("Could not authenticate user")
    
    def test_wa_cloud_send_requires_auth(self):
        """Test that POST /wa/cloud/send requires authentication"""
        response = requests.post(f"{BASE_URL}/api/wa/cloud/send", json={
            "to_phone": "+1234567890",
            "message": "Test message"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ POST /wa/cloud/send requires authentication")
    
    def test_wa_cloud_send_requires_configuration(self, auth_token):
        """Test that POST /wa/cloud/send fails when WhatsApp is not configured"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First ensure WhatsApp is not configured by deleting any existing config
        requests.delete(f"{BASE_URL}/api/settings/whatsapp", headers=headers)
        
        # Try to send message without configuration
        response = requests.post(f"{BASE_URL}/api/wa/cloud/send", headers=headers, json={
            "to_phone": "+1234567890",
            "message": "Test message"
        })
        
        assert response.status_code == 400, f"Expected 400 when not configured, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "not configured" in data.get("detail", "").lower() or "settings" in data.get("detail", "").lower(), f"Error should mention configuration: {data}"
        
        print(f"✓ POST /wa/cloud/send requires configuration: {data['detail']}")
    
    def test_wa_cloud_send_validates_request_body(self, auth_token):
        """Test that POST /wa/cloud/send validates request body"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Missing to_phone
        response = requests.post(f"{BASE_URL}/api/wa/cloud/send", headers=headers, json={
            "message": "Test message"
        })
        assert response.status_code == 422, f"Expected 422 for missing to_phone, got {response.status_code}"
        
        # Missing message
        response = requests.post(f"{BASE_URL}/api/wa/cloud/send", headers=headers, json={
            "to_phone": "+1234567890"
        })
        assert response.status_code == 422, f"Expected 422 for missing message, got {response.status_code}"
        
        print("✓ POST /wa/cloud/send validates request body")


class TestWACloudInboxEndpoint:
    """Tests for GET /api/wa/cloud/inbox endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        session = requests.Session()
        
        register_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "first_name": "WhatsApp",
            "last_name": "Tester"
        })
        
        if register_response.status_code == 200:
            return register_response.json()["access_token"]
        
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        if login_response.status_code == 200:
            return login_response.json()["access_token"]
        
        pytest.skip("Could not authenticate user")
    
    def test_wa_cloud_inbox_requires_auth(self):
        """Test that GET /wa/cloud/inbox requires authentication"""
        response = requests.get(f"{BASE_URL}/api/wa/cloud/inbox")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ GET /wa/cloud/inbox requires authentication")
    
    def test_wa_cloud_inbox_returns_structure(self, auth_token):
        """Test that GET /wa/cloud/inbox returns correct structure"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/wa/cloud/inbox", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "contacts" in data, "Response should have 'contacts' field"
        assert "connected_number" in data, "Response should have 'connected_number' field"
        assert "integration_type" in data, "Response should have 'integration_type' field"
        assert data["integration_type"] == "cloud_api", f"integration_type should be 'cloud_api', got {data['integration_type']}"
        assert isinstance(data["contacts"], list), "contacts should be a list"
        
        print(f"✓ GET /wa/cloud/inbox returns correct structure: {data}")
    
    def test_wa_cloud_inbox_pagination(self, auth_token):
        """Test that GET /wa/cloud/inbox supports pagination"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Test with skip and limit parameters
        response = requests.get(f"{BASE_URL}/api/wa/cloud/inbox?skip=0&limit=10", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "contacts" in data
        
        print("✓ GET /wa/cloud/inbox supports pagination")


class TestWACloudChatEndpoint:
    """Tests for GET /api/wa/cloud/chat/{contact_id} endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        session = requests.Session()
        
        register_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "first_name": "WhatsApp",
            "last_name": "Tester"
        })
        
        if register_response.status_code == 200:
            return register_response.json()["access_token"]
        
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        if login_response.status_code == 200:
            return login_response.json()["access_token"]
        
        pytest.skip("Could not authenticate user")
    
    def test_wa_cloud_chat_requires_auth(self):
        """Test that GET /wa/cloud/chat/{contact_id} requires authentication"""
        response = requests.get(f"{BASE_URL}/api/wa/cloud/chat/test-contact-id")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ GET /wa/cloud/chat/{contact_id} requires authentication")
    
    def test_wa_cloud_chat_not_found(self, auth_token):
        """Test that GET /wa/cloud/chat/{contact_id} returns 404 for non-existent contact"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/wa/cloud/chat/non-existent-contact-id", headers=headers)
        
        assert response.status_code == 404, f"Expected 404 for non-existent contact, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data, "Error response should have detail field"
        
        print(f"✓ GET /wa/cloud/chat returns 404 for non-existent contact: {data['detail']}")


class TestWhatsAppWebhookVerification:
    """Tests for GET /api/whatsapp/webhook - Webhook verification endpoint"""
    
    def test_webhook_verification_success(self):
        """Test successful webhook verification with correct token"""
        params = {
            "hub.mode": "subscribe",
            "hub.verify_token": WEBHOOK_VERIFY_TOKEN,
            "hub.challenge": "test_challenge_12345"
        }
        
        response = requests.get(f"{BASE_URL}/api/whatsapp/webhook", params=params)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # The response should be the challenge string as plain text
        assert response.text == "test_challenge_12345", f"Expected challenge string, got: {response.text}"
        
        print("✓ Webhook verification succeeds with correct token")
    
    def test_webhook_verification_wrong_token(self):
        """Test webhook verification fails with wrong token"""
        params = {
            "hub.mode": "subscribe",
            "hub.verify_token": "wrong_token",
            "hub.challenge": "test_challenge_12345"
        }
        
        response = requests.get(f"{BASE_URL}/api/whatsapp/webhook", params=params)
        
        assert response.status_code == 403, f"Expected 403 for wrong token, got {response.status_code}: {response.text}"
        
        print("✓ Webhook verification fails with wrong token")
    
    def test_webhook_verification_wrong_mode(self):
        """Test webhook verification fails with wrong mode"""
        params = {
            "hub.mode": "unsubscribe",  # Wrong mode
            "hub.verify_token": WEBHOOK_VERIFY_TOKEN,
            "hub.challenge": "test_challenge_12345"
        }
        
        response = requests.get(f"{BASE_URL}/api/whatsapp/webhook", params=params)
        
        assert response.status_code == 403, f"Expected 403 for wrong mode, got {response.status_code}: {response.text}"
        
        print("✓ Webhook verification fails with wrong mode")
    
    def test_webhook_verification_missing_params(self):
        """Test webhook verification fails with missing parameters"""
        # Missing hub.mode
        params = {
            "hub.verify_token": WEBHOOK_VERIFY_TOKEN,
            "hub.challenge": "test_challenge_12345"
        }
        
        response = requests.get(f"{BASE_URL}/api/whatsapp/webhook", params=params)
        
        assert response.status_code == 403, f"Expected 403 for missing mode, got {response.status_code}"
        
        print("✓ Webhook verification fails with missing parameters")


class TestWhatsAppWebhookReceive:
    """Tests for POST /api/whatsapp/webhook - Webhook for receiving messages"""
    
    def test_webhook_receive_valid_payload(self):
        """Test webhook receives valid WhatsApp payload"""
        payload = {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "id": "123456789",
                    "changes": [
                        {
                            "value": {
                                "messaging_product": "whatsapp",
                                "metadata": {
                                    "display_phone_number": "15551234567",
                                    "phone_number_id": "123456789"
                                },
                                "statuses": [
                                    {
                                        "id": "wamid.test123",
                                        "status": "delivered",
                                        "timestamp": "1234567890",
                                        "recipient_id": "15559876543"
                                    }
                                ]
                            },
                            "field": "messages"
                        }
                    ]
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/whatsapp/webhook", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "ok", f"Expected status 'ok', got: {data}"
        
        print("✓ Webhook receives valid WhatsApp payload")
    
    def test_webhook_receive_incoming_message(self):
        """Test webhook receives incoming message payload"""
        payload = {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "id": "123456789",
                    "changes": [
                        {
                            "value": {
                                "messaging_product": "whatsapp",
                                "metadata": {
                                    "display_phone_number": "15551234567",
                                    "phone_number_id": "123456789"
                                },
                                "messages": [
                                    {
                                        "from": "15559876543",
                                        "id": "wamid.incoming123",
                                        "timestamp": "1234567890",
                                        "type": "text",
                                        "text": {
                                            "body": "Hello, this is a test reply"
                                        }
                                    }
                                ]
                            },
                            "field": "messages"
                        }
                    ]
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/whatsapp/webhook", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") in ["ok", "error"], f"Expected status 'ok' or 'error', got: {data}"
        
        print("✓ Webhook receives incoming message payload")
    
    def test_webhook_receive_empty_payload(self):
        """Test webhook handles empty payload gracefully"""
        payload = {}
        
        response = requests.post(f"{BASE_URL}/api/whatsapp/webhook", json=payload)
        
        # Should return 200 to acknowledge receipt (Meta will retry on failures)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        print("✓ Webhook handles empty payload gracefully")
    
    def test_webhook_receive_non_whatsapp_object(self):
        """Test webhook handles non-WhatsApp object type"""
        payload = {
            "object": "instagram",  # Not whatsapp_business_account
            "entry": []
        }
        
        response = requests.post(f"{BASE_URL}/api/whatsapp/webhook", json=payload)
        
        # Should return 200 to acknowledge receipt
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        print("✓ Webhook handles non-WhatsApp object type")


class TestLegacyWhatsAppEndpoint:
    """Tests for legacy POST /api/whatsapp/send endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        session = requests.Session()
        
        register_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "first_name": "WhatsApp",
            "last_name": "Tester"
        })
        
        if register_response.status_code == 200:
            return register_response.json()["access_token"]
        
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        if login_response.status_code == 200:
            return login_response.json()["access_token"]
        
        pytest.skip("Could not authenticate user")
    
    def test_legacy_whatsapp_send_requires_auth(self):
        """Test that legacy POST /whatsapp/send requires authentication"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/send", json={
            "to_phone": "+1234567890",
            "message": "Test message"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Legacy POST /whatsapp/send requires authentication")
    
    def test_legacy_whatsapp_send_requires_configuration(self, auth_token):
        """Test that legacy POST /whatsapp/send fails when WhatsApp is not configured"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First ensure WhatsApp is not configured
        requests.delete(f"{BASE_URL}/api/settings/whatsapp", headers=headers)
        
        # Try to send message without configuration
        response = requests.post(f"{BASE_URL}/api/whatsapp/send", headers=headers, json={
            "to_phone": "+1234567890",
            "message": "Test message"
        })
        
        assert response.status_code == 400, f"Expected 400 when not configured, got {response.status_code}: {response.text}"
        
        print("✓ Legacy POST /whatsapp/send requires configuration")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
