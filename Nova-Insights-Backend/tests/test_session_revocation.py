import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('JWT_SECRET', 'test-secret')
os.environ.setdefault('JWT_REFRESH_SECRET', 'test-refresh-secret')
import utils.redis_client as rc
import utils.token_manager as tm


class FakeRedis:
    def __init__(s): s.d = {}
    def set(s, k, v, ex=None): s.d[k] = str(v)
    def get(s, k): return s.d.get(k)


def test_revoked_user_tokens_rejected():
    rc._redis_client = FakeRedis()
    token = tm.generate_access_token(42, 'a@b.dk')
    other = tm.generate_access_token(7, 'c@d.dk')
    assert tm.verify_access_token(token)[0] is not None

    tm.revoke_user_sessions([42])
    assert tm.verify_access_token(token) == (None, "Token has been revoked")
    assert tm.decode_token(token) is None
    assert tm.verify_access_token(other)[0] is not None  # other users untouched

    # Token issued after the revocation (re-login once reactivated) is accepted.
    iat = tm.verify_access_token(other)[0]['iat']
    rc._redis_client.d['sessions_revoked:42'] = str(iat - 1)
    assert tm.verify_access_token(token)[0] is not None


if __name__ == '__main__':
    test_revoked_user_tokens_rejected()
    print('OK')
