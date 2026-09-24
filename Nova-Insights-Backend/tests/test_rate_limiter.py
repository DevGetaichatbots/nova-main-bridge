import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from flask import Flask
import utils.redis_client as rc

class FakeRedis:
    def __init__(s): s.d, s.t = {}, {}
    def incr(s, k): s.d[k] = s.d.get(k, 0) + 1; return s.d[k]
    def expire(s, k, w): s.t[k] = w
    def ttl(s, k): return s.t.get(k, -1)
import middleware.rate_limiter as rl

def test_global_and_auth_limits():
    rc._redis_client = FakeRedis()
    rl.GLOBAL_LIMIT = 15
    app = Flask(__name__)
    rl.register_rate_limiters(app)
    @app.route('/api/login', methods=['POST'])
    def login(): return 'ok'
    @app.route('/api/x')
    def x(): return 'ok'
    c = app.test_client()
    h = {'X-Forwarded-For': '6.6.6.6, 1.2.3.4:5555'}
    codes = [c.post('/api/login', headers=h).status_code for _ in range(11)]
    assert codes == [200]*10 + [429], codes
    r = c.post('/api/login', headers={'X-Forwarded-For': '9.9.9.9, 1.2.3.4:7777'})  # spoofed prefix + new port: same bucket
    assert r.status_code == 429 and r.headers['Retry-After'] == '900', r.status_code
    assert c.post('/api/login', headers={'X-Forwarded-For': '5.5.5.5'}).status_code == 200
    g = [c.get('/api/x', headers={'X-Forwarded-For': '7.7.7.7'}).status_code for _ in range(16)]
    assert g == [200]*15 + [429], g
    assert c.options('/api/x', headers={'X-Forwarded-For': '7.7.7.7'}).status_code != 429


if __name__ == '__main__':
    test_global_and_auth_limits()
    print('OK')
