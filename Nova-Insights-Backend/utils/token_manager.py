import jwt
import os
import sys
from datetime import datetime, timedelta
import hashlib
import uuid


SECRET_KEY = os.getenv('JWT_SECRET')
REFRESH_SECRET_KEY = os.getenv('JWT_REFRESH_SECRET')

if not SECRET_KEY:
    print("CRITICAL: JWT_SECRET environment variable is not set!")
    sys.exit(1)

if not REFRESH_SECRET_KEY:
    print("CRITICAL: JWT_REFRESH_SECRET environment variable is not set!")
    print("Generate one with: python3 -c \"import secrets; print(secrets.token_urlsafe(48))\"")
    print("Then add it to Replit Secrets as JWT_REFRESH_SECRET")
    sys.exit(1)

ACCESS_TOKEN_EXPIRE_MINUTES = 1440
REFRESH_TOKEN_EXPIRE_DAYS = 7
RESET_TOKEN_EXPIRE_MINUTES = 15


def generate_access_token(user_id, email):
    """Generate JWT access token"""
    payload = {
        'user_id': user_id,
        'email': email,
        'type': 'access',
        'jti': str(uuid.uuid4()),
        'exp': datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        'iat': datetime.utcnow()
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
    return token


def generate_refresh_token(user_id, email):
    """Generate JWT refresh token"""
    payload = {
        'user_id': user_id,
        'email': email,
        'type': 'refresh',
        'exp': datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        'iat': datetime.utcnow()
    }
    token = jwt.encode(payload, REFRESH_SECRET_KEY, algorithm='HS256')
    return token


def generate_reset_token(user_id, email):
    """Generate password reset token"""
    payload = {
        'user_id': user_id,
        'email': email,
        'type': 'reset',
        'exp': datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
        'iat': datetime.utcnow()
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
    return token


def is_token_blacklisted(token):
    """Check if a token has been blacklisted (logged out)"""
    try:
        from utils.redis_client import cache_get
        token_hash_val = hash_token(token)
        result = cache_get(f"token_blacklist:{token_hash_val}")
        return result is not None
    except Exception:
        return False


def verify_access_token(token):
    """Verify and decode access token"""
    try:
        if is_token_blacklisted(token):
            return None, "Token has been revoked"
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        if payload.get('type') != 'access':
            return None, "Invalid token type"
        return payload, None
    except jwt.ExpiredSignatureError:
        return None, "Token has expired"
    except jwt.InvalidTokenError:
        return None, "Invalid token"


def verify_refresh_token(token):
    """Verify and decode refresh token"""
    try:
        payload = jwt.decode(token, REFRESH_SECRET_KEY, algorithms=['HS256'])
        if payload.get('type') != 'refresh':
            return None, "Invalid token type"
        return payload, None
    except jwt.ExpiredSignatureError:
        return None, "Token has expired"
    except jwt.InvalidTokenError:
        return None, "Invalid token"


def verify_reset_token(token):
    """Verify and decode reset token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        if payload.get('type') != 'reset':
            return None, "Invalid token type"
        return payload, None
    except jwt.ExpiredSignatureError:
        return None, "Token er udløbet"
    except jwt.InvalidTokenError:
        return None, "Ugyldig token"


def hash_token(token):
    """Hash token for database storage"""
    return hashlib.sha256(token.encode()).hexdigest()


def decode_token(token):
    """Decode and verify an access token, returning the payload or None"""
    try:
        if is_token_blacklisted(token):
            return None
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
