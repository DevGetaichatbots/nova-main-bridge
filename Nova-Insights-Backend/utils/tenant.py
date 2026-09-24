"""Tenant context: X-Company-Subdomain validation and post-auth redirect URLs."""
import os
from flask import request, g, jsonify
from psycopg2.extras import RealDictCursor
from utils.database import get_db_connection
from utils.token_manager import verify_access_token
from utils.i18n import t

PORTAL_PATHS = {'company_owner': '/company-portal'}


def build_redirect_url(subdomain, role):
    """Absolute URL on the company's subdomain, or None when tenant domains are not enabled."""
    base = os.getenv('TENANT_BASE_DOMAIN')
    if not base or not subdomain:
        return None
    return f"https://{subdomain}.{base}{PORTAL_PATHS.get(role, '/comparison')}"


TENANT_HEADER = 'X-Company-Subdomain'

# Session entry/exit routes: a leftover cookie from another company must never block
# signing in, out, or recovering an account from a tenant host.
AUTH_FLOW_PATHS = frozenset({
    '/api/login', '/api/logout', '/api/refresh-token', '/api/company/register',
    '/api/forgot-password', '/api/verify-otp', '/api/reset-password',
})


def _request_token():
    auth = request.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        return auth[7:]
    return request.cookies.get('accessToken')


def _deny(status, code, key):
    return jsonify({'success': False, 'error': t(key), 'code': code}), status


def resolve_tenant():
    """before_request: validate X-Company-Subdomain against the authenticated user's company.

    The header only selects/validates context; authorization and data filtering keep
    using the user's company_id from the database.
    """
    if request.method == 'OPTIONS' or request.path in AUTH_FLOW_PATHS:
        return None
    sub = request.headers.get(TENANT_HEADER, '').strip().lower()
    if not sub:
        return None
    token = _request_token()
    if not token:
        return None
    payload, error = verify_access_token(token)
    if error:
        return None  # the route's own auth returns 401

    conn = get_db_connection()
    if not conn:
        return _deny(500, 'DB_ERROR', 'common.db_connection_failed')
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, name, subdomain, status FROM companies WHERE subdomain = %s", (sub,))
            company = cur.fetchone()
            if not company:
                return _deny(404, 'COMPANY_NOT_FOUND', 'company.not_found')
            if company['status'] != 'active':
                return _deny(403, 'COMPANY_INACTIVE', 'company.inactive')
            cur.execute("SELECT company_id FROM users WHERE id = %s", (payload['user_id'],))
            user = cur.fetchone()
            if not user or user['company_id'] != company['id']:
                return _deny(403, 'TENANT_MISMATCH', 'company.tenant_mismatch')
            g.current_company = dict(company)
    finally:
        conn.close()
    return None
