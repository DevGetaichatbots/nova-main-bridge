"""Minimal psycopg2 stand-in: rules = [(sql_substring, result_or_callable(params))]; first match wins."""


class FakeCursor:
    def __init__(self, rules):
        self.rules, self.executed, self._result = rules, [], None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        self.executed.append((sql, params))
        self._result = None
        for needle, result in self.rules:
            if needle in sql:
                self._result = result(params) if callable(result) else result
                if isinstance(self._result, Exception):
                    raise self._result
                break

    def fetchone(self):
        r = self._result
        return (r[0] if r else None) if isinstance(r, list) else r

    def fetchall(self):
        r = self._result
        return r if isinstance(r, list) else ([] if r is None else [r])


class FakeConn:
    def __init__(self, rules):
        self.cur = FakeCursor(rules)
        self.committed = self.rolled_back = False

    def cursor(self, *args, **kwargs):
        return self.cur

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        pass
