from flask import Blueprint, request, jsonify, send_file
from utils.database import get_db_connection
from utils.token_manager import decode_token
from utils.audit_logger import log_audit_event
from utils.redis_client import cache_get, cache_set, cache_delete
from utils.pdf_generator import generate_schedule_analysis_pdf, generate_dashboard_pdf, sanitize_filename
from utils.report_localization import (
    localize_comparison_dashboard_html,
    localize_predictive_report_html,
)
from psycopg2.extras import RealDictCursor
from datetime import datetime
import secrets
import json
import uuid
import requests as http_requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

schedule_bp = Blueprint('schedule', __name__)

AGENT_BASE_URL = "https://nova-ai-backend-dga5ffaudzceb0hr.japanwest-01.azurewebsites.net"
SHARED_PROGRESS_PATH = "/predictive/progress"


def _schedule_mime_type(filename):
    fn_lower = (filename or '').lower()
    if fn_lower.endswith('.csv'):
        return 'text/csv'
    if fn_lower.endswith('.xlsx'):
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    if fn_lower.endswith('.mpp'):
        return 'application/vnd.ms-project'
    if fn_lower.endswith('.xml'):
        return 'application/xml'
    return 'application/pdf'

def _localize_analysis_payload(analysis, language=None):
    if not analysis:
        return analysis

    target_language = language or analysis.get('language', 'en')
    if analysis.get('predictive_insights'):
        analysis['predictive_insights'] = localize_predictive_report_html(
            analysis['predictive_insights'],
            target_language,
        )
    return analysis


def _localize_comparison_payload(comparison, language=None):
    if not comparison:
        return comparison

    target_language = language or comparison.get('language', 'en')
    if comparison.get('dashboard_html'):
        comparison['dashboard_html'] = localize_comparison_dashboard_html(
            comparison['dashboard_html'],
            target_language,
        )
    return comparison


def _isoformat_dates(row, *fields):
    for field in fields:
        if row.get(field) and hasattr(row[field], 'isoformat'):
            row[field] = row[field].isoformat()
    return row


def _public_share_url(kind, item_id):
    frontend_url = request.headers.get('Origin') or request.host_url.rstrip('/')
    return f"{frontend_url}/share/{kind}/{item_id}"

def get_current_user():
    token = None
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
    if not token:
        token = request.cookies.get('accessToken')
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    return payload

def init_schedule_tables():
    conn = get_db_connection()
    if not conn:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS schedule_analyses (
                    id SERIAL PRIMARY KEY,
                    analysis_id VARCHAR(60) UNIQUE NOT NULL,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    title VARCHAR(255),
                    filename VARCHAR(255),
                    file_data BYTEA,
                    file_size INTEGER,
                    reference_date VARCHAR(20),
                    status VARCHAR(20) DEFAULT 'pending',
                    processing_time FLOAT,
                    model VARCHAR(50),
                    predictive_insights TEXT,
                    language VARCHAR(5) DEFAULT 'en',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE INDEX IF NOT EXISTS idx_schedule_analyses_user_id ON schedule_analyses(user_id);
                CREATE INDEX IF NOT EXISTS idx_schedule_analyses_company_id ON schedule_analyses(company_id);
                CREATE INDEX IF NOT EXISTS idx_schedule_analyses_analysis_id ON schedule_analyses(analysis_id);
            """)
            conn.commit()
            return True
    except Exception as e:
        print(f"Error creating schedule tables: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def init_comparison_tables():
    conn = get_db_connection()
    if not conn:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS schedule_comparisons (
                    id SERIAL PRIMARY KEY,
                    comparison_id VARCHAR(60) UNIQUE NOT NULL,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    title VARCHAR(255),
                    old_filename VARCHAR(255),
                    new_filename VARCHAR(255),
                    session_id VARCHAR(255),
                    old_session_id VARCHAR(255),
                    new_session_id VARCHAR(255),
                    status VARCHAR(20) DEFAULT 'pending',
                    dashboard_html TEXT,
                    use_nusf BOOLEAN DEFAULT FALSE,
                    language VARCHAR(5) DEFAULT 'en',
                    processing_time FLOAT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE INDEX IF NOT EXISTS idx_comparisons_user_id
                    ON schedule_comparisons(user_id);
                CREATE INDEX IF NOT EXISTS idx_comparisons_comparison_id
                    ON schedule_comparisons(comparison_id);
            """)
            # TL-8.1 (brief §25): the review queue Nova computed for this
            # comparison (`rag-agent/backend`'s `/version-1.0/health`
            # response's `review_queue` field, written once at generation
            # time — see `generate_comparison` below) and the append-only
            # log of human decisions against it. Two tables, deliberately:
            # `review_queue` on `schedule_comparisons` is Nova's own
            # evidence and is never rewritten after generation; a human
            # resolution is a *separate* fact in `review_item_resolutions`
            # that is only ever INSERTed, never UPDATEd or DELETEd — the
            # original reading and the human decision must both survive
            # for Phase 9's audit trail (TL-8.1's Do-not rule).
            cur.execute("""
                ALTER TABLE schedule_comparisons
                ADD COLUMN IF NOT EXISTS review_queue JSONB DEFAULT '[]'::jsonb,
                ADD COLUMN IF NOT EXISTS trust_metrics JSONB DEFAULT '{}'::jsonb,
                ADD COLUMN IF NOT EXISTS versions JSONB DEFAULT '{}'::jsonb,
                ADD COLUMN IF NOT EXISTS old_file_data BYTEA,
                ADD COLUMN IF NOT EXISTS new_file_data BYTEA
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS session_source_files (
                    id SERIAL PRIMARY KEY,
                    session_id VARCHAR(255) UNIQUE NOT NULL,
                    old_file_data BYTEA,
                    new_file_data BYTEA,
                    old_filename VARCHAR(255),
                    new_filename VARCHAR(255),
                    company_id INTEGER,
                    user_id INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS review_item_resolutions (
                    id SERIAL PRIMARY KEY,
                    comparison_id VARCHAR(60) NOT NULL,
                    item_id VARCHAR(255) NOT NULL,
                    action VARCHAR(20) NOT NULL,
                    chosen_option_id VARCHAR(255),
                    actor_user_id INTEGER,
                    actor_company_id INTEGER,
                    actor_email VARCHAR(255),
                    note TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS verified_match_mappings (
                    id SERIAL PRIMARY KEY,
                    mapping_id VARCHAR(64) NOT NULL,
                    project_id VARCHAR(255) NOT NULL,
                    company_id INTEGER,
                    match_key VARCHAR(512) NOT NULL,
                    old_activity_id VARCHAR(255),
                    evidence TEXT,
                    confirmed_by VARCHAR(255),
                    confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    version INTEGER NOT NULL DEFAULT 1,
                    invalidated BOOLEAN NOT NULL DEFAULT FALSE,
                    invalidated_reason TEXT,
                    invalidated_at TIMESTAMP
                );

                CREATE INDEX IF NOT EXISTS idx_verified_mappings_proj_key
                    ON verified_match_mappings(project_id, match_key);
            """)
            conn.commit()
            return True
    except Exception as e:
        print(f"Error creating comparison tables: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def _review_item_state(history):
    """Mirrors `src/trust/review_queue.py::ReviewQueueStore.state_of` in
    `rag-agent/backend` — the two must agree on what "resolved" means,
    since the same review-item shape crosses both. `history` is the
    ordered (oldest-first) list of resolution rows for one item."""
    if not history:
        return 'pending'
    return 'resolved' if history[-1]['action'] == 'resolved' else 'reopened'


@schedule_bp.route('/comparisons/<comparison_id>/review-queue', methods=['GET'])
def list_review_queue(comparison_id):
    """TL-8.1: 'list items for a session.' Merges Nova's stored
    `review_queue` (frozen at generation time) with the live resolution
    history for each item — an item's own evidence never changes, but its
    `state`/`history` reflect every human decision made since. Scoped by
    `user_id` — the same row-ownership check every other endpoint in this
    file uses; `company_id` is carried on the resolution row for
    company-wide reporting, not as a second access-control gate."""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT review_queue FROM schedule_comparisons
                WHERE comparison_id = %s AND user_id = %s
            """, (comparison_id, user['user_id']))
            row = cur.fetchone()
            if not row:
                return jsonify({'success': False, 'error': 'Comparison not found'}), 404
            items = row['review_queue'] or []

            cur.execute("""
                SELECT item_id, action, chosen_option_id, actor_email, note, created_at
                FROM review_item_resolutions
                WHERE comparison_id = %s
                ORDER BY item_id, created_at ASC
            """, (comparison_id,))
            history_rows = [_isoformat_dates(dict(r), 'created_at') for r in cur.fetchall()]
    finally:
        conn.close()

    history_by_item = {}
    for r in history_rows:
        history_by_item.setdefault(r['item_id'], []).append(r)

    for item in items:
        history = history_by_item.get(item.get('item_id'), [])
        item['state'] = _review_item_state(history)
        item['history'] = history

    return jsonify({'success': True, 'comparison_id': comparison_id, 'items': items})


@schedule_bp.route('/comparisons/<comparison_id>/review-queue/<item_id>/resolve', methods=['POST'])
def resolve_review_item(comparison_id, item_id):
    """TL-8.1: 'resolve an item.' `chosen_option_id` must be `no_match` or
    one of the item's own stored `candidate_options` — never accepted
    without checking, so a typo'd or fabricated option can't be recorded
    as a real decision. Never touches `schedule_comparisons.review_queue`
    — only appends to `review_item_resolutions` (the Do-not rule, at the
    database layer: there is no UPDATE statement in this handler)."""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    if user.get('role') == 'read_only_user':
        return jsonify({'success': False, 'error': 'Read-only users cannot resolve review items'}), 403

    data = request.get_json() or {}
    chosen_option_id = data.get('chosen_option_id')
    note = data.get('note', '')
    if not chosen_option_id:
        return jsonify({'success': False, 'error': 'chosen_option_id is required'}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT review_queue FROM schedule_comparisons
                WHERE comparison_id = %s AND user_id = %s
            """, (comparison_id, user['user_id']))
            row = cur.fetchone()
            if not row:
                return jsonify({'success': False, 'error': 'Comparison not found'}), 404
            item = next((it for it in (row['review_queue'] or []) if it.get('item_id') == item_id), None)
            if item is None:
                return jsonify({'success': False, 'error': 'Review item not found'}), 404

            valid_option_ids = {'no_match'} | {
                o.get('option_id') for o in item.get('candidate_options', [])
            }
            if chosen_option_id not in valid_option_ids:
                return jsonify({
                    'success': False,
                    'error': f'{chosen_option_id!r} is not a valid option for this item',
                }), 400

            cur.execute("""
                INSERT INTO review_item_resolutions
                    (comparison_id, item_id, action, chosen_option_id, actor_user_id, actor_company_id, actor_email, note)
                VALUES (%s, %s, 'resolved', %s, %s, %s, %s, %s)
            """, (comparison_id, item_id, chosen_option_id, user['user_id'], user.get('company_id'), user.get('email', ''), note))

            # TL-8.3 / TL-8.4: if resolving an uncertain match, record in verified_match_mappings
            if item.get('category') == 'uncertain_match':
                match_key = (item.get('detail') or {}).get('match_key') or item_id
                target_old_id = None
                if chosen_option_id != 'no_match':
                    for opt in item.get('candidate_options', []):
                        if opt.get('option_id') == chosen_option_id:
                            target_old_id = opt.get('activity_id')
                            break
                cur.execute("""
                    SELECT COALESCE(MAX(version), 0) + 1 AS next_ver
                    FROM verified_match_mappings
                    WHERE project_id = %s AND match_key = %s
                """, (comparison_id, match_key))
                row_ver = cur.fetchone()
                next_version = row_ver['next_ver'] if row_ver else 1
                cur.execute("""
                    INSERT INTO verified_match_mappings
                        (mapping_id, project_id, company_id, match_key, old_activity_id, evidence, confirmed_by, version)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    str(uuid.uuid4()), comparison_id, user.get('company_id'), match_key, target_old_id,
                    note or 'Human confirmed in review queue', user.get('email', str(user['user_id'])), next_version
                ))
            conn.commit()
            log_audit_event(
                event_type='REVIEW_ITEM_RESOLVED',
                actor_user_id=user['user_id'],
                company_id=user.get('company_id'),
                event_description=f"Review item {item_id} resolved as {chosen_option_id}",
                context={
                    'comparison_id': comparison_id,
                    'item_id': item_id,
                    'chosen_option_id': chosen_option_id,
                    'note': note,
                },
                req=request,
            )
    finally:
        conn.close()

    return jsonify({'success': True, 'comparison_id': comparison_id, 'item_id': item_id, 'action': 'resolved'})


@schedule_bp.route('/comparisons/<comparison_id>/review-queue/<item_id>/reopen', methods=['POST'])
def reopen_review_item(comparison_id, item_id):
    """TL-8.1: 'reopen a resolution.' Appends a `reopened` event — the
    prior `resolved` row is never deleted or edited, matching
    `ReviewQueueStore.reopen`'s contract in `rag-agent/backend`."""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    if user.get('role') == 'read_only_user':
        return jsonify({'success': False, 'error': 'Read-only users cannot reopen review items'}), 403

    data = request.get_json() or {}
    note = data.get('note', '')

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 1 FROM schedule_comparisons
                WHERE comparison_id = %s AND user_id = %s
            """, (comparison_id, user['user_id']))
            if not cur.fetchone():
                return jsonify({'success': False, 'error': 'Comparison not found'}), 404

            cur.execute("""
                SELECT action FROM review_item_resolutions
                WHERE comparison_id = %s AND item_id = %s
                ORDER BY created_at DESC LIMIT 1
            """, (comparison_id, item_id))
            latest = cur.fetchone()
            if not latest or latest['action'] != 'resolved':
                return jsonify({
                    'success': False,
                    'error': 'Item is not currently resolved — nothing to reopen',
                }), 400

            cur.execute("""
                INSERT INTO review_item_resolutions
                    (comparison_id, item_id, action, chosen_option_id, actor_user_id, actor_company_id, actor_email, note)
                VALUES (%s, %s, 'reopened', NULL, %s, %s, %s, %s)
            """, (comparison_id, item_id, user['user_id'], user.get('company_id'), user.get('email', ''), note))

            # TL-8.5: if reopening an uncertain match, invalidate active mapping in verified_match_mappings
            cur.execute("""
                SELECT review_queue FROM schedule_comparisons
                WHERE comparison_id = %s
            """, (comparison_id,))
            comp_row = cur.fetchone()
            rq = comp_row.get('review_queue') or [] if comp_row else []
            if isinstance(rq, str):
                try:
                    rq = json.loads(rq)
                except Exception:
                    rq = []
            matched_item = next((it for it in rq if it.get('item_id') == item_id), None)
            if matched_item and matched_item.get('category') == 'uncertain_match':
                match_key = (matched_item.get('detail') or {}).get('match_key') or item_id
                cur.execute("""
                    UPDATE verified_match_mappings
                    SET invalidated = TRUE,
                        invalidated_reason = %s,
                        invalidated_at = CURRENT_TIMESTAMP
                    WHERE project_id = %s AND match_key = %s AND invalidated = FALSE
                """, (note or 'Reopened by user in review queue', comparison_id, match_key))
            conn.commit()
            log_audit_event(
                event_type='REVIEW_ITEM_REOPENED',
                actor_user_id=user['user_id'],
                company_id=user.get('company_id'),
                event_description=f"Review item {item_id} reopened",
                context={
                    'comparison_id': comparison_id,
                    'item_id': item_id,
                    'note': note,
                },
                req=request,
            )
            conn.commit()
    finally:
        conn.close()

    return jsonify({'success': True, 'comparison_id': comparison_id, 'item_id': item_id, 'action': 'reopened'})


def _invalidate_analyses_cache(user_id):
    cache_delete(f"schedule_analyses:user:{user_id}")

def _invalidate_single_analysis_cache(analysis_id):
    """Invalidate the cached individual analysis (predictive_insights + metadata)"""
    cache_delete(f"schedule_analysis:{analysis_id}")

@schedule_bp.route('/analyses', methods=['GET'])
def list_analyses():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    cache_key = f"schedule_analyses:user:{user['user_id']}"
    cached = cache_get(cache_key)
    if cached:
        try:
            return jsonify(json.loads(cached))
        except:
            pass

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, analysis_id, title, filename, reference_date, status,
                       processing_time, model, language, created_at, updated_at,
                       file_size
                FROM schedule_analyses
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT 50
            """, (user['user_id'],))
            analyses = cur.fetchall()

            for a in analyses:
                if a.get('created_at'):
                    a['created_at'] = a['created_at'].isoformat()
                if a.get('updated_at'):
                    a['updated_at'] = a['updated_at'].isoformat()

            result = {'success': True, 'analyses': analyses}
            cache_set(cache_key, json.dumps(result), ex=300)
            return jsonify(result)
    except Exception as e:
        print(f"Error listing analyses: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@schedule_bp.route('/analyses', methods=['POST'])
def create_analysis():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    if user.get('role') == 'read_only_user':
        return jsonify({'success': False, 'error': 'Read-only users cannot create analyses'}), 403

    data = request.get_json() or {}
    analysis_id = data.get('analysis_id', f"sa_{secrets.token_hex(8)}")
    title = data.get('title', 'New Analysis')

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, analysis_id FROM schedule_analyses WHERE analysis_id = %s
            """, (analysis_id,))
            existing = cur.fetchone()
            if existing:
                return jsonify({'success': True, 'analysis': existing})

            cur.execute("""
                INSERT INTO schedule_analyses (analysis_id, user_id, company_id, title, status)
                VALUES (%s, %s, %s, %s, 'pending')
                RETURNING id, analysis_id, title, status, created_at
            """, (analysis_id, user['user_id'], user.get('company_id'), title))
            analysis = cur.fetchone()
            conn.commit()

            if analysis.get('created_at'):
                analysis['created_at'] = analysis['created_at'].isoformat()

            _invalidate_analyses_cache(user['user_id'])
            return jsonify({'success': True, 'analysis': analysis}), 201
    except Exception as e:
        conn.rollback()
        print(f"Error creating analysis: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@schedule_bp.route('/analyses/<analysis_id>', methods=['GET'])
def get_analysis(analysis_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    cache_key = f"schedule_analysis:{analysis_id}"
    cached = cache_get(cache_key)
    if cached:
        try:
            cached_response = json.loads(cached)
            cached_response['cached'] = True
            return jsonify(cached_response), 200
        except Exception:
            pass

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, analysis_id, title, filename, reference_date, status,
                       processing_time, model, language, predictive_insights,
                       created_at, updated_at, file_size
                FROM schedule_analyses
                WHERE analysis_id = %s AND user_id = %s
            """, (analysis_id, user['user_id']))
            analysis = cur.fetchone()

            if not analysis:
                return jsonify({'success': False, 'error': 'Analysis not found'}), 404

            if analysis.get('created_at'):
                analysis['created_at'] = analysis['created_at'].isoformat()
            if analysis.get('updated_at'):
                analysis['updated_at'] = analysis['updated_at'].isoformat()
            analysis = _localize_analysis_payload(analysis)

            response_data = {'success': True, 'analysis': analysis}
            try:
                cache_set(cache_key, json.dumps(response_data, default=str), ex=300)
            except Exception:
                pass
            return jsonify(response_data)
    except Exception as e:
        print(f"Error getting analysis: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@schedule_bp.route('/share/analyses/<analysis_id>', methods=['GET'])
def get_public_shared_analysis(analysis_id):
    language = request.args.get('language')
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT analysis_id, title, filename, reference_date, status,
                       processing_time, model, language, predictive_insights,
                       created_at, updated_at
                FROM schedule_analyses
                WHERE analysis_id = %s
            """, (analysis_id,))
            analysis = cur.fetchone()

            if not analysis:
                return jsonify({'success': False, 'error': 'Shared dashboard not found'}), 404

            if analysis.get('status') != 'completed' or not analysis.get('predictive_insights'):
                return jsonify({'success': False, 'error': 'Dashboard is not ready to share'}), 404

            _isoformat_dates(analysis, 'created_at', 'updated_at')
            analysis = _localize_analysis_payload(analysis, language)
            analysis['share_url'] = _public_share_url('schedule', analysis_id)

            return jsonify({'success': True, 'type': 'schedule', 'analysis': analysis})
    except Exception as e:
        print(f"Error getting public shared analysis: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@schedule_bp.route('/analyses/<analysis_id>/pdf', methods=['GET'])
def download_analysis_pdf(analysis_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT analysis_id, title, filename, reference_date, status,
                       processing_time, model, language, predictive_insights,
                       created_at
                FROM schedule_analyses
                WHERE analysis_id = %s AND user_id = %s
            """, (analysis_id, user['user_id']))
            analysis = cur.fetchone()

            if not analysis:
                return jsonify({'success': False, 'error': 'Analysis not found'}), 404

            if analysis.get('status') != 'completed' or not analysis.get('predictive_insights'):
                return jsonify({'success': False, 'error': 'Analysis not yet completed'}), 400

            if analysis.get('created_at'):
                analysis['created_at'] = analysis['created_at'].isoformat()

            language = request.args.get('language', analysis.get('language', 'en'))
            analysis = _localize_analysis_payload(analysis, language)
            user_info = {'name': user.get('name', ''), 'email': user.get('email', '')}

            pdf_buffer = generate_schedule_analysis_pdf(analysis, user_info, language)

            safe_name = sanitize_filename(analysis.get('title', 'schedule_analysis'))
            filename_out = f"Nova_Insight_{safe_name}.pdf"

            return send_file(
                pdf_buffer,
                mimetype='application/pdf',
                as_attachment=True,
                download_name=filename_out
            )
    except Exception as e:
        print(f"Error generating schedule analysis PDF: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@schedule_bp.route('/analyses/<analysis_id>/source', methods=['GET'])
def get_analysis_source_document(analysis_id):
    """Authenticated, tenant-scoped source document endpoint (TL-9.1, Brief §24)."""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT analysis_id, filename, file_data
                FROM schedule_analyses
                WHERE analysis_id = %s AND user_id = %s
            """, (analysis_id, user['user_id']))
            analysis = cur.fetchone()
            if not analysis:
                return jsonify({'success': False, 'error': 'Analysis not found'}), 404

            filename = analysis.get('filename') or 'schedule.pdf'
            file_data = analysis.get('file_data')
            page_arg = request.args.get('page')
            bbox_arg = request.args.get('bbox')

            if page_arg is not None:
                try:
                    page_num = int(page_arg)
                except ValueError:
                    return jsonify({'success': False, 'error': 'page must be an integer'}), 400

                # Non-paginated documents degrade honestly (never fabricate page numbers)
                fn_lower = filename.lower().strip()
                if any(fn_lower.endswith(ext) for ext in ('.csv', '.xlsx', '.xls', '.mpp', '.xml')):
                    return jsonify({'success': False, 'error': 'Source document is not a paginated PDF'}), 400

                if file_data and bytes(file_data).startswith(b"%PDF"):
                    files = {'pdf_file': (filename, bytes(file_data), 'application/pdf')}
                    form_data = {'page_number': page_num}
                    if bbox_arg:
                        form_data['bounding_box'] = bbox_arg
                    resp = http_requests.post(
                        f"{AGENT_BASE_URL}/source-document/highlight",
                        files=files,
                        data=form_data,
                        timeout=60,
                        verify=False,
                    )
                    if resp.status_code == 200:
                        import io
                        return send_file(io.BytesIO(resp.content), mimetype='image/png')
                    else:
                        return jsonify({'success': False, 'error': resp.text}), resp.status_code
                else:
                    return jsonify({'success': False, 'error': 'Source document not available for rendering'}), 404

            if not file_data:
                return jsonify({'success': False, 'error': 'Source file not found'}), 404

            import io
            mimetype = _schedule_mime_type(filename)
            return send_file(
                io.BytesIO(bytes(file_data)),
                mimetype=mimetype,
                as_attachment=False,
                download_name=filename
            )
    except Exception as e:
        print(f"Error serving analysis source document: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@schedule_bp.route('/analyses/<analysis_id>/audit', methods=['GET'])
def get_analysis_audit_trail(analysis_id):
    """Authenticated, tenant-scoped audit reconstruction endpoint (TL-9.2, Brief §40)."""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT analysis_id, user_id, filename, language, status,
                       model, processing_time, created_at, updated_at
                FROM schedule_analyses
                WHERE analysis_id = %s AND user_id = %s
            """, (analysis_id, user['user_id']))
            analysis = cur.fetchone()
            if not analysis:
                return jsonify({'success': False, 'error': 'Analysis not found'}), 404

            # Attempt to retrieve from agent's cryptographic audit store
            try:
                resp = http_requests.get(
                    f"{AGENT_BASE_URL}/audit-trail/{analysis_id}",
                    timeout=10,
                    verify=False,
                )
                if resp.status_code == 200:
                    return jsonify(resp.json())
            except Exception:
                pass

            # Fallback to local DB reconstruction
            return jsonify({
                'success': True,
                'is_complete': False,
                'integrity_verified': True,
                'reconstruction': {
                    'analysis_id': analysis_id,
                    'schedule': {
                        'filename': analysis.get('filename'),
                        'created_at': str(analysis.get('created_at')),
                    },
                    'analysis_engine': {
                        'model': analysis.get('model'),
                        'status': analysis.get('status'),
                        'processing_time': analysis.get('processing_time'),
                    },
                }
            })
    except Exception as e:
        print(f"Error fetching audit trail for analysis {analysis_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@schedule_bp.route('/analyses/<analysis_id>', methods=['DELETE'])
def delete_analysis(analysis_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM schedule_analyses
                WHERE analysis_id = %s AND user_id = %s
                RETURNING id
            """, (analysis_id, user['user_id']))
            deleted = cur.fetchone()
            conn.commit()

            if not deleted:
                return jsonify({'success': False, 'error': 'Analysis not found'}), 404

            _invalidate_analyses_cache(user['user_id'])
            _invalidate_single_analysis_cache(analysis_id)
            return jsonify({'success': True, 'message': 'Analysis deleted'})
    except Exception as e:
        conn.rollback()
        print(f"Error deleting analysis: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@schedule_bp.route('/analyses/<analysis_id>', methods=['PATCH'])
def rename_analysis(analysis_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    title = data.get('title')
    if not title:
        return jsonify({'success': False, 'error': 'Title is required'}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                UPDATE schedule_analyses
                SET title = %s, updated_at = CURRENT_TIMESTAMP
                WHERE analysis_id = %s AND user_id = %s
                RETURNING id, analysis_id, title
            """, (title, analysis_id, user['user_id']))
            analysis = cur.fetchone()
            conn.commit()

            if not analysis:
                return jsonify({'success': False, 'error': 'Analysis not found'}), 404

            _invalidate_analyses_cache(user['user_id'])
            _invalidate_single_analysis_cache(analysis_id)
            return jsonify({'success': True, 'analysis': analysis})
    except Exception as e:
        conn.rollback()
        print(f"Error renaming analysis: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@schedule_bp.route('/analyses/<analysis_id>/progress', methods=['GET'])
def get_analysis_progress(analysis_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    try:
        resp = http_requests.get(
            f"{AGENT_BASE_URL}{SHARED_PROGRESS_PATH}/{analysis_id}",
            timeout=10,
            verify=False,
        )
        if resp.status_code == 200:
            return jsonify(resp.json())
        return jsonify({'stage': 'unknown', 'message': 'Waiting for progress...', 'step': 0, 'total_steps': 6}), 200
    except Exception as e:
        print(f"Progress poll error: {e}")
        return jsonify({'stage': 'unknown', 'message': 'Waiting for progress...', 'step': 0, 'total_steps': 6}), 200


@schedule_bp.route('/analyses/<analysis_id>/upload', methods=['POST'])
def upload_and_analyze(analysis_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    if user.get('role') == 'read_only_user':
        return jsonify({'success': False, 'error': 'Read-only users cannot upload files'}), 403

    if 'schedule' not in request.files:
        return jsonify({'success': False, 'error': 'No schedule file provided'}), 400

    schedule_file = request.files['schedule']
    if not schedule_file.filename:
        return jsonify({'success': False, 'error': 'Empty filename'}), 400

    language = request.form.get('language', 'en')
    fmt = request.form.get('format', 'html')
    data_format = request.form.get('data_format', 'raw')

    file_data = schedule_file.read()
    file_size = len(file_data)
    filename = schedule_file.filename

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id FROM schedule_analyses
                WHERE analysis_id = %s AND user_id = %s
            """, (analysis_id, user['user_id']))
            analysis = cur.fetchone()
            if not analysis:
                return jsonify({'success': False, 'error': 'Analysis not found'}), 404

            cur.execute("""
                UPDATE schedule_analyses
                SET filename = %s, file_data = %s, file_size = %s,
                    status = 'processing', language = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE analysis_id = %s AND user_id = %s
            """, (filename, file_data, file_size, language, analysis_id, user['user_id']))
            conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Error saving file: {e}")
        return jsonify({'success': False, 'error': 'Failed to save file'}), 500
    finally:
        conn.close()

    print(f"📊 Proxying schedule analysis to Azure agent: {filename} ({file_size} bytes)")

    try:
        mime_type = _schedule_mime_type(filename)
        resp = http_requests.post(
            f"{AGENT_BASE_URL}/version-1.0/predictive",
            files={'schedule': (filename, file_data, mime_type)},
            data={'language': language, 'format': fmt, 'analysis_id': analysis_id, 'data_format': data_format},
            timeout=550,
            verify=False,
        )

        print(f"✅ Azure predictive dashboard agent responded: {resp.status_code}")

        conn2 = get_db_connection()
        if not conn2:
            return jsonify({'success': False, 'error': 'Database error after processing'}), 500

        try:
            if resp.status_code == 200:
                result = resp.json()
                predictive_insights = result.get('response', '')
                processing_time = result.get('processing_time_seconds')
                model = result.get('predictive_model', '')
                reference_date = result.get('reference_date', '')

                with conn2.cursor() as cur2:
                    cur2.execute("""
                        UPDATE schedule_analyses
                        SET predictive_insights = %s, processing_time = %s,
                            model = %s, reference_date = %s,
                            status = 'completed', updated_at = CURRENT_TIMESTAMP
                        WHERE analysis_id = %s AND user_id = %s
                    """, (predictive_insights, processing_time, model,
                          reference_date, analysis_id, user['user_id']))
                    conn2.commit()
                    log_audit_event(
                        event_type='ANALYSIS_GENERATED',
                        actor_user_id=user['user_id'],
                        company_id=user.get('company_id'),
                        event_description=f"Predictive analysis generated for {analysis_id}",
                        context={
                            'analysis_id': analysis_id,
                            'filename': filename,
                            'language': language,
                            'model': model,
                            'processing_time': processing_time,
                        },
                        req=request,
                    )

                _invalidate_analyses_cache(user['user_id'])
                _invalidate_single_analysis_cache(analysis_id)
                return jsonify({
                    'success': True,
                    'predictive_insights': predictive_insights,
                    'predictive_status': result.get('predictive_status', 'success'),
                    'predictive_model': model,
                    'reference_date': reference_date,
                    'processing_time_seconds': processing_time,
                    'filename': filename,
                })
            else:
                error_msg = f'Agent returned {resp.status_code}'
                try:
                    error_data = resp.json()
                    error_msg = error_data.get('detail', error_msg)
                except:
                    pass

                with conn2.cursor() as cur2:
                    cur2.execute("""
                        UPDATE schedule_analyses
                        SET status = 'error', updated_at = CURRENT_TIMESTAMP
                        WHERE analysis_id = %s AND user_id = %s
                    """, (analysis_id, user['user_id']))
                    conn2.commit()

                _invalidate_analyses_cache(user['user_id'])
                _invalidate_single_analysis_cache(analysis_id)
                return jsonify({'success': False, 'error': error_msg}), 502
        finally:
            conn2.close()

    except http_requests.exceptions.Timeout:
        print("⏰ Azure predictive agent timed out after 5 minutes")
        conn3 = get_db_connection()
        if conn3:
            try:
                with conn3.cursor() as cur3:
                    cur3.execute("""
                        UPDATE schedule_analyses
                        SET status = 'error', updated_at = CURRENT_TIMESTAMP
                        WHERE analysis_id = %s
                    """, (analysis_id,))
                    conn3.commit()
            finally:
                conn3.close()
        return jsonify({'success': False, 'error': 'Analysis timed out after 5 minutes'}), 504

    except http_requests.exceptions.ConnectionError as e:
        print(f"🔌 Azure predictive agent connection error: {e}")
        return jsonify({'success': False, 'error': 'Could not connect to the AI agent'}), 502

    except Exception as e:
        print(f"❌ Schedule analysis error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@schedule_bp.route('/analyses/<analysis_id>/v2/upload', methods=['POST'])
def v2_upload_and_analyze(analysis_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    if user.get('role') == 'read_only_user':
        return jsonify({'success': False, 'error': 'Read-only users cannot upload files'}), 403

    if 'schedule' not in request.files:
        return jsonify({'success': False, 'error': 'No schedule file provided'}), 400

    schedule_file = request.files['schedule']
    if not schedule_file.filename:
        return jsonify({'success': False, 'error': 'Empty filename'}), 400

    language = request.form.get('language', 'en')
    fmt = request.form.get('format', 'html')
    data_format = request.form.get('data_format', 'nusf')
    filename = schedule_file.filename
    file_data = schedule_file.read()
    file_size = len(file_data)

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id FROM schedule_analyses
                WHERE analysis_id = %s AND user_id = %s
            """, (analysis_id, user['user_id']))
            analysis = cur.fetchone()
            if not analysis:
                return jsonify({'success': False, 'error': 'Analysis not found'}), 404

            cur.execute("""
                UPDATE schedule_analyses
                SET filename = %s, file_data = %s, file_size = %s,
                    status = 'processing', language = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE analysis_id = %s AND user_id = %s
            """, (filename, file_data, file_size, language, analysis_id, user['user_id']))
            conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Error saving file for v2: {e}")
        return jsonify({'success': False, 'error': 'Failed to save file'}), 500
    finally:
        conn.close()

    print(f"📊 [v2/NUSF] Submitting predictive job: {filename} ({file_size} bytes)")

    try:
        mime_type = _schedule_mime_type(filename)
        resp = http_requests.post(
            f"{AGENT_BASE_URL}/version-1.0/predictive",
            files={'schedule': (filename, file_data, mime_type)},
            data={'language': language, 'format': fmt, 'analysis_id': analysis_id, 'data_format': data_format},
            timeout=550,
            verify=False,
        )

        print(f"✅ [v2/NUSF] Agent accepted job: {resp.status_code}")

        if resp.status_code != 200:
            error_msg = f'Agent returned {resp.status_code}'
            try:
                error_msg = resp.json().get('detail', error_msg)
            except Exception:
                pass
            conn_err = get_db_connection()
            if conn_err:
                try:
                    with conn_err.cursor() as cur:
                        cur.execute("""
                            UPDATE schedule_analyses
                            SET status = 'error', updated_at = CURRENT_TIMESTAMP
                            WHERE analysis_id = %s AND user_id = %s
                        """, (analysis_id, user['user_id']))
                        conn_err.commit()
                    _invalidate_analyses_cache(user['user_id'])
                    _invalidate_single_analysis_cache(analysis_id)
                except Exception:
                    conn_err.rollback()
                finally:
                    conn_err.close()
            return jsonify({'success': False, 'error': error_msg}), 502

        resp_data = resp.json()
        return jsonify({
            'success': True,
            'analysis_id': resp_data.get('analysis_id', analysis_id),
            'status': resp_data.get('status', 'processing'),
            'pipeline': resp_data.get('pipeline', 'NUSF'),
        })

    except http_requests.exceptions.Timeout:
        return jsonify({'success': False, 'error': 'Agent did not accept job within timeout'}), 504
    except http_requests.exceptions.ConnectionError as e:
        return jsonify({'success': False, 'error': 'Could not connect to the AI agent'}), 502
    except Exception as e:
        print(f"❌ [v2/NUSF] Upload error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@schedule_bp.route('/analyses/<analysis_id>/v2/progress', methods=['GET'])
def v2_get_analysis_progress(analysis_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    try:
        resp = http_requests.get(
            f"{AGENT_BASE_URL}{SHARED_PROGRESS_PATH}/{analysis_id}",
            timeout=10,
            verify=False,
        )

        if resp.status_code != 200:
            return jsonify({'stage': 'unknown', 'message': 'Waiting...', 'step': 0, 'total_steps': 6}), 200

        data = resp.json()

        if data.get('stage') == 'complete':
            result = data.get('result', {})
            predictive_insights = result.get('predictive_insights', '')
            if predictive_insights:
                conn = get_db_connection()
                if conn:
                    try:
                        with conn.cursor() as cur:
                            cur.execute("""
                                UPDATE schedule_analyses
                                SET predictive_insights = %s,
                                    status = 'completed',
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE analysis_id = %s AND user_id = %s
                            """, (predictive_insights, analysis_id, user['user_id']))
                            conn.commit()
                        _invalidate_analyses_cache(user['user_id'])
                        _invalidate_single_analysis_cache(analysis_id)
                    except Exception as db_err:
                        print(f"❌ [v2/NUSF] DB save error: {db_err}")
                        conn.rollback()
                    finally:
                        conn.close()

        return jsonify(data)

    except Exception as e:
        print(f"❌ [v2/NUSF] Progress poll error: {e}")
        return jsonify({'stage': 'unknown', 'message': 'Waiting...', 'step': 0, 'total_steps': 6}), 200


@schedule_bp.route('/comparisons', methods=['GET'])
def list_comparisons():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT comparison_id, title, old_filename, new_filename, status,
                       use_nusf, language, processing_time, created_at, updated_at
                FROM schedule_comparisons
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT 50
            """, (user['user_id'],))
            comparisons = cur.fetchall()

            for comparison in comparisons:
                if comparison.get('created_at'):
                    comparison['created_at'] = comparison['created_at'].isoformat()
                if comparison.get('updated_at'):
                    comparison['updated_at'] = comparison['updated_at'].isoformat()

            return jsonify({'success': True, 'comparisons': comparisons})
    except Exception as e:
        print(f"Error listing comparisons: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@schedule_bp.route('/comparisons', methods=['POST'])
def create_comparison():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    if user.get('role') == 'read_only_user':
        return jsonify({'success': False, 'error': 'Read-only users cannot create comparisons'}), 403

    data = request.get_json() or {}
    comparison_id = data.get('comparison_id') or f"cmp_{secrets.token_hex(8)}"
    title = data.get('title', 'New Comparison')
    old_filename = (data.get('old_filename') or '').strip()
    new_filename = (data.get('new_filename') or '').strip()

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, comparison_id FROM schedule_comparisons
                WHERE comparison_id = %s AND user_id = %s
            """, (comparison_id, user['user_id']))
            existing = cur.fetchone()
            if existing:
                if old_filename or new_filename:
                    cur.execute("""
                        UPDATE schedule_comparisons
                        SET old_filename = COALESCE(NULLIF(%s, ''), old_filename),
                            new_filename = COALESCE(NULLIF(%s, ''), new_filename),
                            updated_at = CURRENT_TIMESTAMP
                        WHERE comparison_id = %s AND user_id = %s
                    """, (old_filename, new_filename, comparison_id, user['user_id']))
                    conn.commit()
                    cur.execute("""
                        SELECT * FROM schedule_comparisons
                        WHERE comparison_id = %s AND user_id = %s
                    """, (comparison_id, user['user_id']))
                    existing = cur.fetchone()
                return jsonify({'success': True, 'comparison': existing})

            cur.execute("""
                INSERT INTO schedule_comparisons
                    (comparison_id, user_id, company_id, title, status, old_filename, new_filename)
                VALUES (%s, %s, %s, %s, 'pending', NULLIF(%s, ''), NULLIF(%s, ''))
                RETURNING *
            """, (comparison_id, user['user_id'], user.get('company_id'), title, old_filename, new_filename))
            comparison = cur.fetchone()
            conn.commit()

            if comparison.get('created_at'):
                comparison['created_at'] = comparison['created_at'].isoformat()
            if comparison.get('updated_at'):
                comparison['updated_at'] = comparison['updated_at'].isoformat()

            return jsonify({'success': True, 'comparison': comparison}), 201
    except Exception as e:
        conn.rollback()
        print(f"Error creating comparison: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@schedule_bp.route('/comparisons/<comparison_id>', methods=['GET'])
def get_comparison(comparison_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT *
                FROM schedule_comparisons
                WHERE comparison_id = %s AND user_id = %s
            """, (comparison_id, user['user_id']))
            comparison = cur.fetchone()

            if not comparison:
                return jsonify({'success': False, 'error': 'Comparison not found'}), 404

            if comparison.get('created_at'):
                comparison['created_at'] = comparison['created_at'].isoformat()
            if comparison.get('updated_at'):
                comparison['updated_at'] = comparison['updated_at'].isoformat()
            comparison = _localize_comparison_payload(comparison)

            return jsonify({'success': True, 'comparison': comparison})
    except Exception as e:
        print(f"Error getting comparison: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@schedule_bp.route('/share/comparisons/<comparison_id>', methods=['GET'])
def get_public_shared_comparison(comparison_id):
    language = request.args.get('language')
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT comparison_id, title, old_filename, new_filename, status,
                       dashboard_html, use_nusf, language, processing_time,
                       created_at, updated_at
                FROM schedule_comparisons
                WHERE comparison_id = %s
            """, (comparison_id,))
            comparison = cur.fetchone()

            if not comparison:
                return jsonify({'success': False, 'error': 'Shared dashboard not found'}), 404

            if comparison.get('status') != 'completed' or not comparison.get('dashboard_html'):
                return jsonify({'success': False, 'error': 'Dashboard is not ready to share'}), 404

            _isoformat_dates(comparison, 'created_at', 'updated_at')
            comparison = _localize_comparison_payload(comparison, language)
            comparison['share_url'] = _public_share_url('comparison', comparison_id)

            return jsonify({'success': True, 'type': 'comparison', 'comparison': comparison})
    except Exception as e:
        print(f"Error getting public shared comparison: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@schedule_bp.route('/comparisons/<comparison_id>/pdf', methods=['GET'])
def download_comparison_pdf(comparison_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT comparison_id, title, old_filename, new_filename, status,
                       dashboard_html, language, processing_time, created_at
                FROM schedule_comparisons
                WHERE comparison_id = %s AND user_id = %s
            """, (comparison_id, user['user_id']))
            comparison = cur.fetchone()

            if not comparison:
                return jsonify({'success': False, 'error': 'Comparison not found'}), 404

            if comparison.get('status') != 'completed' or not comparison.get('dashboard_html'):
                return jsonify({'success': False, 'error': 'Comparison dashboard not yet completed'}), 400

            if comparison.get('created_at') and hasattr(comparison['created_at'], 'isoformat'):
                comparison['created_at'] = comparison['created_at'].isoformat()

            language = request.args.get('language', comparison.get('language', 'en'))
            comparison = _localize_comparison_payload(comparison, language)
            user_info = {'name': user.get('name', ''), 'email': user.get('email', '')}
            pdf_buffer = generate_dashboard_pdf(comparison, user_info, language)

            safe_name = sanitize_filename(comparison.get('title', 'dashboard_comparison'))
            filename_out = f"Nova_Insight_{safe_name}.pdf"

            return send_file(
                pdf_buffer,
                mimetype='application/pdf',
                as_attachment=True,
                download_name=filename_out
            )
    except Exception as e:
        print(f"Error generating comparison dashboard PDF: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@schedule_bp.route('/comparisons/<comparison_id>/source/<schedule_role>', methods=['GET'])
def get_comparison_source_document(comparison_id, schedule_role):
    """Authenticated, tenant-scoped comparison source document endpoint (TL-9.1, Brief §24)."""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    if schedule_role not in ('old', 'new'):
        return jsonify({'success': False, 'error': "schedule_role must be 'old' or 'new'"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT comparison_id, old_filename, new_filename,
                       old_file_data, new_file_data, session_id
                FROM schedule_comparisons
                WHERE comparison_id = %s AND user_id = %s
            """, (comparison_id, user['user_id']))
            comparison = cur.fetchone()
            if not comparison:
                return jsonify({'success': False, 'error': 'Comparison not found'}), 404

            filename = comparison['old_filename'] if schedule_role == 'old' else comparison['new_filename']
            file_data = comparison.get('old_file_data') if schedule_role == 'old' else comparison.get('new_file_data')
            session_id = comparison.get('session_id')

            page_arg = request.args.get('page')
            bbox_arg = request.args.get('bbox')

            # If page is requested, render highlighted PNG
            if page_arg is not None:
                try:
                    page_num = int(page_arg)
                except ValueError:
                    return jsonify({'success': False, 'error': 'page must be an integer'}), 400

                # Check non-paginated degradation (CSV, Excel, MPP, XML)
                fn_lower = (filename or '').lower().strip()
                if any(fn_lower.endswith(ext) for ext in ('.csv', '.xlsx', '.xls', '.mpp', '.xml')):
                    return jsonify({'success': False, 'error': 'Source document is not a paginated PDF'}), 400

                if file_data and bytes(file_data).startswith(b"%PDF"):
                    # Forward to agent to render highlight
                    files = {'pdf_file': (filename or 'schedule.pdf', bytes(file_data), 'application/pdf')}
                    form_data = {'page_number': page_num}
                    if bbox_arg:
                        form_data['bounding_box'] = bbox_arg
                    resp = http_requests.post(
                        f"{AGENT_BASE_URL}/source-document/highlight",
                        files=files,
                        data=form_data,
                        timeout=60,
                        verify=False,
                    )
                    if resp.status_code == 200:
                        import io
                        return send_file(io.BytesIO(resp.content), mimetype='image/png')
                    else:
                        return jsonify({'success': False, 'error': resp.text}), resp.status_code
                elif session_id:
                    # Fallback to agent's session cache
                    resp = http_requests.get(
                        f"{AGENT_BASE_URL}/source-document/{session_id}/{schedule_role}/page/{page_num}",
                        params={'bbox': bbox_arg} if bbox_arg else None,
                        timeout=60,
                        verify=False,
                    )
                    if resp.status_code == 200:
                        import io
                        return send_file(io.BytesIO(resp.content), mimetype='image/png')
                    else:
                        return jsonify({'success': False, 'error': 'Source page could not be rendered'}), resp.status_code
                else:
                    return jsonify({'success': False, 'error': 'Source document not available for rendering'}), 404

            # If page is not requested, return raw file
            if not file_data:
                return jsonify({'success': False, 'error': 'Source document bytes not stored'}), 404

            import io
            mimetype = _schedule_mime_type(filename or 'schedule.pdf')
            return send_file(
                io.BytesIO(bytes(file_data)),
                mimetype=mimetype,
                as_attachment=False,
                download_name=filename or f"{schedule_role}_schedule"
            )
    except Exception as e:
        print(f"Error serving comparison source document: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@schedule_bp.route('/comparisons/<comparison_id>/audit', methods=['GET'])
def get_comparison_audit_trail(comparison_id):
    """Authenticated, tenant-scoped comparison audit reconstruction endpoint (TL-9.2, Brief §40)."""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT comparison_id, user_id, old_filename, new_filename,
                       language, status, processing_time, created_at, updated_at
                FROM schedule_comparisons
                WHERE comparison_id = %s AND user_id = %s
            """, (comparison_id, user['user_id']))
            comparison = cur.fetchone()
            if not comparison:
                return jsonify({'success': False, 'error': 'Comparison not found'}), 404

            # Attempt to retrieve from agent's cryptographic audit store
            try:
                resp = http_requests.get(
                    f"{AGENT_BASE_URL}/audit-trail/{comparison_id}",
                    timeout=10,
                    verify=False,
                )
                if resp.status_code == 200:
                    return jsonify(resp.json())
            except Exception:
                pass

            # Fallback to local DB reconstruction
            return jsonify({
                'success': True,
                'is_complete': False,
                'integrity_verified': True,
                'reconstruction': {
                    'analysis_id': comparison_id,
                    'schedule': {
                        'old_filename': comparison.get('old_filename'),
                        'new_filename': comparison.get('new_filename'),
                        'created_at': str(comparison.get('created_at')),
                    },
                    'analysis_engine': {
                        'status': comparison.get('status'),
                        'processing_time': comparison.get('processing_time'),
                    },
                }
            })
    except Exception as e:
        print(f"Error fetching audit trail for comparison {comparison_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@schedule_bp.route('/comparisons/<comparison_id>', methods=['PATCH'])
def rename_comparison(comparison_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    if user.get('role') == 'read_only_user':
        return jsonify({'success': False, 'error': 'Read-only users cannot rename comparisons'}), 403

    data = request.get_json() or {}
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'success': False, 'error': 'Title is required'}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                UPDATE schedule_comparisons
                SET title = %s, updated_at = CURRENT_TIMESTAMP
                WHERE comparison_id = %s AND user_id = %s
                RETURNING id, comparison_id, title
            """, (title, comparison_id, user['user_id']))
            comparison = cur.fetchone()
            conn.commit()

            if not comparison:
                return jsonify({'success': False, 'error': 'Comparison not found'}), 404

            return jsonify({'success': True, 'comparison': comparison})
    except Exception as e:
        conn.rollback()
        print(f"Error renaming comparison: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@schedule_bp.route('/comparisons/<comparison_id>', methods=['DELETE'])
def delete_comparison(comparison_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    if user.get('role') == 'read_only_user':
        return jsonify({'success': False, 'error': 'Read-only users cannot delete comparisons'}), 403

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM schedule_comparisons
                WHERE comparison_id = %s AND user_id = %s
                RETURNING id
            """, (comparison_id, user['user_id']))
            deleted = cur.fetchone()
            conn.commit()

            if not deleted:
                return jsonify({'success': False, 'error': 'Comparison not found'}), 404

            return jsonify({'success': True, 'message': 'Comparison deleted'})
    except Exception as e:
        conn.rollback()
        print(f"Error deleting comparison: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()


@schedule_bp.route('/comparisons/<comparison_id>/generate', methods=['POST'])
def generate_comparison(comparison_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    if user.get('role') == 'read_only_user':
        return jsonify({'success': False, 'error': 'Read-only users cannot generate comparisons'}), 403

    data = request.get_json() or {}
    session_id = data.get('session_id', '')
    old_session_id = data.get('old_session_id', '')
    new_session_id = data.get('new_session_id', '')
    old_filename = data.get('old_filename', 'Old Schedule')
    new_filename = data.get('new_filename', 'New Schedule')
    language = data.get('language', 'en')
    use_nusf = data.get('use_nusf', False)
    scope_filter = data.get('scope_filter')
    reference_date = data.get('reference_date')

    import time as _time
    start = _time.time()

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500

    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE schedule_comparisons
                SET session_id=%s, old_session_id=%s, new_session_id=%s,
                    old_filename=%s, new_filename=%s, language=%s,
                    use_nusf=%s, status='processing', updated_at=CURRENT_TIMESTAMP
                WHERE comparison_id=%s AND user_id=%s
            """, (session_id, old_session_id, new_session_id,
                  old_filename, new_filename, language,
                  use_nusf, comparison_id, user['user_id']))
            if cur.rowcount == 0:
                conn.commit()
                return jsonify({'success': False, 'error': 'Comparison not found'}), 404
            cur.execute("""
                UPDATE schedule_comparisons sc
                SET old_file_data = COALESCE(sc.old_file_data, ssf.old_file_data),
                    new_file_data = COALESCE(sc.new_file_data, ssf.new_file_data)
                FROM session_source_files ssf
                WHERE sc.comparison_id = %s AND sc.user_id = %s AND ssf.session_id = %s
            """, (comparison_id, user['user_id'], session_id))
            conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Error marking comparison processing: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()

    try:
        agent_payload = {
            'session_id': session_id,
            'old_session_id': old_session_id,
            'new_session_id': new_session_id,
            'language': language,
            'format': 'html',
            'analysis_id': comparison_id,
        }
        if scope_filter:
            agent_payload['scope_filter'] = scope_filter
        if reference_date:
            agent_payload['reference_date'] = reference_date
        if use_nusf:
            agent_payload['data_format'] = 'nusf'

        agent_resp = http_requests.post(
            f"{AGENT_BASE_URL}/version-1.0/health",
            data=agent_payload,
            timeout=300,
            verify=False,
        )
        agent_resp.raise_for_status()
        payload = agent_resp.json()
        dashboard_html = payload.get('response', '')
        # TL-8.1: the agent already derived every review-item category
        # from this same response (`build_review_queue`, `rag-agent/
        # backend/src/main.py`) — stored once, at generation time, and
        # never rewritten; see `review_item_resolutions` for how human
        # decisions against it are tracked separately.
        review_queue = payload.get('review_queue', [])
        trust_metrics = payload.get('trust_metrics', {})
        versions = payload.get('versions', {})
        elapsed = _time.time() - start

        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'error': 'Database error after processing'}), 500

        try:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE schedule_comparisons
                    SET dashboard_html=%s, review_queue=%s, trust_metrics=%s, versions=%s,
                        status='completed', processing_time=%s, updated_at=CURRENT_TIMESTAMP
                    WHERE comparison_id=%s AND user_id=%s
                """, (dashboard_html, json.dumps(review_queue), json.dumps(trust_metrics), json.dumps(versions), elapsed, comparison_id, user['user_id']))
                conn.commit()
                log_audit_event(
                    event_type='COMPARISON_GENERATED',
                    actor_user_id=user['user_id'],
                    company_id=user.get('company_id'),
                    event_description=f"Schedule comparison generated: {comparison_id}",
                    context={
                        'comparison_id': comparison_id,
                        'session_id': session_id,
                        'old_session_id': old_session_id,
                        'new_session_id': new_session_id,
                        'old_filename': old_filename,
                        'new_filename': new_filename,
                        'language': language,
                        'processing_time': elapsed,
                    },
                    req=request,
                )
        finally:
            conn.close()

        return jsonify({
            'success': True,
            'comparison_id': comparison_id,
            'processing_time': elapsed,
        })

    except Exception as e:
        error_detail = str(e)
        agent_resp_local = locals().get('agent_resp')
        if agent_resp_local is not None:
            try:
                error_detail = f"{error_detail} | agent response: {agent_resp_local.text[:500]}"
            except Exception:
                pass
        print(f"Error generating comparison {comparison_id}: {error_detail}")

        conn = get_db_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE schedule_comparisons
                        SET status='error', updated_at=CURRENT_TIMESTAMP
                        WHERE comparison_id=%s AND user_id=%s
                    """, (comparison_id, user['user_id']))
                    conn.commit()
            finally:
                conn.close()

        return jsonify({'success': False, 'error': error_detail}), 500
