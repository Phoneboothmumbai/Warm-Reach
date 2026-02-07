"""
Test suite for new features:
1. CSV Template Download for Blueprints (/api/blueprints/import/template)
2. WhatsApp Settings CRUD (/api/settings/whatsapp)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "watest@example.com"
TEST_USER_PASSWORD = "Test123!"


class TestSetup:
    """Setup tests - ensure user exists and can login"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create a requests session"""
        return requests.Session()
    
    def test_health_check(self, session):
        """Verify API is healthy"""
        response = session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ Health check passed: {data}")
    
    def test_register_or_login_user(self, session):
        """Register test user or login if exists"""
        # Try to register first
        register_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "first_name": "WhatsApp",
            "last_name": "Tester"
        })
        
        if register_response.status_code == 200:
            data = register_response.json()
            assert "access_token" in data
            print(f"✓ User registered successfully: {data['user']['email']}")
            return data
        
        # If registration fails (user exists), try login
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        data = login_response.json()
        assert "access_token" in data
        print(f"✓ User logged in successfully: {data['user']['email']}")
        return data


class TestBlueprintCSVTemplate:
    """Tests for CSV Template Download endpoint"""
    
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
    
    def test_csv_template_download_requires_auth(self):
        """Test that CSV template endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/blueprints/import/template")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ CSV template endpoint requires authentication")
    
    def test_csv_template_download_success(self, auth_token):
        """Test successful CSV template download"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/blueprints/import/template", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Check content type is CSV
        content_type = response.headers.get("content-type", "")
        assert "text/csv" in content_type or "application/octet-stream" in content_type, f"Unexpected content type: {content_type}"
        
        # Check content disposition header for filename
        content_disposition = response.headers.get("content-disposition", "")
        assert "attachment" in content_disposition.lower() or "filename" in content_disposition.lower(), f"Missing attachment header: {content_disposition}"
        
        print(f"✓ CSV template downloaded successfully")
        print(f"  Content-Type: {content_type}")
        print(f"  Content-Disposition: {content_disposition}")
    
    def test_csv_template_content_structure(self, auth_token):
        """Test that CSV template has correct structure and sample data"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/blueprints/import/template", headers=headers)
        
        assert response.status_code == 200
        
        content = response.text
        lines = content.strip().split('\n')
        
        # Check header row
        header = lines[0]
        required_columns = ["name", "channel", "intent", "angle", "tone", "structure"]
        for col in required_columns:
            assert col in header.lower(), f"Missing required column: {col}"
        
        # Check that there are sample data rows (at least 1 sample blueprint)
        assert len(lines) > 1, "CSV should have sample data rows"
        
        print(f"✓ CSV template has correct structure")
        print(f"  Header: {header}")
        print(f"  Sample rows: {len(lines) - 1}")
    
    def test_csv_template_sample_blueprints(self, auth_token):
        """Test that CSV template contains valid sample blueprints"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/blueprints/import/template", headers=headers)
        
        assert response.status_code == 200
        
        content = response.text
        
        # Check for expected sample content
        assert "email" in content.lower(), "Should have email channel sample"
        assert "whatsapp" in content.lower(), "Should have whatsapp channel sample"
        assert "{{first_name}}" in content, "Should have placeholder variables"
        assert "{{company_name}}" in content, "Should have company_name placeholder"
        
        print("✓ CSV template contains valid sample blueprints with placeholders")


class TestWhatsAppSettings:
    """Tests for WhatsApp Settings CRUD endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for owner user"""
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
    
    def test_get_whatsapp_settings_requires_auth(self):
        """Test that GET /settings/whatsapp requires authentication"""
        response = requests.get(f"{BASE_URL}/api/settings/whatsapp")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ GET /settings/whatsapp requires authentication")
    
    def test_get_whatsapp_settings_default_unconfigured(self, auth_token):
        """Test that WhatsApp settings return is_configured: false by default"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/settings/whatsapp", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Note: is_configured could be true if previously configured
        assert "is_configured" in data, "Response should have is_configured field"
        
        print(f"✓ GET /settings/whatsapp returns: {data}")
    
    def test_post_whatsapp_settings_requires_auth(self):
        """Test that POST /settings/whatsapp requires authentication"""
        response = requests.post(f"{BASE_URL}/api/settings/whatsapp", json={
            "phone_number_id": "123456789",
            "access_token": "test_token"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ POST /settings/whatsapp requires authentication")
    
    def test_post_whatsapp_settings_validates_credentials(self, auth_token):
        """Test that POST /settings/whatsapp validates credentials with Meta API"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Send invalid credentials - should fail validation
        response = requests.post(f"{BASE_URL}/api/settings/whatsapp", headers=headers, json={
            "phone_number_id": "invalid_phone_id_12345",
            "access_token": "invalid_access_token_xyz"
        })
        
        # Should return 400 because credentials are invalid
        assert response.status_code == 400, f"Expected 400 for invalid credentials, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data, "Error response should have detail field"
        assert "validation" in data["detail"].lower() or "failed" in data["detail"].lower() or "invalid" in data["detail"].lower(), f"Error should mention validation failure: {data['detail']}"
        
        print(f"✓ POST /settings/whatsapp validates credentials: {data['detail']}")
    
    def test_post_whatsapp_settings_requires_fields(self, auth_token):
        """Test that POST /settings/whatsapp requires phone_number_id and access_token"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Missing phone_number_id
        response = requests.post(f"{BASE_URL}/api/settings/whatsapp", headers=headers, json={
            "access_token": "test_token"
        })
        assert response.status_code == 422, f"Expected 422 for missing field, got {response.status_code}"
        
        # Missing access_token
        response = requests.post(f"{BASE_URL}/api/settings/whatsapp", headers=headers, json={
            "phone_number_id": "123456789"
        })
        assert response.status_code == 422, f"Expected 422 for missing field, got {response.status_code}"
        
        print("✓ POST /settings/whatsapp requires both phone_number_id and access_token")
    
    def test_delete_whatsapp_settings_requires_auth(self):
        """Test that DELETE /settings/whatsapp requires authentication"""
        response = requests.delete(f"{BASE_URL}/api/settings/whatsapp")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ DELETE /settings/whatsapp requires authentication")
    
    def test_delete_whatsapp_settings_not_found(self, auth_token):
        """Test DELETE /settings/whatsapp returns 404 when not configured"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First check if configured
        get_response = requests.get(f"{BASE_URL}/api/settings/whatsapp", headers=headers)
        if get_response.status_code == 200:
            data = get_response.json()
            if data.get("is_configured"):
                # If configured, delete should succeed
                response = requests.delete(f"{BASE_URL}/api/settings/whatsapp", headers=headers)
                assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
                print("✓ DELETE /settings/whatsapp handled correctly (was configured)")
                return
        
        # If not configured, should return 404
        response = requests.delete(f"{BASE_URL}/api/settings/whatsapp", headers=headers)
        assert response.status_code == 404, f"Expected 404 when not configured, got {response.status_code}: {response.text}"
        print("✓ DELETE /settings/whatsapp returns 404 when not configured")


class TestWhatsAppSendEndpoint:
    """Tests for WhatsApp Send Message endpoint"""
    
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
    
    def test_whatsapp_send_requires_auth(self):
        """Test that POST /whatsapp/send requires authentication"""
        response = requests.post(f"{BASE_URL}/api/whatsapp/send", json={
            "to_phone": "+1234567890",
            "message": "Test message"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ POST /whatsapp/send requires authentication")
    
    def test_whatsapp_send_requires_configuration(self, auth_token):
        """Test that POST /whatsapp/send fails when WhatsApp is not configured"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First ensure WhatsApp is not configured
        get_response = requests.get(f"{BASE_URL}/api/settings/whatsapp", headers=headers)
        if get_response.status_code == 200:
            data = get_response.json()
            if data.get("is_configured"):
                # Delete configuration first
                requests.delete(f"{BASE_URL}/api/settings/whatsapp", headers=headers)
        
        # Try to send message without configuration
        response = requests.post(f"{BASE_URL}/api/whatsapp/send", headers=headers, json={
            "to_phone": "+1234567890",
            "message": "Test message"
        })
        
        assert response.status_code == 400, f"Expected 400 when not configured, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "not configured" in data.get("detail", "").lower() or "settings" in data.get("detail", "").lower(), f"Error should mention configuration: {data}"
        
        print(f"✓ POST /whatsapp/send requires configuration: {data['detail']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
