from flask import request, jsonify
from utils.redis_client import rate_limit_check
from utils.i18n import t

# Global: every /api request, per client IP.
GLOBAL_LIMIT = 300
GLOBAL_WINDOW = 60

# Auth: one shared, strict bucket across all credential/OTP endpoints, per client IP.
AUTH_LIMIT = 10
AUTH_WINDOW = 900
AUTH_PATHS = {
    '/api/login',
    '/api/forgot-password',
    '/api/verify-otp',
    '/api/reset-password',
    '/api/company/register',
}


def get_client_ip():
    """Rightmost X-Forwarded-For entry is the one our proxy (Azure) appended; earlier ones are client-controlled."""
    forwarded = request.headers.get('X-Forwarded-For', '')
    ip = forwarded.split(',')[-1].strip() if forwarded else (request.remote_addr or 'unknown')
    # Azure appends "ip:port"; drop the port so each connection doesn't get a fresh bucket.
    if ip.startswith('['):
        return ip[1:ip.find(']')]
    if ip.count(':') == 1:
        return ip.split(':')[0]
    return ip


def _too_many(reset_time):
    resp = jsonify({
        'success': False,
        'error': t('common.too_many_attempts'),
        'code': 'RATE_LIMITED',
        'retryAfter': reset_time
    })
    resp.headers['Retry-After'] = str(reset_time)
    return resp, 429


def register_rate_limiters(app):
    @app.before_request
    def apply_rate_limits():
        path = request.path.rstrip('/') or '/'
        if request.method == 'OPTIONS' or not path.startswith('/api'):
            return None

        ip = get_client_ip()

        if path in AUTH_PATHS:
            allowed, _, reset_time = rate_limit_check(f"rate_limit:auth:{ip}", AUTH_LIMIT, AUTH_WINDOW)
            if not allowed:
                return _too_many(reset_time)

        allowed, _, reset_time = rate_limit_check(f"rate_limit:global:{ip}", GLOBAL_LIMIT, GLOBAL_WINDOW)
        if not allowed:
            return _too_many(reset_time)

        return None
