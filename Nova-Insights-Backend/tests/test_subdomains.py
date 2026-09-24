import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('JWT_SECRET', 'test-secret')
os.environ.setdefault('JWT_REFRESH_SECRET', 'test-refresh-secret')
from utils.validators import slugify, validate_subdomain, unique_subdomain
import utils.database as database
from tests.fake_db import FakeConn


def test_slugify():
    assert slugify('ABC Construction') == 'abc-construction'
    assert slugify('Søren & Æble Å/S') == 'soeren-aeble-aa-s'
    assert slugify('  --Café  Nord--  ') == 'cafe-nord'
    assert slugify('a' * 80) == 'a' * 63
    assert slugify('!!!') == ''
    assert slugify(None) == ''


def test_validate_subdomain():
    assert validate_subdomain('abc') == (True, None)
    assert validate_subdomain('abc-2') == (True, None)
    assert validate_subdomain('ab') == (False, 'SUBDOMAIN_INVALID')
    assert validate_subdomain('-abc') == (False, 'SUBDOMAIN_INVALID')
    assert validate_subdomain('abc-') == (False, 'SUBDOMAIN_INVALID')
    assert validate_subdomain('ABC') == (False, 'SUBDOMAIN_INVALID')
    assert validate_subdomain('a' * 64) == (False, 'SUBDOMAIN_INVALID')
    assert validate_subdomain('') == (False, 'SUBDOMAIN_INVALID')
    assert validate_subdomain('dashboard') == (False, 'SUBDOMAIN_RESERVED')
    assert validate_subdomain('www') == (False, 'SUBDOMAIN_RESERVED')


def _taken(*names):
    return [('WHERE subdomain = %s', lambda p: {'x': 1} if p[0] in names else None)]


def test_unique_subdomain_suffixes():
    cur = FakeConn(_taken('acme', 'acme-2')).cur
    assert unique_subdomain(cur, 'acme') == 'acme-3'
    cur = FakeConn(_taken()).cur
    assert unique_subdomain(cur, 'acme') == 'acme'


def test_unique_subdomain_fallbacks():
    cur = FakeConn(_taken()).cur
    assert unique_subdomain(cur, slugify('!!!')) == 'company'
    assert unique_subdomain(cur, slugify('Æ')) == 'company'      # 'ae' too short
    assert unique_subdomain(cur, slugify('Admin')) == 'company'  # reserved
    long_base = 'a' * 63
    cur = FakeConn(_taken(long_base)).cur
    result = unique_subdomain(cur, long_base)
    assert result == 'a' * 61 + '-2' and len(result) == 63


def test_migration_backfills_null_subdomains():
    conn = FakeConn([
        ('SELECT id, name FROM companies WHERE subdomain IS NULL', [
            {'id': 1, 'name': 'Nordic Construction A/S'},
            {'id': 2, 'name': 'Nordic Construction A/S'},
        ]),
        ('WHERE subdomain = %s', lambda p: {'x': 1} if p[0] in updated else None),
    ])
    updated = set()
    orig_execute = conn.cur.execute

    def execute(sql, params=None):
        orig_execute(sql, params)
        if sql.startswith('UPDATE companies SET slug'):
            updated.add(params[1])
    conn.cur.execute = execute

    database.get_db_connection = lambda: conn
    assert database.migrate_company_subdomains() is True
    assert updated == {'nordic-construction-a-s', 'nordic-construction-a-s-2'}
    assert conn.committed
    sqls = ' '.join(sql for sql, _ in conn.cur.executed)
    assert 'GENERATED ALWAYS AS' in sqls
    assert 'CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_subdomain' in sqls


def test_migration_commits_columns_before_backfill():
    # If backfill/index creation fails, the new columns must already be committed,
    # otherwise login (which selects c.subdomain) breaks.
    commits = []
    conn = FakeConn([('CREATE UNIQUE INDEX', RuntimeError('lock timeout')),
                     ('SELECT id, name FROM companies WHERE subdomain IS NULL', [])])
    conn.commit = lambda: commits.append([sql for sql, _ in conn.cur.executed])
    database.get_db_connection = lambda: conn
    assert database.migrate_company_subdomains() is False
    assert commits and 'ADD COLUMN IF NOT EXISTS subdomain' in ' '.join(commits[0])


if __name__ == '__main__':
    for name, fn in list(globals().items()):
        if name.startswith('test_'):
            fn()
    print('OK')
