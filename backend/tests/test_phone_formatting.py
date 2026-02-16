"""
Test Phone Number Formatting for WhatsApp
Tests the format_phone_for_whatsapp() function in scheduler.py
Bug Fix: Indian phone numbers were missing +91 country code
"""
import pytest
import sys
import os

# Add backend to path for importing scheduler module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from scheduler import format_phone_for_whatsapp


class TestPhoneFormattingBasic:
    """Basic phone number formatting tests for Indian numbers"""
    
    def test_10_digit_indian_number_gets_91_prefix(self):
        """10-digit Indian mobile number should get +91 prefix"""
        result = format_phone_for_whatsapp("9876543210")
        assert result == "+919876543210", f"Expected +919876543210, got {result}"
        print(f"✓ 10-digit number: 9876543210 -> {result}")
    
    def test_10_digit_with_spaces(self):
        """10-digit number with spaces should be formatted correctly"""
        result = format_phone_for_whatsapp("98765 43210")
        assert result == "+919876543210", f"Expected +919876543210, got {result}"
        print(f"✓ Number with spaces: '98765 43210' -> {result}")
    
    def test_10_digit_with_dashes(self):
        """10-digit number with dashes should be formatted correctly"""
        result = format_phone_for_whatsapp("9876-543-210")
        assert result == "+919876543210", f"Expected +919876543210, got {result}"
        print(f"✓ Number with dashes: '9876-543-210' -> {result}")
    
    def test_10_digit_with_mixed_separators(self):
        """10-digit number with mixed separators should be formatted correctly"""
        result = format_phone_for_whatsapp("98765-432 10")
        assert result == "+919876543210", f"Expected +919876543210, got {result}"
        print(f"✓ Number with mixed separators: '98765-432 10' -> {result}")


class TestPhoneFormattingTrunkPrefix:
    """Tests for numbers with leading 0 (Indian trunk dialing prefix)"""
    
    def test_11_digit_with_leading_zero(self):
        """11-digit number starting with 0 should strip 0 and add +91"""
        result = format_phone_for_whatsapp("09876543210")
        assert result == "+919876543210", f"Expected +919876543210, got {result}"
        print(f"✓ Trunk prefix: 09876543210 -> {result}")
    
    def test_11_digit_with_leading_zero_and_spaces(self):
        """11-digit number with 0 prefix and spaces should be formatted correctly"""
        result = format_phone_for_whatsapp("0 9876 543 210")
        assert result == "+919876543210", f"Expected +919876543210, got {result}"
        print(f"✓ Trunk prefix with spaces: '0 9876 543 210' -> {result}")


class TestPhoneFormattingExistingCountryCode:
    """Tests for numbers that already have country code"""
    
    def test_12_digit_with_91_prefix(self):
        """12-digit number starting with 91 should get + prefix"""
        result = format_phone_for_whatsapp("919876543210")
        assert result == "+919876543210", f"Expected +919876543210, got {result}"
        print(f"✓ 91 prefix: 919876543210 -> {result}")
    
    def test_full_format_with_plus(self):
        """Number already in +91XXXXXXXXXX format should remain unchanged"""
        result = format_phone_for_whatsapp("+919876543210")
        assert result == "+919876543210", f"Expected +919876543210, got {result}"
        print(f"✓ Full format: +919876543210 -> {result}")
    
    def test_full_format_with_plus_and_spaces(self):
        """Number with + and spaces should be formatted correctly"""
        result = format_phone_for_whatsapp("+91 9876 543210")
        assert result == "+919876543210", f"Expected +919876543210, got {result}"
        print(f"✓ Full format with spaces: '+91 9876 543210' -> {result}")


class TestPhoneFormattingEdgeCases:
    """Edge cases and special scenarios"""
    
    def test_empty_string(self):
        """Empty string should return empty string"""
        result = format_phone_for_whatsapp("")
        assert result == "", f"Expected empty string, got {result}"
        print(f"✓ Empty string: '' -> '{result}'")
    
    def test_none_value(self):
        """None value should return None"""
        result = format_phone_for_whatsapp(None)
        assert result is None, f"Expected None, got {result}"
        print(f"✓ None value: None -> {result}")
    
    def test_number_with_parentheses(self):
        """Number with parentheses should be formatted correctly"""
        result = format_phone_for_whatsapp("(91) 9876543210")
        assert result == "+919876543210", f"Expected +919876543210, got {result}"
        print(f"✓ With parentheses: '(91) 9876543210' -> {result}")
    
    def test_number_with_country_code_in_brackets(self):
        """Number with country code in brackets should be formatted"""
        result = format_phone_for_whatsapp("(+91) 9876543210")
        assert result == "+919876543210", f"Expected +919876543210, got {result}"
        print(f"✓ Country code in brackets: '(+91) 9876543210' -> {result}")


class TestPhoneFormattingOtherCountries:
    """Tests for non-Indian numbers (should preserve format)"""
    
    def test_us_number_with_plus(self):
        """US number with + should remain unchanged"""
        result = format_phone_for_whatsapp("+14155551234")
        assert result == "+14155551234", f"Expected +14155551234, got {result}"
        print(f"✓ US number: +14155551234 -> {result}")
    
    def test_uk_number_with_plus(self):
        """UK number with + should remain unchanged"""
        result = format_phone_for_whatsapp("+447911123456")
        assert result == "+447911123456", f"Expected +447911123456, got {result}"
        print(f"✓ UK number: +447911123456 -> {result}")


class TestPhoneFormattingRealWorldScenarios:
    """Real-world scenarios from the bug report"""
    
    def test_typical_indian_mobile_number(self):
        """Typical Indian mobile number format"""
        # Common formats users might enter
        test_cases = [
            ("9876543210", "+919876543210"),
            ("98765 43210", "+919876543210"),
            ("9876-543-210", "+919876543210"),
            ("09876543210", "+919876543210"),
            ("919876543210", "+919876543210"),
            ("+919876543210", "+919876543210"),
        ]
        
        for input_phone, expected in test_cases:
            result = format_phone_for_whatsapp(input_phone)
            assert result == expected, f"Input: {input_phone}, Expected: {expected}, Got: {result}"
            print(f"✓ Real-world: '{input_phone}' -> {result}")
    
    def test_airtel_number_format(self):
        """Airtel number starting with 9"""
        result = format_phone_for_whatsapp("9123456789")
        assert result == "+919123456789", f"Expected +919123456789, got {result}"
        print(f"✓ Airtel format: 9123456789 -> {result}")
    
    def test_jio_number_format(self):
        """Jio number starting with 7"""
        result = format_phone_for_whatsapp("7123456789")
        assert result == "+917123456789", f"Expected +917123456789, got {result}"
        print(f"✓ Jio format: 7123456789 -> {result}")
    
    def test_bsnl_number_format(self):
        """BSNL number starting with 8"""
        result = format_phone_for_whatsapp("8123456789")
        assert result == "+918123456789", f"Expected +918123456789, got {result}"
        print(f"✓ BSNL format: 8123456789 -> {result}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
