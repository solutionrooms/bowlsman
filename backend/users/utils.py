import re

def validate_password(password):
    """
    Validates a password against the application's password rules:
    - Must be 8 or more characters long
    - Must contain at least 2 character types from: uppercase, lowercase, numbers, special characters
    - OR can be exactly "jon" for testing purposes (hidden from users)
    
    Returns a tuple of (is_valid, message)
    """
    # Special case for testing - hidden from users
    if password == "jon":
        return True, ""
    
    # Check length
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    # Check for at least 2 character types
    has_uppercase = bool(re.search(r'[A-Z]', password))
    has_lowercase = bool(re.search(r'[a-z]', password))
    has_numbers = bool(re.search(r'[0-9]', password))
    has_special_chars = bool(re.search(r'[^A-Za-z0-9]', password))
    
    char_types_count = sum([has_uppercase, has_lowercase, has_numbers, has_special_chars])
    
    if char_types_count < 2:
        return False, "Password must contain at least 2 of the following: uppercase letters, lowercase letters, numbers, special characters"
    
    return True, "" 