import re
import unicodedata


def validate_email(email):
    """Validate email format"""
    if not email:
        return False, "E-mail er påkrævet"

    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    if not re.match(pattern, email):
        return False, "Ugyldig e-mail-format"

    return True, None


def validate_password(password):
    """Validate password strength according to documentation requirements"""
    if not password:
        return False, "Adgangskode er påkrævet", {}

    requirements = {
        "minLength": len(password) >= 8,
        "hasUppercase": bool(re.search(r"[A-Z]", password)),
        "hasLowercase": bool(re.search(r"[a-z]", password)),
        "hasNumber": bool(re.search(r"\d", password)),
        "hasSpecialChar": bool(re.search(r'[!@#$%^&*(),.?":{}|<>]', password)),
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

    if not re.match(r"^\d{6}$", otp):
        return False, "OTP skal være 6 cifre"

    return True, None


def validate_name(name, field_name="Navn"):
    """Validate personal name fields."""
    if not name:
        return False, f"{field_name} er påkrævet"

    normalized_name = name.strip()

    if len(normalized_name) < 2:
        return False, f"{field_name} skal være mindst 2 tegn"

    if len(normalized_name) > 100:
        return False, f"{field_name} må ikke være længere end 100 tegn"

    if re.search(r"\d", normalized_name):
        return False, f"{field_name} må ikke indeholde tal"

    return True, None



RESERVED_SUBDOMAINS = frozenset({
    'www', 'api', 'app', 'admin', 'dashboard', 'auth', 'login', 'mail', 'support',
    'help', 'docs', 'blog', 'status', 'static', 'cdn', 'dev', 'staging', 'test',
})
_SUBDOMAIN_RE = re.compile(r'^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$')
_DANISH = str.maketrans({'æ': 'ae', 'ø': 'oe', 'å': 'aa'})


def slugify(name):
    """Company name -> DNS-label-safe slug ('' when nothing usable is left)."""
    s = (name or '').lower().translate(_DANISH)
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s[:63].strip('-')


def validate_subdomain(value):
    """Return (ok, error_code)."""
    if not _SUBDOMAIN_RE.match(value or ''):
        return False, 'SUBDOMAIN_INVALID'
    if value in RESERVED_SUBDOMAINS:
        return False, 'SUBDOMAIN_RESERVED'
    return True, None


def unique_subdomain(cur, base):
    """First free subdomain: base, base-2, base-3, ... ('company' if base is unusable)."""
    if not validate_subdomain(base)[0]:
        base = 'company'
    candidate, n = base, 1
    while True:
        cur.execute("SELECT 1 FROM companies WHERE subdomain = %s", (candidate,))
        if not cur.fetchone():
            return candidate
        n += 1
        suffix = f'-{n}'
        candidate = base[:63 - len(suffix)] + suffix
