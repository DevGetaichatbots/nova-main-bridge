import json
import os
from flask import request, has_request_context

DEFAULT_LANG = 'da'  # matches frontend fallbackLng
_LOCALES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'locales')


def _load(lang):
    with open(os.path.join(_LOCALES_DIR, f'{lang}.json'), encoding='utf-8') as f:
        return json.load(f)


_CATALOGS = {
    name[:-5]: _load(name[:-5])
    for name in os.listdir(_LOCALES_DIR) if name.endswith('.json')
}


def get_lang():
    """Language from the Accept-Language header (sent by the frontend's i18n setup)."""
    if has_request_context():
        best = request.accept_languages.best_match(list(_CATALOGS))
        if best:
            return best
    return DEFAULT_LANG


def _lookup(lang, key):
    node = _CATALOGS.get(lang, {})
    for part in key.split('.'):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node if isinstance(node, str) else None


def t(key, lang=None, **params):
    """Translate `key` (e.g. 'user.not_found'); {{name}} placeholders filled from params."""
    text = _lookup(lang or get_lang(), key) or _lookup(DEFAULT_LANG, key) or key
    for name, value in params.items():
        text = text.replace('{{' + name + '}}', str(value))
    return text
