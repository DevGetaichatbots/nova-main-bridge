from flask import Blueprint, request, jsonify, send_file
from utils.database import get_db_connection
from utils.token_manager import decode_token
from utils.audit_logger import log_audit_event
from utils.redis_client import cache_get, cache_set, cache_delete
from utils.pdf_generator import generate_schedule_analysis_pdf, sanitize_filename
from psycopg2.extras import RealDictCursor
from datetime import datetime
import secrets
import json
import requests as http_requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

schedule_bp = Blueprint('schedule', __name__)

AGENT_BASE_URL = "https://nova-azure-ai-rag-agent-fork.replit.app"

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
            f"{AGENT_BASE_URL}/predictive/progress/{analysis_id}",
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
        schedule_file.seek(0)
        mime_type = 'text/csv' if filename.lower().endswith('.csv') else 'application/pdf'
        resp = http_requests.post(
            f"{AGENT_BASE_URL}/predictive",
            files={'schedule': (filename, file_data, mime_type)},
            data={'language': language, 'format': fmt, 'analysis_id': analysis_id},
            timeout=550,
            verify=False,
        )

        print(f"✅ Azure predictive agent responded: {resp.status_code}")

        conn2 = get_db_connection()
        if not conn2:
            return jsonify({'success': False, 'error': 'Database error after processing'}), 500

        try:
            if resp.status_code == 200:
                result = resp.json()
                predictive_insights = result.get('predictive_insights', '')
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
