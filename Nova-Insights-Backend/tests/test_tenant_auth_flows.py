import os, sys
from datetime import datetime
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

import psycopg2
from flask import Flask
import utils.token_manager as tm
import routes.company as company_routes
from tests.fake_db import FakeConn

NOW = datetime(2026, 9, 24)
PAYLOAD = {'companyName': 'ABC Construction', 'email': 'owner@abc.dk',
           'password': 'Str0ng!Pass', 'confirmPassword': 'Str0ng!Pass'}


def _register_conn(taken=(), existing_names=(), insert_error=None):
    def insert_company(p):
        if insert_error:
            return insert_error
        return {'id': 5, 'name': p[0], 'cvr_number': None, 'address': None, 'website': None,
                'industry': None, 'size': None, 'phone_number': None, 'email': p[7],
                'subdomain': p[8], 'created_at': NOW}
    return FakeConn([
        ('SELECT id FROM users WHERE email', None),
        ('WHERE subdomain = %s', lambda p: {'x': 1} if p[0] in taken else None),
        ('WHERE LOWER(name) = LOWER(%s)', lambda p: {'x': 1} if p[0].lower() in existing_names else None),
        ('INSERT INTO companies', insert_company),
        ('INSERT INTO users', lambda p: {'id': 9, 'first_name': None, 'last_name': None, 'email': p[2],
                                         'role': 'company_owner', 'phone_number': None,
                                         'company_id': 5, 'created_at': NOW}),
        ('INSERT INTO refresh_tokens', None),
    ])


def _post(conn, body):
    company_routes.get_db_connection = lambda: conn
    app = Flask(__name__)
    app.register_blueprint(company_routes.company_bp, url_prefix='/api')
    return app.test_client().post('/api/company/register', json=body, base_url='https://api.example')


def test_register_derives_subdomain_sets_cookies_and_claim():
    os.environ['TENANT_BASE_DOMAIN'] = 'novainsight.net'
    try:
        r = _post(_register_conn(), PAYLOAD)
    finally:
        os.environ.pop('TENANT_BASE_DOMAIN', None)
    assert r.status_code == 201, r.json
    assert r.json['company']['subdomain'] == 'abc-construction'
    assert r.json['redirectUrl'] == 'https://abc-construction.novainsight.net/company-portal'
    assert 'accessToken' not in r.json and 'refreshToken' not in r.json
    cookies = r.headers.getlist('Set-Cookie')
    access = next(c for c in cookies if c.startswith('accessToken='))
    token = access.split(';')[0].split('=', 1)[1]
    assert tm.verify_access_token(token)[0]['company_id'] == 5
    assert any(c.startswith('refreshToken=') for c in cookies)


def test_register_redirect_null_without_env():
    os.environ.pop('TENANT_BASE_DOMAIN', None)
    r = _post(_register_conn(), PAYLOAD)
    assert r.status_code == 201 and r.json['redirectUrl'] is None


def test_register_collision_gets_suffix():
    r = _post(_register_conn(taken={'abc-construction'}), PAYLOAD)
    assert r.json['company']['subdomain'] == 'abc-construction-2'


def test_register_explicit_subdomain():
    r = _post(_register_conn(), {**PAYLOAD, 'subdomain': ' ABC '})
    assert r.status_code == 201 and r.json['company']['subdomain'] == 'abc'


def test_register_rejects_reserved_invalid_taken():
    r = _post(_register_conn(), {**PAYLOAD, 'subdomain': 'dashboard'})
    assert r.status_code == 400 and r.json['code'] == 'SUBDOMAIN_RESERVED'
    r = _post(_register_conn(), {**PAYLOAD, 'subdomain': 'a_b'})
    assert r.status_code == 400 and r.json['code'] == 'SUBDOMAIN_INVALID'
    r = _post(_register_conn(taken={'abc'}), {**PAYLOAD, 'subdomain': 'abc'})
    assert r.status_code == 409 and r.json['code'] == 'SUBDOMAIN_TAKEN'


def test_register_rejects_duplicate_name():
    r = _post(_register_conn(existing_names={'abc construction'}), {**PAYLOAD, 'companyName': 'abc CONSTRUCTION'})
    assert r.status_code == 409 and r.json['code'] == 'COMPANY_EXISTS'


def test_register_unique_race_returns_409():
    err = psycopg2.errors.UniqueViolation('duplicate key value violates unique constraint "idx_companies_subdomain"')
    conn = _register_conn(insert_error=err)
    r = _post(conn, PAYLOAD)
    assert r.status_code == 409 and r.json['code'] == 'SUBDOMAIN_TAKEN'
    assert conn.rolled_back


import bcrypt
import routes.auth as auth_routes
import utils.tenant as tenant

HASH = bcrypt.hashpw(b'Str0ng!Pass', bcrypt.gensalt(4)).decode()
LOGIN_USER = {'id': 9, 'first_name': 'A', 'last_name': 'B', 'email': 'owner@abc.dk', 'password_hash': HASH,
              'role': 'company_owner', 'company_id': 5, 'is_active': True, 'created_at': NOW,
              'company_name': 'ABC', 'cvr_number': None, 'company_active': True, 'company_subdomain': 'abc'}


def _login_app():
    conn = FakeConn([('WHERE u.email = %s', LOGIN_USER), ('INSERT INTO refresh_tokens', None)])
    auth_routes.get_db_connection = lambda: conn
    auth_routes.log_audit_event = lambda **kw: None
    app = Flask(__name__)
    app.before_request(tenant.resolve_tenant)
    app.register_blueprint(auth_routes.auth_bp, url_prefix='/api')
    return app.test_client()


def test_login_returns_redirect_and_claim():
    os.environ['TENANT_BASE_DOMAIN'] = 'novainsight.net'
    try:
        r = _login_app().post('/api/login', json={'email': 'owner@abc.dk', 'password': 'Str0ng!Pass'})
    finally:
        os.environ.pop('TENANT_BASE_DOMAIN', None)
    assert r.status_code == 200, r.json
    assert r.json['redirectUrl'] == 'https://abc.novainsight.net/company-portal'
    assert r.json['user']['companySubdomain'] == 'abc'
    assert tm.verify_access_token(r.json['access_token'])[0]['company_id'] == 5


def test_login_unchanged_without_env_and_from_tenant_host():
    r = _login_app().post('/api/login', json={'email': 'owner@abc.dk', 'password': 'Str0ng!Pass'},
                          headers={'X-Company-Subdomain': 'someone-else'})
    assert r.status_code == 200 and r.json['redirectUrl'] is None
    assert any(c.startswith('accessToken=') for c in r.headers.getlist('Set-Cookie'))


def test_me_returns_subdomain():
    rc._redis_client = FakeRedis()
    row = {**LOGIN_USER, 'phone_number': None, 'updated_at': NOW, 'company_email': None,
           'company_phone': None, 'company_website': None, 'company_address': None, 'company_industry': None}
    conn = FakeConn([('WHERE u.id = %s', row)])
    auth_routes.get_db_connection = lambda: conn
    app = Flask(__name__)
    app.register_blueprint(auth_routes.auth_bp, url_prefix='/api')
    r = app.test_client().get('/api/me', headers={'Authorization': f'Bearer {tm.generate_access_token(9, "owner@abc.dk")}'})
    assert r.status_code == 200, r.json
    assert r.json['user']['companySubdomain'] == 'abc'
    sql = conn.cur.executed[0][0]
    assert 'c.phone_number as company_phone' in sql and 'c.phone as' not in sql


def test_super_admin_create_sets_subdomain():
    import inspect
    import routes.super_admin as sa
    src = inspect.getsource(sa)
    insert = src[src.index('INSERT INTO companies'):src.index('RETURNING', src.index('INSERT INTO companies'))]
    assert 'subdomain' in insert and 'slug' in insert
    assert 'unique_subdomain(cur, slugify(name))' in src


def test_register_without_owner_name_satisfies_not_null():
    # users.first_name/last_name are NOT NULL; the signup form sends no names.
    conn = _register_conn()
    r = _post(conn, PAYLOAD)
    assert r.status_code == 201, r.json
    params = next(p for sql, p in conn.cur.executed if 'INSERT INTO users' in sql)
    assert params[0] == '' and params[1] == ''


if __name__ == '__main__':
    for name, fn in list(globals().items()):
        if name.startswith('test_'):
            fn()
    print('OK')
