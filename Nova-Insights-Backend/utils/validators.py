import re


def validate_email(email):
    """Validate email format"""
    if not email:
        return False, "E-mail er påkrævet"
    
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        return False, "Ugyldig e-mail-format"
    
    return True, None


def validate_password(password):
    """Validate password strength according to documentation requirements"""
    if not password:
        return False, "Adgangskode er påkrævet", {}
    
    requirements = {
        'minLength': len(password) >= 8,
        'hasUppercase': bool(re.search(r'[A-Z]', password)),
        'hasLowercase': bool(re.search(r'[a-z]', password)),
        'hasNumber': bool(re.search(r'\d', password)),
        'hasSpecialChar': bool(re.search(r'[!@#$%^&*(),.?":{}|<>]', password))
    }
    
    if not all(requirements.values()):
        return False, "Adgangskoden er ikke stærk nok", requirements
    
    return True, None, requirements


def validate_required_fields(data, fields):
    """Validate required fields in request data"""
    missing_fields = []
    for field in fields:
        if not data.get(field):
            missing_fields.append(field)
    
    if missing_fields:
        return False, f"Manglende påkrævede felter: {', '.join(missing_fields)}"
    
    return True, None


def validate_otp(otp):
    """Validate OTP format"""
    if not otp:
        return False, "OTP er påkrævet"
    
    if not re.match(r'^\d{6}$', otp):
        return False, "OTP skal være 6 cifre"
    
    return True, None


def validate_name(name, field_name="Navn"):
    """Validate name fields"""
    if not name:
        return False, f"{field_name} er påkrævet"
    
    if len(name.strip()) < 2:
        return False, f"{field_name} skal være mindst 2 tegn"
    
    if len(name.strip()) > 100:
        return False, f"{field_name} må ikke være længere end 100 tegn"
    
    return True, None
