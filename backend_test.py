#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class WarmReachAPITester:
    def __init__(self, base_url: str = "https://warmreach.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tenant_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.created_contact_id = None
        self.created_blueprint_id = None
        self.created_message_id = None

    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}")
        else:
            print(f"❌ {test_name} - {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    expected_status: int = 200, auth_required: bool = True) -> tuple[bool, Dict]:
        """Make API request with error handling"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            try:
                response_data = response.json() if response.content else {}
            except:
                response_data = {"raw_response": response.text}
                
            if not success:
                response_data["status_code"] = response.status_code
                
            return success, response_data
            
        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}

    def test_health_check(self):
        """Test API health endpoint"""
        success, data = self.make_request('GET', 'health', auth_required=False)
        self.log_result("Health Check", success, 
                       f"Status: {data.get('status', 'unknown')}" if success else str(data))
        return success

    def test_user_registration(self):
        """Test user registration"""
        test_data = {
            "email": f"test_{datetime.now().strftime('%H%M%S')}@warmreach.test",
            "password": "TestPass123!",
            "first_name": "Test",
            "last_name": "User"
        }
        
        success, data = self.make_request('POST', 'auth/register', test_data, 
                                        expected_status=200, auth_required=False)
        
        if success and 'access_token' in data:
            self.token = data['access_token']
            self.user_id = data['user']['id']
            self.tenant_id = data['user']['tenant_id']
            self.log_result("User Registration", True, f"User ID: {self.user_id}")
        else:
            self.log_result("User Registration", False, str(data))
        
        return success

    def test_user_login(self):
        """Test user login with existing credentials"""
        # Create a new user for login test
        register_data = {
            "email": f"login_test_{datetime.now().strftime('%H%M%S')}@warmreach.test",
            "password": "LoginTest123!",
            "first_name": "Login",
            "last_name": "Test"
        }
        
        # Register first
        reg_success, reg_data = self.make_request('POST', 'auth/register', register_data, 
                                                expected_status=200, auth_required=False)
        
        if not reg_success:
            self.log_result("User Login (Setup)", False, "Failed to create test user")
            return False
        
        # Now test login
        login_data = {
            "email": register_data["email"],
            "password": register_data["password"]
        }
        
        success, data = self.make_request('POST', 'auth/login', login_data, 
                                        expected_status=200, auth_required=False)
        
        if success and 'access_token' in data:
            self.log_result("User Login", True, f"Token received")
        else:
            self.log_result("User Login", False, str(data))
        
        return success

    def test_get_current_user(self):
        """Test getting current user info"""
        success, data = self.make_request('GET', 'auth/me')
        
        if success and 'id' in data:
            self.log_result("Get Current User", True, f"User: {data.get('first_name')} {data.get('last_name')}")
        else:
            self.log_result("Get Current User", False, str(data))
        
        return success

    def test_dashboard_analytics(self):
        """Test dashboard analytics endpoint"""
        success, data = self.make_request('GET', 'analytics/dashboard')
        
        if success and 'total_contacts' in data:
            self.log_result("Dashboard Analytics", True, 
                          f"Contacts: {data.get('total_contacts')}, Messages: {data.get('total_messages_sent')}")
        else:
            self.log_result("Dashboard Analytics", False, str(data))
        
        return success

    def test_create_contact(self):
        """Test creating a contact"""
        contact_data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": f"john.doe.{datetime.now().strftime('%H%M%S')}@example.com",
            "phone": "+1234567890",
            "company_name": "Test Company",
            "job_title": "CEO",
            "city": "New York",
            "country": "USA",
            "notes": "Test contact for API testing"
        }
        
        success, data = self.make_request('POST', 'contacts', contact_data, expected_status=200)
        
        if success and 'id' in data:
            self.created_contact_id = data['id']
            self.log_result("Create Contact", True, f"Contact ID: {self.created_contact_id}")
        else:
            self.log_result("Create Contact", False, str(data))
        
        return success

    def test_get_contacts(self):
        """Test getting contacts list"""
        success, data = self.make_request('GET', 'contacts')
        
        if success and isinstance(data, list):
            self.log_result("Get Contacts", True, f"Found {len(data)} contacts")
        else:
            self.log_result("Get Contacts", False, str(data))
        
        return success

    def test_update_contact(self):
        """Test updating a contact"""
        if not self.created_contact_id:
            self.log_result("Update Contact", False, "No contact ID available")
            return False
        
        update_data = {
            "job_title": "CTO",
            "notes": "Updated via API test"
        }
        
        success, data = self.make_request('PUT', f'contacts/{self.created_contact_id}', update_data)
        
        if success and data.get('job_title') == 'CTO':
            self.log_result("Update Contact", True, "Contact updated successfully")
        else:
            self.log_result("Update Contact", False, str(data))
        
        return success

    def test_create_blueprint(self):
        """Test creating a blueprint"""
        blueprint_data = {
            "name": "Test Email Blueprint",
            "description": "Test blueprint for API testing",
            "channel": "email",
            "intent": "awareness",
            "angle": "cost",
            "tone": "calm_authority",
            "structure": "Hi {{first_name}},\n\nI noticed {{company_name}} might benefit from cost optimization.\n\nWould you be interested in a brief chat?\n\nBest regards",
            "cooldown_days": 7
        }
        
        success, data = self.make_request('POST', 'blueprints', blueprint_data, expected_status=200)
        
        if success and 'id' in data:
            self.created_blueprint_id = data['id']
            self.log_result("Create Blueprint", True, f"Blueprint ID: {self.created_blueprint_id}")
        else:
            self.log_result("Create Blueprint", False, str(data))
        
        return success

    def test_get_blueprints(self):
        """Test getting blueprints list"""
        success, data = self.make_request('GET', 'blueprints')
        
        if success and isinstance(data, list):
            self.log_result("Get Blueprints", True, f"Found {len(data)} blueprints")
        else:
            self.log_result("Get Blueprints", False, str(data))
        
        return success

    def test_generate_message(self):
        """Test generating a message"""
        if not self.created_contact_id or not self.created_blueprint_id:
            self.log_result("Generate Message", False, "Missing contact or blueprint ID")
            return False
        
        message_data = {
            "contact_id": self.created_contact_id,
            "blueprint_id": self.created_blueprint_id
        }
        
        success, data = self.make_request('POST', 'messages/generate', message_data)
        
        if success and 'message' in data:
            self.created_message_id = data['message']['id']
            self.log_result("Generate Message", True, f"Message ID: {self.created_message_id}")
        else:
            self.log_result("Generate Message", False, str(data))
        
        return success

    def test_get_messages(self):
        """Test getting messages list"""
        success, data = self.make_request('GET', 'messages')
        
        if success and isinstance(data, list):
            self.log_result("Get Messages", True, f"Found {len(data)} messages")
        else:
            self.log_result("Get Messages", False, str(data))
        
        return success

    def test_approve_message(self):
        """Test approving a message"""
        if not self.created_message_id:
            self.log_result("Approve Message", False, "No message ID available")
            return False
        
        approve_data = {
            "message_ids": [self.created_message_id]
        }
        
        success, data = self.make_request('POST', 'messages/approve', approve_data)
        
        if success and data.get('approved_count', 0) > 0:
            self.log_result("Approve Message", True, f"Approved {data['approved_count']} message(s)")
        else:
            self.log_result("Approve Message", False, str(data))
        
        return success

    def test_get_inbox(self):
        """Test getting inbox (replies)"""
        success, data = self.make_request('GET', 'inbox')
        
        if success and isinstance(data, list):
            self.log_result("Get Inbox", True, f"Found {len(data)} replies")
        else:
            self.log_result("Get Inbox", False, str(data))
        
        return success

    def test_get_tenant_settings(self):
        """Test getting tenant settings"""
        success, data = self.make_request('GET', 'settings/tenant')
        
        if success and 'id' in data:
            self.log_result("Get Tenant Settings", True, f"Tenant: {data.get('name')}")
        else:
            self.log_result("Get Tenant Settings", False, str(data))
        
        return success

    def test_get_tenant_users(self):
        """Test getting tenant users"""
        success, data = self.make_request('GET', 'settings/users')
        
        if success and isinstance(data, list):
            self.log_result("Get Tenant Users", True, f"Found {len(data)} users")
        else:
            self.log_result("Get Tenant Users", False, str(data))
        
        return success

    def test_delete_contact(self):
        """Test deleting a contact (cleanup)"""
        if not self.created_contact_id:
            return True  # Nothing to delete
        
        success, data = self.make_request('DELETE', f'contacts/{self.created_contact_id}', expected_status=200)
        
        if success:
            self.log_result("Delete Contact (Cleanup)", True, "Contact deleted")
        else:
            self.log_result("Delete Contact (Cleanup)", False, str(data))
        
        return success

    def test_delete_blueprint(self):
        """Test deleting a blueprint (cleanup)"""
        if not self.created_blueprint_id:
            return True  # Nothing to delete
        
        success, data = self.make_request('DELETE', f'blueprints/{self.created_blueprint_id}', expected_status=200)
        
        if success:
            self.log_result("Delete Blueprint (Cleanup)", True, "Blueprint deleted")
        else:
            self.log_result("Delete Blueprint (Cleanup)", False, str(data))
        
        return success

    def run_all_tests(self):
        """Run all API tests"""
        print(f"🚀 Starting Warm Outreach Engine API Tests")
        print(f"📡 Base URL: {self.base_url}")
        print("=" * 60)
        
        # Basic connectivity
        if not self.test_health_check():
            print("❌ Health check failed - stopping tests")
            return False
        
        # Authentication tests
        if not self.test_user_registration():
            print("❌ User registration failed - stopping tests")
            return False
        
        self.test_user_login()
        self.test_get_current_user()
        
        # Core functionality tests
        self.test_dashboard_analytics()
        
        # Contacts CRUD
        self.test_create_contact()
        self.test_get_contacts()
        self.test_update_contact()
        
        # Blueprints CRUD
        self.test_create_blueprint()
        self.test_get_blueprints()
        
        # Messages workflow
        self.test_generate_message()
        self.test_get_messages()
        self.test_approve_message()
        
        # Inbox
        self.test_get_inbox()
        
        # Settings
        self.test_get_tenant_settings()
        self.test_get_tenant_users()
        
        # Cleanup
        self.test_delete_contact()
        self.test_delete_blueprint()
        
        # Results summary
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    """Main test runner"""
    tester = WarmReachAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/test_results.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_tests': tester.tests_run,
            'passed_tests': tester.tests_passed,
            'success_rate': (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0,
            'results': tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())