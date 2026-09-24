import os, sys, inspect, json
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

from flask import Flask
import utils.token_manager as tm
import routes.chat as chat
import routes.schedule as schedule
from tests.fake_db import FakeConn

ATTACKER = {'Authorization': f'Bearer {tm.generate_access_token(99, "evil@other.dk")}'}


def _client(bp, prefix):
    app = Flask(__name__)
    app.register_blueprint(bp, url_prefix=prefix)
    return app.test_client()


def test_cached_messages_not_served_to_other_tenant():
    rc._redis_client.set('messages:S1', json.dumps({'success': True, 'messages': ['secret']}))
    chat.get_db_connection = lambda: FakeConn([
        ('FROM users WHERE id', {'role': 'user', 'company_id': 2}),
        ('FROM chat_sessions cs', {'id': 1, 'user_id': 10, 'company_id': 1}),
    ])
    r = _client(chat.chat_bp, '/api/chat').get('/api/chat/sessions/S1/messages', headers=ATTACKER)
    assert r.status_code == 403, r.json


def test_cached_analysis_not_served_to_other_user():
    rc._redis_client.set('schedule_analysis:A1', json.dumps({'success': True, 'analysis': {'title': 'secret'}}))
    schedule.get_db_connection = lambda: FakeConn([('FROM schedule_analyses', None)])
    r = _client(schedule.schedule_bp, '/api/schedule').get('/api/schedule/analyses/A1', headers=ATTACKER)
    assert r.status_code == 404, r.json


def test_create_analysis_does_not_leak_foreign_row():
    schedule.get_db_connection = lambda: FakeConn([
        ('FROM schedule_analyses WHERE analysis_id', {'id': 7, 'analysis_id': 'A1', 'user_id': 10}),
    ])
    r = _client(schedule.schedule_bp, '/api/schedule').post(
        '/api/schedule/analyses', json={'analysis_id': 'A1'}, headers=ATTACKER)
    assert r.status_code == 403 and 'analysis' not in r.json


def test_source_file_queries_scoped_to_user():
    chat_src = inspect.getsource(chat._cache_session_source_files)
    assert 'WHERE session_source_files.user_id = EXCLUDED.user_id' in chat_src
    gen_src = inspect.getsource(schedule)
    assert 'AND ssf.session_id = %s AND ssf.user_id = %s' in gen_src


def test_session_pdf_hides_other_users_private_annotations():
    src = inspect.getsource(chat.download_session_pdf)
    assert 'AND (ta.is_private = FALSE OR ta.user_id = %s)' in src


if __name__ == '__main__':
    for name, fn in list(globals().items()):
        if name.startswith('test_'):
            fn()
    print('OK')
