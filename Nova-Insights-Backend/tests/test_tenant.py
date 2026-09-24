import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('JWT_SECRET', 'test-secret')
os.environ.setdefault('JWT_REFRESH_SECRET', 'test-refresh-secret')
import utils.redis_client as rc


class FakeRedis:
    def __init__(s): s.d = {}
    def set(s, k, v, ex=None): s.d[k] = str(v)
    def get(s, k): return s.d.get(k)
    def delete(s, *k): [s.d.pop(x, None) for x in k]


rc._redis_client = FakeRedis()

import utils.token_manager as tm
from utils.tenant import build_redirect_url


def test_company_id_claim_optional():
    with_claim = tm.verify_access_token(tm.generate_access_token(1, 'a@b.dk', company_id=7))[0]
    assert with_claim['company_id'] == 7
    without = tm.verify_access_token(tm.generate_access_token(1, 'a@b.dk'))[0]
    assert 'company_id' not in without


def test_build_redirect_url():
    os.environ.pop('TENANT_BASE_DOMAIN', None)
    assert build_redirect_url('abc', 'company_owner') is None
    os.environ['TENANT_BASE_DOMAIN'] = 'novainsight.net'
    try:
        assert build_redirect_url('abc', 'company_owner') == 'https://abc.novainsight.net/company-portal'
        assert build_redirect_url('abc', 'standard_user') == 'https://abc.novainsight.net/comparison'
        assert build_redirect_url('abc', None) == 'https://abc.novainsight.net/comparison'
        assert build_redirect_url(None, 'company_owner') is None
    finally:
        os.environ.pop('TENANT_BASE_DOMAIN', None)


def test_set_auth_cookies():
    from flask import Flask, jsonify
    from routes.auth import set_auth_cookies
    app = Flask(__name__)
    with app.test_request_context('/', base_url='https://api.example'):
        resp = jsonify({})
        set_auth_cookies(resp, 'AAA', 'RRR')
        cookies = resp.headers.getlist('Set-Cookie')
    access = next(c for c in cookies if c.startswith('accessToken=AAA'))
    refresh = next(c for c in cookies if c.startswith('refreshToken=RRR'))
    assert 'HttpOnly' in access and 'Path=/' in access and 'Secure' in access
    assert 'Path=/api/' in refresh and 'HttpOnly' in refresh


from flask import Flask, g
import utils.tenant as tenant
from tests.fake_db import FakeConn

COMPANIES = {
    'abc': {'id': 1, 'name': 'ABC', 'subdomain': 'abc', 'status': 'active'},
    'xyz': {'id': 2, 'name': 'XYZ', 'subdomain': 'xyz', 'status': 'active'},
    'old': {'id': 3, 'name': 'Old', 'subdomain': 'old', 'status': 'inactive'},
}
USERS = {10: {'company_id': 1}, 30: {'company_id': 3}}


def _client():
    tenant.get_db_connection = lambda: FakeConn([
        ('FROM companies WHERE subdomain', lambda p: COMPANIES.get(p[0])),
        ('FROM users WHERE id', lambda p: USERS.get(p[0])),
    ])
    app = Flask(__name__)
    app.before_request(tenant.resolve_tenant)

    @app.route('/x', methods=['GET', 'OPTIONS'])
    def x():
        c = getattr(g, 'current_company', None)
        return {'company': c and c['id']}
    return app.test_client()


def _auth(user_id, company_id=None):
    return {'Authorization': f'Bearer {tm.generate_access_token(user_id, "u@x.dk", company_id=company_id)}'}


def test_no_header_is_backwards_compatible():
    r = _client().get('/x', headers=_auth(10))
    assert r.status_code == 200 and r.json['company'] is None


def test_no_token_passes_through():
    r = _client().get('/x', headers={'X-Company-Subdomain': 'abc'})
    assert r.status_code == 200 and r.json['company'] is None
    r = _client().get('/x', headers={'X-Company-Subdomain': 'abc', 'Authorization': 'Bearer garbage'})
    assert r.status_code == 200


def test_header_matches():
    r = _client().get('/x', headers={**_auth(10, 1), 'X-Company-Subdomain': 'abc'})
    assert r.status_code == 200 and r.json['company'] == 1


def test_token_without_claim_matches():
    r = _client().get('/x', headers={**_auth(10), 'X-Company-Subdomain': 'abc'})
    assert r.status_code == 200 and r.json['company'] == 1


def test_cookie_token_is_used():
    c = _client()
    c.set_cookie('accessToken', tm.generate_access_token(10, 'u@x.dk'))
    r = c.get('/x', headers={'X-Company-Subdomain': 'xyz'})
    assert r.status_code == 403 and r.json['code'] == 'TENANT_MISMATCH'


def test_header_normalized():
    r = _client().get('/x', headers={**_auth(10), 'X-Company-Subdomain': '  ABC '})
    assert r.status_code == 200 and r.json['company'] == 1


def test_tenant_mismatch():
    r = _client().get('/x', headers={**_auth(10, 1), 'X-Company-Subdomain': 'xyz'})
    assert r.status_code == 403 and r.json['code'] == 'TENANT_MISMATCH'


def test_forged_claim_ignored():
    # JWT claim says company 2, DB says user 10 belongs to company 1 -> DB wins.
    r = _client().get('/x', headers={**_auth(10, 2), 'X-Company-Subdomain': 'xyz'})
    assert r.status_code == 403 and r.json['code'] == 'TENANT_MISMATCH'


def test_company_not_found():
    r = _client().get('/x', headers={**_auth(10), 'X-Company-Subdomain': 'nope'})
    assert r.status_code == 404 and r.json['code'] == 'COMPANY_NOT_FOUND'


def test_company_inactive():
    r = _client().get('/x', headers={**_auth(30), 'X-Company-Subdomain': 'old'})
    assert r.status_code == 403 and r.json['code'] == 'COMPANY_INACTIVE'


def test_options_preflight_skipped():
    r = _client().open('/x', method='OPTIONS', headers={'X-Company-Subdomain': 'nope'})
    assert r.status_code == 200


def test_db_down_fails_closed():
    c = _client()
    tenant.get_db_connection = lambda: None
    r = c.get('/x', headers={**_auth(10), 'X-Company-Subdomain': 'abc'})
    assert r.status_code == 500 and r.json['code'] == 'DB_ERROR'


def test_auth_endpoints_skip_tenant_check_with_foreign_cookie():
    # A leftover cookie from company 1 must not block login/logout/register on xyz's host.
    tenant.get_db_connection = lambda: FakeConn([
        ('FROM companies WHERE subdomain', lambda p: COMPANIES.get(p[0])),
        ('FROM users WHERE id', lambda p: USERS.get(p[0])),
    ])
    app = Flask(__name__)
    app.before_request(tenant.resolve_tenant)
    for path in ['/api/login', '/api/logout', '/api/refresh-token', '/api/company/register',
                 '/api/forgot-password', '/api/verify-otp', '/api/reset-password']:
        app.add_url_rule(path, path, lambda: {'ok': True}, methods=['POST'])
    c = app.test_client()
    c.set_cookie('accessToken', tm.generate_access_token(10, 'u@x.dk'))
    for path in ['/api/login', '/api/logout', '/api/refresh-token', '/api/company/register',
                 '/api/forgot-password', '/api/verify-otp', '/api/reset-password']:
        r = c.post(path, headers={'X-Company-Subdomain': 'xyz'})
        assert r.status_code == 200, (path, r.status_code)


if __name__ == '__main__':
    for name, fn in list(globals().items()):
        if name.startswith('test_'):
            fn()
    print('OK')
