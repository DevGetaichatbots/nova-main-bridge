import sys
import unittest
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import patch


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))


class _FakeBlueprint:
    def __init__(self, *_args, **_kwargs):
        self.routes = []

    def route(self, rule, methods=None):
        def decorator(func):
            self.routes.append((rule, tuple(methods or []), func.__name__))
            return func

        return decorator


class _FakeRequest:
    headers = {}
    cookies = {}
    files = {}
    form = {}
    args = {}
    _json = {}

    def get_json(self):
        return self._json


def _install_import_stubs():
    fake_flask = ModuleType("flask")
    fake_flask.Blueprint = _FakeBlueprint
    fake_flask.request = _FakeRequest()
    fake_flask.jsonify = lambda payload=None, **kwargs: payload if payload is not None else kwargs
    fake_flask.send_file = lambda *args, **kwargs: ("send_file", args, kwargs)
    sys.modules.setdefault("flask", fake_flask)

    fake_psycopg2 = ModuleType("psycopg2")
    fake_psycopg2_extras = ModuleType("psycopg2.extras")
    fake_psycopg2_extras.RealDictCursor = object
    sys.modules.setdefault("psycopg2", fake_psycopg2)
    sys.modules.setdefault("psycopg2.extras", fake_psycopg2_extras)

    fake_urllib3 = ModuleType("urllib3")
    fake_urllib3.disable_warnings = lambda *_args, **_kwargs: None
    fake_urllib3.exceptions = SimpleNamespace(InsecureRequestWarning=Warning)
    sys.modules.setdefault("urllib3", fake_urllib3)

    fake_requests = ModuleType("requests")
    fake_requests.post = lambda *_args, **_kwargs: None
    fake_requests.get = lambda *_args, **_kwargs: None
    fake_requests.exceptions = SimpleNamespace(Timeout=TimeoutError, ConnectionError=ConnectionError)
    sys.modules.setdefault("requests", fake_requests)

    for name in [
        "utils.database",
        "utils.token_manager",
        "utils.audit_logger",
        "utils.redis_client",
        "utils.pdf_generator",
    ]:
        module = ModuleType(name)
        sys.modules.setdefault(name, module)

    sys.modules["utils.database"].get_db_connection = lambda: None
    sys.modules["utils.token_manager"].decode_token = lambda _token: None
    sys.modules["utils.audit_logger"].log_audit_event = lambda *_args, **_kwargs: None
    sys.modules["utils.redis_client"].cache_get = lambda *_args, **_kwargs: None
    sys.modules["utils.redis_client"].cache_set = lambda *_args, **_kwargs: None
    sys.modules["utils.redis_client"].cache_delete = lambda *_args, **_kwargs: None
    sys.modules["utils.pdf_generator"].generate_schedule_analysis_pdf = lambda *_args, **_kwargs: None
    sys.modules["utils.pdf_generator"].generate_dashboard_pdf = lambda *_args, **_kwargs: None
    sys.modules["utils.pdf_generator"].sanitize_filename = lambda value: value


_install_import_stubs()
from routes import schedule


class _Cursor:
    def __init__(self, rows=None, rowcount=1):
        self.rows = list(rows or [])
        self.executed = []
        self.rowcount = rowcount

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, query, params=None):
        self.executed.append((query, params))

    def fetchone(self):
        return self.rows.pop(0) if self.rows else None

    def fetchall(self):
        rows = self.rows
        self.rows = []
        return rows


class _Connection:
    def __init__(self, rows=None, rowcount=1):
        self.cursor_obj = _Cursor(rows, rowcount=rowcount)
        self.committed = False
        self.rolled_back = False
        self.closed = False

    def cursor(self, *args, **_kwargs):
        return self.cursor_obj

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        self.closed = True


class _AgentResponse:
    status_code = 200

    def json(self):
        return {"response": "<html><body>dashboard</body></html>"}

    def raise_for_status(self):
        return None


class ScheduleComparisonTests(unittest.TestCase):
    def test_init_comparison_tables_creates_dashboard_schema(self):
        conn = _Connection()

        with patch.object(schedule, "get_db_connection", return_value=conn):
            self.assertTrue(schedule.init_comparison_tables())

        sql = conn.cursor_obj.executed[0][0]
        self.assertIn("CREATE TABLE IF NOT EXISTS schedule_comparisons", sql)
        self.assertIn("dashboard_html TEXT", sql)
        self.assertIn("old_session_id VARCHAR(255)", sql)
        self.assertIn("new_session_id VARCHAR(255)", sql)
        self.assertTrue(conn.committed)
        self.assertTrue(conn.closed)

    def test_generate_comparison_calls_v5_graph_and_persists_dashboard(self):
        schedule.request._json = {
            "session_id": "session_1",
            "old_session_id": "old_1",
            "new_session_id": "new_1",
            "old_filename": "old.csv",
            "new_filename": "new.csv",
            "language": "en",
            "use_nusf": True,
        }
        first_conn = _Connection()
        second_conn = _Connection()

        with patch.object(schedule, "get_current_user", return_value={"user_id": 7, "company_id": 3}), \
             patch.object(schedule, "get_db_connection", side_effect=[first_conn, second_conn]), \
             patch.object(schedule.http_requests, "post", return_value=_AgentResponse()) as post:
            result = schedule.generate_comparison("cmp_123")

        self.assertEqual(result["success"], True)
        self.assertEqual(result["comparison_id"], "cmp_123")
        post.assert_called_once()
        self.assertEqual(post.call_args.kwargs["data"]["analysis_id"], "cmp_123")
        self.assertEqual(post.call_args.kwargs["data"]["format"], "html")
        self.assertIn("status='processing'", first_conn.cursor_obj.executed[0][0])
        self.assertIn(True, first_conn.cursor_obj.executed[0][1])
        self.assertIn("dashboard_html=%s", second_conn.cursor_obj.executed[0][0])
        self.assertTrue(first_conn.committed)
        self.assertTrue(second_conn.committed)

    def test_generate_comparison_returns_404_when_comparison_missing(self):
        schedule.request._json = {
            "session_id": "session_1",
            "old_session_id": "old_1",
            "new_session_id": "new_1",
        }
        conn = _Connection(rowcount=0)

        with patch.object(schedule, "get_current_user", return_value={"user_id": 7, "company_id": 3}), \
             patch.object(schedule, "get_db_connection", return_value=conn), \
             patch.object(schedule.http_requests, "post", return_value=_AgentResponse()) as post:
            result, status = schedule.generate_comparison("missing_cmp")

        self.assertEqual(status, 404)
        self.assertEqual(result["success"], False)
        self.assertEqual(result["error"], "Comparison not found")
        post.assert_not_called()
        self.assertTrue(conn.committed)
        self.assertTrue(conn.closed)

    def test_download_comparison_pdf_uses_dashboard_html(self):
        schedule.request.args = {"language": "en"}
        comparison = {
            "comparison_id": "cmp_123",
            "title": "Dashboard Export",
            "old_filename": "old.csv",
            "new_filename": "new.csv",
            "status": "completed",
            "dashboard_html": "<html><body><h1>Dashboard</h1></body></html>",
            "language": "en",
            "processing_time": 12.5,
            "created_at": "2026-06-23T09:30:00",
        }
        conn = _Connection(rows=[comparison])
        pdf_buffer = object()

        with patch.object(schedule, "get_current_user", return_value={"user_id": 7, "name": "User", "email": "u@example.com"}), \
             patch.object(schedule, "get_db_connection", return_value=conn), \
             patch.object(schedule, "generate_dashboard_pdf", return_value=pdf_buffer) as generate_pdf:
            result = schedule.download_comparison_pdf("cmp_123")

        self.assertEqual(result[0], "send_file")
        self.assertIs(result[1][0], pdf_buffer)
        self.assertEqual(result[2]["mimetype"], "application/pdf")
        self.assertEqual(result[2]["download_name"], "Nova_Insight_Dashboard Export.pdf")
        generate_pdf.assert_called_once_with(comparison, {"name": "User", "email": "u@example.com"}, "en")
        query, params = conn.cursor_obj.executed[0]
        self.assertIn("dashboard_html", query)
        self.assertEqual(params, ("cmp_123", 7))
        self.assertTrue(conn.closed)


if __name__ == "__main__":
    unittest.main()
