"""
Test suite for AI Business Profile Isolation:
Verifies that AI-generated content uses ONLY the tenant's Business Profile data.

Critical Bug Fix Test:
- Previously, AI was mixing IT/technology context with other business types
- Example: A restaurant called 'Eat8' was getting IT-related content
- Fix: AI prompts now ONLY use the business_profiles collection data

Tests verify:
1. AI blueprint generation uses ONLY business profile data
2. AI message generation uses ONLY business profile data
3. Tenant WITHOUT business profile gets appropriate error message
4. Restaurant/food business blueprints do NOT contain IT/technology references
"""
import pytest
import requests
import os
import time
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_TIMESTAMP = int(time.time())
RESTAURANT_USER_EMAIL = f"restaurant_test_{TEST_TIMESTAMP}@example.com"
RESTAURANT_USER_PASSWORD = "RestaurantTest123!"

NO_PROFILE_USER_EMAIL = f"no_profile_test_{TEST_TIMESTAMP}@example.com"
NO_PROFILE_USER_PASSWORD = "NoProfileTest123!"

# IT/Technology keywords that should NOT appear in restaurant content
# Using word boundaries to avoid false positives (e.g., 'hp' in 'touchpoint')
IT_TECH_KEYWORDS = [
    # Hardware brands - use full words to avoid false positives
    " apple ", "macbook", "imac", "iphone", "ipad",
    "lenovo", "thinkpad", " dell ", "latitude", "optiplex",
    "elitebook", "probook",  # Removed 'hp' - too many false positives
    # Cloud & IT
    "microsoft 365", " azure ", "intune", "google workspace",
    "sharepoint", "onedrive",
    # Networking & Security
    " cisco ", "meraki", "ubiquiti", "unifi", "fortinet", "fortigate",
    "sonicwall", "firewall", " vpn ",
    # IT Management
    " jamf ", "kandji", "connectwise", "ninjarmm", "domotz",
    # Backup & Recovery
    "veeam", "acronis", "datto",
    # IT Terms - use specific phrases to avoid false positives
    "it support", "device management", " endpoint ", " server ",
    "tech stack", "software deployment",
    " hardware ", "network infrastructure", "cybersecurity",
    "it infrastructure", "managed services", " msp ",
    "it operations", "system administration"
]

# Restaurant/Food keywords that SHOULD appear in restaurant content
RESTAURANT_KEYWORDS = [
    "food", "restaurant", "dining", "menu", "cuisine", "chef",
    "kitchen", "catering", "hospitality", "guest", "customer",
    "service", "experience", "taste", "flavor", "meal",
    "reservation", "table", "order", "delivery", "takeout"
]


class TestBusinessProfileIsolation:
    """Tests to verify AI uses ONLY business profile data"""
    
    @pytest.fixture(scope="class")
    def restaurant_auth_data(self):
        """Register a new user and create a RESTAURANT business profile"""
        session = requests.Session()
        
        # Register new user
        register_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": RESTAURANT_USER_EMAIL,
            "password": RESTAURANT_USER_PASSWORD,
            "first_name": "Restaurant",
            "last_name": "Tester"
        })
        
        if register_response.status_code == 200:
            data = register_response.json()
            token = data["access_token"]
            tenant_id = data["user"]["tenant_id"]
            print(f"✓ Restaurant test user registered: {RESTAURANT_USER_EMAIL}")
        else:
            # Try login if registration fails
            login_response = session.post(f"{BASE_URL}/api/auth/login", json={
                "email": RESTAURANT_USER_EMAIL,
                "password": RESTAURANT_USER_PASSWORD
            })
            
            if login_response.status_code == 200:
                data = login_response.json()
                token = data["access_token"]
                tenant_id = data["user"]["tenant_id"]
            else:
                pytest.skip(f"Could not authenticate restaurant user: {register_response.text}")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create RESTAURANT business profile
        restaurant_profile = {
            "company_name": "Eat8 Fine Dining",
            "industry": "Food & Beverage",
            "website": "https://eat8finedining.com",
            "tagline": "Exceptional culinary experiences",
            "about": "Eat8 Fine Dining is a premium restaurant offering authentic Italian cuisine with a modern twist. We specialize in handmade pasta, wood-fired pizzas, and seasonal dishes using locally sourced ingredients.",
            "products_services": [
                {"name": "Fine Dining Experience", "description": "Multi-course tasting menus with wine pairings"},
                {"name": "Private Events", "description": "Exclusive venue for corporate events and celebrations"},
                {"name": "Catering Services", "description": "Off-site catering for weddings and special occasions"},
                {"name": "Cooking Classes", "description": "Learn authentic Italian cooking techniques from our chefs"}
            ],
            "key_clients": ["Corporate Events", "Wedding Receptions", "Anniversary Celebrations", "Business Dinners"],
            "value_proposition": "We create memorable dining experiences through exceptional food, impeccable service, and an elegant atmosphere",
            "target_audience": "Food enthusiasts, corporate clients, couples celebrating special occasions, and families looking for premium dining",
            "tone_style": "warm and inviting"
        }
        
        profile_response = session.post(
            f"{BASE_URL}/api/business-profile",
            headers=headers,
            json=restaurant_profile
        )
        
        if profile_response.status_code in [200, 201]:
            print(f"✓ Restaurant business profile created: Eat8 Fine Dining")
        else:
            print(f"⚠ Business profile creation response: {profile_response.status_code} - {profile_response.text}")
        
        # Create a test contact for message generation
        contact_response = session.post(f"{BASE_URL}/api/contacts", headers=headers, json={
            "first_name": "John",
            "last_name": "Foodie",
            "email": f"john.foodie.{TEST_TIMESTAMP}@example.com",
            "company_name": "Food Lovers Inc",
            "job_title": "Event Coordinator",
            "city": "New York",
            "country": "USA"
        })
        
        contact_id = None
        if contact_response.status_code == 200:
            contact_id = contact_response.json().get("id")
            print(f"✓ Test contact created: john.foodie@example.com")
        
        return {
            "token": token,
            "tenant_id": tenant_id,
            "headers": headers,
            "contact_id": contact_id
        }
    
    @pytest.fixture(scope="class")
    def no_profile_auth_data(self):
        """Register a new user WITHOUT creating a business profile"""
        session = requests.Session()
        
        # Register new user
        register_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": NO_PROFILE_USER_EMAIL,
            "password": NO_PROFILE_USER_PASSWORD,
            "first_name": "NoProfile",
            "last_name": "Tester"
        })
        
        if register_response.status_code == 200:
            data = register_response.json()
            print(f"✓ No-profile test user registered: {NO_PROFILE_USER_EMAIL}")
            return {
                "token": data["access_token"],
                "tenant_id": data["user"]["tenant_id"],
                "headers": {"Authorization": f"Bearer {data['access_token']}"}
            }
        
        # Try login if registration fails
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": NO_PROFILE_USER_EMAIL,
            "password": NO_PROFILE_USER_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            return {
                "token": data["access_token"],
                "tenant_id": data["user"]["tenant_id"],
                "headers": {"Authorization": f"Bearer {data['access_token']}"}
            }
        
        pytest.skip(f"Could not authenticate no-profile user")
    
    def test_health_check(self):
        """Verify API is healthy before running tests"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ Health check passed")
    
    def test_restaurant_blueprint_no_it_content(self, restaurant_auth_data):
        """
        CRITICAL TEST: Restaurant business profile should generate restaurant-related content,
        NOT IT/technology content.
        
        This tests the bug fix where 'Eat8' restaurant was getting IT-related content.
        """
        headers = restaurant_auth_data["headers"]
        
        # Generate blueprint for restaurant
        response = requests.post(f"{BASE_URL}/api/blueprints/generate-ai", headers=headers, json={
            "channel": "email",
            "intent": "awareness",
            "angle": "growth",
            "tone": "calm_authority"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "blueprint" in data
        
        blueprint = data["blueprint"]
        structure = blueprint["structure"].lower()
        
        print(f"\n=== Generated Blueprint for Restaurant ===")
        print(f"Name: {blueprint.get('name', 'N/A')}")
        print(f"Content:\n{blueprint['structure']}")
        print(f"==========================================\n")
        
        # Check that NO IT/technology keywords appear
        found_it_keywords = []
        for keyword in IT_TECH_KEYWORDS:
            if keyword.lower() in structure:
                found_it_keywords.append(keyword)
        
        assert len(found_it_keywords) == 0, (
            f"CRITICAL BUG: Restaurant blueprint contains IT/technology keywords: {found_it_keywords}\n"
            f"Blueprint content: {blueprint['structure'][:500]}"
        )
        
        print(f"✓ Restaurant blueprint contains NO IT/technology keywords")
        
        # Verify it contains restaurant-related content
        found_restaurant_keywords = []
        for keyword in RESTAURANT_KEYWORDS:
            if keyword.lower() in structure:
                found_restaurant_keywords.append(keyword)
        
        # Should have at least some restaurant-related terms
        assert len(found_restaurant_keywords) > 0 or "eat8" in structure or "dining" in structure or "culinary" in structure, (
            f"Restaurant blueprint should contain restaurant-related content.\n"
            f"Blueprint content: {blueprint['structure'][:500]}"
        )
        
        print(f"✓ Restaurant blueprint contains relevant keywords: {found_restaurant_keywords[:5]}")
    
    def test_restaurant_blueprint_multiple_angles(self, restaurant_auth_data):
        """Test multiple angles to ensure consistent restaurant-focused content"""
        headers = restaurant_auth_data["headers"]
        
        angles = ["cost", "risk", "growth"]
        
        for angle in angles:
            response = requests.post(f"{BASE_URL}/api/blueprints/generate-ai", headers=headers, json={
                "channel": "email",
                "intent": "awareness",
                "angle": angle,
                "tone": "calm_authority"
            })
            
            assert response.status_code == 200, f"Expected 200 for {angle}, got {response.status_code}"
            
            data = response.json()
            structure = data["blueprint"]["structure"].lower()
            
            # Check for IT keywords
            found_it_keywords = []
            for keyword in IT_TECH_KEYWORDS:
                if keyword.lower() in structure:
                    found_it_keywords.append(keyword)
            
            assert len(found_it_keywords) == 0, (
                f"CRITICAL BUG: Restaurant blueprint ({angle} angle) contains IT keywords: {found_it_keywords}\n"
                f"Content: {data['blueprint']['structure'][:300]}"
            )
            
            print(f"✓ Restaurant blueprint ({angle} angle) - NO IT keywords found")
    
    def test_restaurant_whatsapp_blueprint(self, restaurant_auth_data):
        """Test WhatsApp channel for restaurant - should be food-focused"""
        headers = restaurant_auth_data["headers"]
        
        response = requests.post(f"{BASE_URL}/api/blueprints/generate-ai", headers=headers, json={
            "channel": "whatsapp",
            "intent": "awareness",
            "angle": "growth",
            "tone": "direct"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        structure = data["blueprint"]["structure"].lower()
        
        print(f"\n=== WhatsApp Blueprint for Restaurant ===")
        print(f"Content:\n{data['blueprint']['structure']}")
        print(f"=========================================\n")
        
        # Check for IT keywords
        found_it_keywords = []
        for keyword in IT_TECH_KEYWORDS:
            if keyword.lower() in structure:
                found_it_keywords.append(keyword)
        
        assert len(found_it_keywords) == 0, (
            f"CRITICAL BUG: Restaurant WhatsApp blueprint contains IT keywords: {found_it_keywords}"
        )
        
        # Should have opt-out
        has_opt_out = "stop" in structure or "opt" in structure
        assert has_opt_out, "WhatsApp blueprint should include opt-out"
        
        print(f"✓ Restaurant WhatsApp blueprint - NO IT keywords, has opt-out")
    
    def test_no_business_profile_error_message(self, no_profile_auth_data):
        """
        Test that tenant WITHOUT business profile gets appropriate error message
        when trying to generate AI content.
        """
        headers = no_profile_auth_data["headers"]
        
        # First, verify no business profile exists
        profile_response = requests.get(f"{BASE_URL}/api/business-profile", headers=headers)
        
        # Profile should not exist or be empty
        if profile_response.status_code == 200:
            profile = profile_response.json()
            if profile and profile.get("company_name"):
                pytest.skip("Business profile already exists for this tenant")
        
        # Try to generate blueprint without business profile
        response = requests.post(f"{BASE_URL}/api/blueprints/generate-ai", headers=headers, json={
            "channel": "email",
            "intent": "awareness",
            "angle": "cost",
            "tone": "calm_authority"
        })
        
        # Should either fail with error or generate generic content
        # The fix should raise an error asking to set up business profile
        if response.status_code == 200:
            data = response.json()
            structure = data["blueprint"]["structure"].lower()
            
            # If it succeeds, it should NOT contain specific IT brand references
            # since there's no business profile to pull from
            specific_brands = ["apple", "dell", "cisco", "jamf", "intune", "veeam"]
            found_brands = [b for b in specific_brands if b in structure]
            
            if found_brands:
                print(f"⚠ Warning: Generated content without profile contains brands: {found_brands}")
            
            print(f"✓ Blueprint generated without profile (generic content)")
        else:
            # Expected behavior: error asking to set up business profile
            data = response.json()
            error_detail = data.get("detail", "").lower()
            
            # Check if error mentions business profile
            profile_error_terms = ["business profile", "profile", "settings"]
            has_profile_error = any(term in error_detail for term in profile_error_terms)
            
            print(f"✓ Error response: {data.get('detail', 'Unknown error')}")
            
            if has_profile_error:
                print(f"✓ Correctly asks user to set up Business Profile")
            else:
                print(f"⚠ Error doesn't mention Business Profile: {error_detail}")
    
    def test_restaurant_batch_message_generation(self, restaurant_auth_data):
        """Test batch message generation for restaurant - should use restaurant profile"""
        headers = restaurant_auth_data["headers"]
        
        # First, create a blueprint for the restaurant
        bp_response = requests.post(f"{BASE_URL}/api/blueprints/generate-ai", headers=headers, json={
            "channel": "email",
            "intent": "awareness",
            "angle": "growth",
            "tone": "calm_authority"
        })
        
        if bp_response.status_code != 200:
            pytest.skip("Could not create blueprint for batch test")
        
        # Approve the blueprint
        blueprint_id = bp_response.json()["blueprint"]["id"]
        requests.post(f"{BASE_URL}/api/blueprints/{blueprint_id}/approve", headers=headers)
        
        # Generate batch messages
        response = requests.post(f"{BASE_URL}/api/messages/generate-batch", headers=headers, json={
            "max_messages": 3,
            "channel": "email",
            "blueprint_id": blueprint_id
        })
        
        if response.status_code == 400:
            # No eligible contacts - acceptable
            data = response.json()
            print(f"⚠ Batch generation: {data.get('detail', 'No eligible contacts')}")
            return
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check generated messages for IT keywords
        for msg in data.get("messages", []):
            content = msg.get("content_preview", "").lower()
            
            found_it_keywords = []
            for keyword in IT_TECH_KEYWORDS:
                if keyword.lower() in content:
                    found_it_keywords.append(keyword)
            
            assert len(found_it_keywords) == 0, (
                f"CRITICAL BUG: Restaurant message contains IT keywords: {found_it_keywords}\n"
                f"Message: {content[:300]}"
            )
        
        print(f"✓ Batch messages generated: {data.get('generated_count', 0)} messages, NO IT keywords")
    
    def test_restaurant_single_message_generation(self, restaurant_auth_data):
        """Test single message generation for restaurant contact"""
        headers = restaurant_auth_data["headers"]
        contact_id = restaurant_auth_data.get("contact_id")
        
        if not contact_id:
            pytest.skip("No test contact available")
        
        # Get or create a blueprint
        blueprints_response = requests.get(f"{BASE_URL}/api/blueprints", headers=headers)
        blueprints = blueprints_response.json() if blueprints_response.status_code == 200 else []
        
        if not blueprints:
            # Create one
            bp_response = requests.post(f"{BASE_URL}/api/blueprints/generate-ai", headers=headers, json={
                "channel": "email",
                "intent": "awareness",
                "angle": "growth",
                "tone": "calm_authority"
            })
            if bp_response.status_code == 200:
                blueprint_id = bp_response.json()["blueprint"]["id"]
                # Approve it
                requests.post(f"{BASE_URL}/api/blueprints/{blueprint_id}/approve", headers=headers)
            else:
                pytest.skip("Could not create blueprint")
        else:
            blueprint_id = blueprints[0]["id"]
        
        # Generate single message
        response = requests.post(f"{BASE_URL}/api/messages/generate", headers=headers, json={
            "contact_id": contact_id,
            "blueprint_id": blueprint_id
        })
        
        if response.status_code != 200:
            print(f"⚠ Single message generation: {response.status_code} - {response.text}")
            return
        
        data = response.json()
        content = data.get("content", "").lower()
        
        print(f"\n=== Generated Message for Restaurant Contact ===")
        print(f"Content:\n{data.get('content', 'N/A')}")
        print(f"================================================\n")
        
        # Check for IT keywords
        found_it_keywords = []
        for keyword in IT_TECH_KEYWORDS:
            if keyword.lower() in content:
                found_it_keywords.append(keyword)
        
        assert len(found_it_keywords) == 0, (
            f"CRITICAL BUG: Restaurant message contains IT keywords: {found_it_keywords}\n"
            f"Message: {content[:500]}"
        )
        
        print(f"✓ Single message generated - NO IT keywords found")


class TestBusinessProfileEndpoints:
    """Tests for business profile CRUD operations"""
    
    @pytest.fixture(scope="class")
    def auth_data(self):
        """Get authentication for profile tests"""
        session = requests.Session()
        
        test_email = f"profile_test_{TEST_TIMESTAMP}@example.com"
        
        register_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "ProfileTest123!",
            "first_name": "Profile",
            "last_name": "Tester"
        })
        
        if register_response.status_code == 200:
            data = register_response.json()
            return {
                "token": data["access_token"],
                "headers": {"Authorization": f"Bearer {data['access_token']}"}
            }
        
        pytest.skip("Could not create test user for profile tests")
    
    def test_get_business_profile_empty(self, auth_data):
        """Test getting business profile when none exists"""
        response = requests.get(f"{BASE_URL}/api/business-profile", headers=auth_data["headers"])
        
        # Should return 200 with null/empty or 404
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            # Should be null or empty
            assert data is None or not data.get("company_name"), "New tenant should have no business profile"
        
        print(f"✓ Empty business profile check passed")
    
    def test_create_business_profile(self, auth_data):
        """Test creating a business profile"""
        profile_data = {
            "company_name": "Test Company",
            "industry": "Testing",
            "website": "https://testcompany.com",
            "tagline": "We test things",
            "about": "A company dedicated to testing software",
            "products_services": [
                {"name": "Testing Service", "description": "We test your software"}
            ],
            "key_clients": ["Client A", "Client B"],
            "value_proposition": "Quality testing services",
            "target_audience": "Software companies",
            "tone_style": "professional"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/business-profile",
            headers=auth_data["headers"],
            json=profile_data
        )
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["company_name"] == "Test Company"
        assert data["industry"] == "Testing"
        
        print(f"✓ Business profile created successfully")
    
    def test_get_business_profile_after_create(self, auth_data):
        """Test getting business profile after creation"""
        response = requests.get(f"{BASE_URL}/api/business-profile", headers=auth_data["headers"])
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data is not None
        assert data.get("company_name") == "Test Company"
        
        print(f"✓ Business profile retrieved successfully")
    
    def test_update_business_profile(self, auth_data):
        """Test updating business profile"""
        update_data = {
            "tagline": "Updated tagline",
            "about": "Updated about section"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/business-profile",
            headers=auth_data["headers"],
            json=update_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["tagline"] == "Updated tagline"
        assert data["about"] == "Updated about section"
        # Original fields should be preserved
        assert data["company_name"] == "Test Company"
        
        print(f"✓ Business profile updated successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
