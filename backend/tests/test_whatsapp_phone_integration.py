"""
Integration Tests for WhatsApp Phone Formatting in Scheduler
Verifies that send_whatsapp_message() and process_scheduled_messages() 
correctly use the format_phone_for_whatsapp() function
"""
import pytest
import sys
import os
from unittest.mock import patch, AsyncMock, MagicMock

# Add backend to path for importing scheduler module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from scheduler import format_phone_for_whatsapp, send_whatsapp_message


class TestSendWhatsAppMessageIntegration:
    """Tests that send_whatsapp_message correctly formats phone numbers"""
    
    @pytest.mark.asyncio
    async def test_send_whatsapp_formats_10_digit_number(self):
        """Verify send_whatsapp_message formats 10-digit number before sending"""
        with patch('scheduler.httpx.AsyncClient') as mock_client:
            # Setup mock response
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"messageId": "test123"}
            
            mock_async_client = AsyncMock()
            mock_async_client.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            mock_client.return_value = mock_async_client
            
            # Call with 10-digit number
            result = await send_whatsapp_message("tenant1", "9876543210", "Test message")
            
            # Verify the post was called with formatted number
            call_args = mock_async_client.__aenter__.return_value.post.call_args
            json_data = call_args.kwargs.get('json') or call_args[1].get('json')
            
            assert json_data['to_phone'] == "+919876543210", \
                f"Expected +919876543210, got {json_data['to_phone']}"
            print(f"✓ send_whatsapp_message formatted 9876543210 -> {json_data['to_phone']}")
    
    @pytest.mark.asyncio
    async def test_send_whatsapp_formats_trunk_prefix_number(self):
        """Verify send_whatsapp_message formats number with trunk prefix"""
        with patch('scheduler.httpx.AsyncClient') as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"messageId": "test123"}
            
            mock_async_client = AsyncMock()
            mock_async_client.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            mock_client.return_value = mock_async_client
            
            # Call with trunk prefix number
            result = await send_whatsapp_message("tenant1", "09876543210", "Test message")
            
            call_args = mock_async_client.__aenter__.return_value.post.call_args
            json_data = call_args.kwargs.get('json') or call_args[1].get('json')
            
            assert json_data['to_phone'] == "+919876543210", \
                f"Expected +919876543210, got {json_data['to_phone']}"
            print(f"✓ send_whatsapp_message formatted 09876543210 -> {json_data['to_phone']}")
    
    @pytest.mark.asyncio
    async def test_send_whatsapp_preserves_full_format(self):
        """Verify send_whatsapp_message preserves already formatted number"""
        with patch('scheduler.httpx.AsyncClient') as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"messageId": "test123"}
            
            mock_async_client = AsyncMock()
            mock_async_client.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            mock_client.return_value = mock_async_client
            
            # Call with already formatted number
            result = await send_whatsapp_message("tenant1", "+919876543210", "Test message")
            
            call_args = mock_async_client.__aenter__.return_value.post.call_args
            json_data = call_args.kwargs.get('json') or call_args[1].get('json')
            
            assert json_data['to_phone'] == "+919876543210", \
                f"Expected +919876543210, got {json_data['to_phone']}"
            print(f"✓ send_whatsapp_message preserved +919876543210 -> {json_data['to_phone']}")


class TestCodeReviewVerification:
    """Code review verification tests"""
    
    def test_format_function_called_in_send_whatsapp(self):
        """Verify format_phone_for_whatsapp is called in send_whatsapp_message"""
        import inspect
        from scheduler import send_whatsapp_message
        
        source = inspect.getsource(send_whatsapp_message)
        assert "format_phone_for_whatsapp" in source, \
            "format_phone_for_whatsapp should be called in send_whatsapp_message"
        print("✓ format_phone_for_whatsapp is called in send_whatsapp_message")
    
    def test_format_function_called_in_wa_web_messages(self):
        """Verify format_phone_for_whatsapp is used for wa_web_messages storage"""
        import inspect
        from scheduler import process_scheduled_messages
        
        source = inspect.getsource(process_scheduled_messages)
        # Check that format_phone_for_whatsapp is called for wa_web_messages
        assert "format_phone_for_whatsapp" in source, \
            "format_phone_for_whatsapp should be called in process_scheduled_messages for wa_web_messages"
        print("✓ format_phone_for_whatsapp is called in process_scheduled_messages")
    
    def test_phone_formatting_logic_correctness(self):
        """Verify the phone formatting logic handles all documented cases"""
        test_cases = [
            # (input, expected, description)
            ("9876543210", "+919876543210", "10-digit Indian number"),
            ("09876543210", "+919876543210", "11-digit with trunk prefix"),
            ("919876543210", "+919876543210", "12-digit with 91 prefix"),
            ("+919876543210", "+919876543210", "Full format unchanged"),
            ("98765 43210", "+919876543210", "With spaces"),
            ("9876-543-210", "+919876543210", "With dashes"),
        ]
        
        all_passed = True
        for input_phone, expected, description in test_cases:
            result = format_phone_for_whatsapp(input_phone)
            if result != expected:
                print(f"✗ FAILED: {description}: {input_phone} -> {result} (expected {expected})")
                all_passed = False
            else:
                print(f"✓ {description}: {input_phone} -> {result}")
        
        assert all_passed, "Some phone formatting test cases failed"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
