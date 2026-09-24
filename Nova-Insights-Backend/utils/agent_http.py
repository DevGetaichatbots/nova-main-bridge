"""`requests` drop-in for calls to the AI backend: adds the shared internal key so
those calls skip the AI backend's per-IP rate limit (users are already limited here)."""
import os
import requests
from requests import exceptions  # noqa: F401  (callers use agent_http.exceptions.*)

_KEY = os.getenv('AI_INTERNAL_API_KEY', '')


def _with_key(kwargs):
    if _KEY:
        kwargs['headers'] = {'X-Internal-Key': _KEY, **(kwargs.get('headers') or {})}
    return kwargs


def get(url, **kwargs):
    return requests.get(url, **_with_key(kwargs))


def post(url, **kwargs):
    return requests.post(url, **_with_key(kwargs))
