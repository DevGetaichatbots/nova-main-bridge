from flask import Blueprint, request, jsonify
from utils.database import get_db_connection
from utils.token_manager import decode_token
from utils.audit_logger import log_audit_event
from utils.redis_client import cache_get, cache_set, cache_delete
from psycopg2.extras import RealDictCursor
from datetime import datetime
import secrets
import json
import requests as http_requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

chat_bp = Blueprint('chat', __name__)

SESSIONS_CACHE_TTL = 60

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

def init_chat_tables():
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS chat_sessions (
                    id SERIAL PRIMARY KEY,
                    session_id VARCHAR(50) UNIQUE NOT NULL,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    title VARCHAR(255),
                    status VARCHAR(20) DEFAULT 'active',
                    old_session_id VARCHAR(50),
                    new_session_id VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
                CREATE INDEX IF NOT EXISTS idx_chat_sessions_company_id ON chat_sessions(company_id);
                CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions(session_id);
                
                CREATE TABLE IF NOT EXISTS chat_session_files (
                    id SERIAL PRIMARY KEY,
                    session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
                    file_type VARCHAR(20) NOT NULL,
                    original_filename VARCHAR(255) NOT NULL,
                    stored_filename VARCHAR(255),
                    file_size INTEGER,
                    mime_type VARCHAR(100),
                    file_data BYTEA,
                    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_chat_session_files_session_id ON chat_session_files(session_id);
                
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id SERIAL PRIMARY KEY,
                    session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
                    sender_type VARCHAR(20) NOT NULL,
                    content TEXT,
                    content_type VARCHAR(20) DEFAULT 'text',
                    is_html BOOLEAN DEFAULT FALSE,
                    metadata JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
                CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
                
                CREATE TABLE IF NOT EXISTS task_annotations (
                    id SERIAL PRIMARY KEY,
                    session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
                    message_id INTEGER REFERENCES chat_messages(id) ON DELETE CASCADE,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    task_key VARCHAR(500) NOT NULL,
                    task_name VARCHAR(500) NOT NULL,
                    annotation_text TEXT NOT NULL,
                    tags JSONB DEFAULT '[]',
                    is_private BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_task_annotations_session_id ON task_annotations(session_id);
                CREATE INDEX IF NOT EXISTS idx_task_annotations_company_id ON task_annotations(company_id);
                CREATE INDEX IF NOT EXISTS idx_task_annotations_task_key ON task_annotations(task_key);
            """)
            conn.commit()
            return True
    except Exception as e:
        print(f"Error creating chat tables: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def invalidate_sessions_cache(user_id, company_id=None):
    """Invalidate session list cache for a user (covers all paginated/view combinations)"""
    for page in range(1, 4):
        for limit in [20, 50, 100]:
            for view in ['own', 'company', 'all']:
                cache_delete(f"sessions:user:{user_id}:p{page}:l{limit}:v{view}")
    if company_id:
        cache_delete(f"sessions:company:{company_id}")


@chat_bp.route('/sessions', methods=['GET'])
def get_sessions():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    offset = (page - 1) * limit
    view_mode = request.args.get('view', 'own')

    cache_key = f"sessions:user:{user['user_id']}:p{page}:l{limit}:v{view_mode}"
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
        return jsonify({'success': False, 'error': 'Database connection failed'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT role, company_id FROM users WHERE id = %s", (user['user_id'],))
            user_data = cur.fetchone()
            user_role = user_data['role'] if user_data else 'user'
            user_company_id = user_data['company_id'] if user_data else None
            
            where_clause = "WHERE cs.user_id = %s"
            params = [user['user_id']]
            count_where = "WHERE user_id = %s"
            count_params = [user['user_id']]
            
            if view_mode == 'company' and user_role in ['company_owner', 'admin'] and user_company_id:
                where_clause = "WHERE cs.company_id = %s"
                params = [user_company_id]
                count_where = "WHERE company_id = %s"
                count_params = [user_company_id]
            elif view_mode == 'all' and user_role == 'super_admin':
                where_clause = ""
                params = []
                count_where = ""
                count_params = []
            
            query = f"""
                SELECT cs.*, 
                       COALESCE(CONCAT(u.first_name, ' ', u.last_name), c.name, u.email) as user_name,
                       u.email as user_email,
                       c.name as company_name,
                       COALESCE(json_agg(
                           json_build_object(
                               'id', csf.id,
                               'file_type', csf.file_type,
                               'original_filename', csf.original_filename,
                               'uploaded_at', csf.uploaded_at
                           )
                       ) FILTER (WHERE csf.id IS NOT NULL), '[]') as files,
                       (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id) as message_count,
                       (SELECT original_filename FROM chat_session_files WHERE session_id = cs.id AND file_type = 'old_schedule' LIMIT 1) as old_file_name,
                       (SELECT original_filename FROM chat_session_files WHERE session_id = cs.id AND file_type = 'new_schedule' LIMIT 1) as new_file_name
                FROM chat_sessions cs
                LEFT JOIN chat_session_files csf ON cs.id = csf.session_id
                LEFT JOIN users u ON cs.user_id = u.id
                LEFT JOIN companies c ON cs.company_id = c.id
                {where_clause}
                GROUP BY cs.id, u.first_name, u.last_name, u.email, c.name
                ORDER BY cs.last_activity_at DESC
                LIMIT %s OFFSET %s
            """
            params.extend([limit, offset])
            cur.execute(query, tuple(params))
            
            sessions = cur.fetchall()
            
            count_query = f"SELECT COUNT(*) FROM chat_sessions {count_where}"
            cur.execute(count_query, tuple(count_params) if count_params else None)
            total = cur.fetchone()['count']
            
            response_data = {
                'success': True,
                'sessions': sessions,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'total': total,
                    'totalPages': (total + limit - 1) // limit
                }
            }
            try:
                cache_set(cache_key, json.dumps(response_data, default=str), ex=SESSIONS_CACHE_TTL)
            except Exception:
                pass
            return jsonify(response_data)
    except Exception as e:
        print(f"Error fetching sessions: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch sessions'}), 500
    finally:
        conn.close()


@chat_bp.route('/sessions', methods=['POST'])
def create_session():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    data = request.get_json() or {}
    
    session_id = data.get('sessionId') or f"session_{''.join(secrets.token_hex(10))}"
    old_session_id = data.get('oldSessionId')
    new_session_id = data.get('newSessionId')
    title = data.get('title', '')
    old_file_name = data.get('oldFileName', '')
    new_file_name = data.get('newFileName', '')
    
    if not title and old_file_name and new_file_name:
        title = f"{old_file_name} vs {new_file_name}"
    elif not title:
        title = f"Chat {datetime.now().strftime('%d/%m %H:%M')}"
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database connection failed'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT company_id FROM users WHERE id = %s", (user['user_id'],))
            user_data = cur.fetchone()
            company_id = user_data['company_id'] if user_data else None
            
            cur.execute("""
                SELECT id, session_id, title, status, created_at FROM chat_sessions
                WHERE session_id = %s AND user_id = %s
            """, (session_id, user['user_id']))
            existing = cur.fetchone()
            
            if existing:
                return jsonify({
                    'success': True,
                    'session': {
                        'id': existing['id'],
                        'sessionId': existing['session_id'],
                        'title': existing['title'],
                        'status': existing['status'],
                        'createdAt': existing['created_at'].isoformat() if existing['created_at'] else None,
                        'oldSessionId': old_session_id,
                        'newSessionId': new_session_id
                    },
                    'existing': True
                })
            
            cur.execute("""
                INSERT INTO chat_sessions (session_id, user_id, company_id, title, old_session_id, new_session_id)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, session_id, title, status, created_at
            """, (session_id, user['user_id'], company_id, title, old_session_id, new_session_id))
            
            new_session = cur.fetchone()
            session_db_id = new_session['id']
            
            if old_file_name:
                cur.execute("""
                    INSERT INTO chat_session_files (session_id, file_type, original_filename)
                    VALUES (%s, %s, %s)
                """, (session_db_id, 'old_schedule', old_file_name))
            
            if new_file_name:
                cur.execute("""
                    INSERT INTO chat_session_files (session_id, file_type, original_filename)
                    VALUES (%s, %s, %s)
                """, (session_db_id, 'new_schedule', new_file_name))
            
            conn.commit()
            
            invalidate_sessions_cache(user['user_id'], company_id)
            
            log_audit_event(
                event_type='chat_created',
                actor_user_id=user['user_id'],
                company_id=company_id,
                event_description=f"Chat session created: {title}",
                context={'session_id': session_id, 'title': title}
            )
            
            return jsonify({
                'success': True,
                'session': {
                    'id': new_session['id'],
                    'sessionId': new_session['session_id'],
                    'title': new_session['title'],
                    'status': new_session['status'],
                    'createdAt': new_session['created_at'].isoformat() if new_session['created_at'] else None,
                    'oldSessionId': old_session_id,
                    'newSessionId': new_session_id
                }
            })
    except Exception as e:
        error_str = str(e)
        print(f"Error creating session: {e}")
        conn.rollback()
        return jsonify({'success': False, 'error': 'Failed to create session'}), 500
    finally:
        conn.close()


@chat_bp.route('/sessions/<session_id>', methods=['GET'])
def get_session(session_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database connection failed'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT role, company_id FROM users WHERE id = %s", (user['user_id'],))
            user_data = cur.fetchone()
            user_role = user_data['role'] if user_data else 'user'
            user_company_id = user_data['company_id'] if user_data else None
            
            cur.execute("""
                SELECT * FROM chat_sessions 
                WHERE session_id = %s
            """, (session_id,))
            
            session = cur.fetchone()
            if not session:
                return jsonify({'success': False, 'error': 'Session not found'}), 404
            
            is_owner = session['user_id'] == user['user_id']
            is_company_admin = user_role in ['company_owner', 'admin'] and session['company_id'] == user_company_id
            is_super_admin = user_role == 'super_admin'
            
            if not (is_owner or is_company_admin or is_super_admin):
                return jsonify({'success': False, 'error': 'Access denied'}), 403
            
            cur.execute("""
                SELECT * FROM chat_session_files 
                WHERE session_id = %s
                ORDER BY uploaded_at
            """, (session['id'],))
            files = cur.fetchall()
            
            return jsonify({
                'success': True,
                'session': {
                    **session,
                    'files': files
                }
            })
    except Exception as e:
        print(f"Error fetching session: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch session'}), 500
    finally:
        conn.close()


MESSAGES_CACHE_TTL = 120


def invalidate_messages_cache(session_id):
    """Invalidate messages cache for a session"""
    cache_delete(f"messages:{session_id}")


@chat_bp.route('/sessions/<session_id>/messages', methods=['GET'])
def get_messages(session_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    cache_key = f"messages:{session_id}"
    cached_data = cache_get(cache_key)
    if cached_data:
        try:
            cached_response = json.loads(cached_data)
            cached_response['cached'] = True
            return jsonify(cached_response), 200
        except:
            pass
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database connection failed'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT role, company_id FROM users WHERE id = %s", (user['user_id'],))
            user_data = cur.fetchone()
            user_role = user_data['role'] if user_data else 'user'
            user_company_id = user_data['company_id'] if user_data else None
            
            cur.execute("""
                SELECT cs.id, cs.user_id, cs.company_id FROM chat_sessions cs
                WHERE cs.session_id = %s
            """, (session_id,))
            
            session = cur.fetchone()
            if not session:
                return jsonify({'success': False, 'error': 'Session not found'}), 404
            
            is_owner = session['user_id'] == user['user_id']
            is_company_admin = user_role in ['company_owner', 'admin'] and session['company_id'] == user_company_id
            is_super_admin = user_role == 'super_admin'
            
            if not (is_owner or is_company_admin or is_super_admin):
                return jsonify({'success': False, 'error': 'Access denied'}), 403
            
            cur.execute("""
                SELECT id, sender_type, content, content_type, is_html, metadata, created_at
                FROM chat_messages
                WHERE session_id = %s
                ORDER BY created_at ASC
            """, (session['id'],))
            
            messages = cur.fetchall()
            
            serialized_messages = []
            for msg in messages:
                serialized_messages.append({
                    'id': msg['id'],
                    'sender_type': msg['sender_type'],
                    'content': msg['content'],
                    'content_type': msg['content_type'],
                    'is_html': msg['is_html'],
                    'metadata': msg['metadata'],
                    'created_at': msg['created_at'].isoformat() if msg['created_at'] else None
                })
            
            response_data = {
                'success': True,
                'messages': serialized_messages
            }
            
            cache_set(cache_key, json.dumps(response_data), ex=MESSAGES_CACHE_TTL)
            
            return jsonify(response_data)
    except Exception as e:
        print(f"Error fetching messages: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch messages'}), 500
    finally:
        conn.close()


@chat_bp.route('/sessions/<session_id>/messages', methods=['POST'])
def save_message(session_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'Request data required'}), 400
    
    sender_type = data.get('senderType', 'user')
    content = data.get('content', '')
    content_type = data.get('contentType', 'text')
    is_html = data.get('isHtml', False)
    metadata = data.get('metadata', {})
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database connection failed'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id FROM chat_sessions 
                WHERE session_id = %s AND user_id = %s
            """, (session_id, user['user_id']))
            
            session = cur.fetchone()
            if not session:
                return jsonify({'success': False, 'error': 'Session not found'}), 404
            
            import json
            cur.execute("""
                INSERT INTO chat_messages (session_id, sender_type, content, content_type, is_html, metadata)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, sender_type, content, content_type, is_html, created_at
            """, (session['id'], sender_type, content, content_type, is_html, json.dumps(metadata)))
            
            new_message = cur.fetchone()
            
            cur.execute("""
                UPDATE chat_sessions SET last_activity_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (session['id'],))
            
            conn.commit()
            
            invalidate_messages_cache(session_id)
            
            if sender_type == 'user':
                cur2_conn = get_db_connection()
                if cur2_conn:
                    try:
                        with cur2_conn.cursor(cursor_factory=RealDictCursor) as cur2:
                            cur2.execute("SELECT company_id FROM users WHERE id = %s", (user['user_id'],))
                            u_row = cur2.fetchone()
                            msg_company_id = u_row['company_id'] if u_row else None
                        log_audit_event(
                            event_type='message_sent',
                            actor_user_id=user['user_id'],
                            company_id=msg_company_id,
                            event_description=f"Message sent in session: {session_id}",
                            context={'session_id': session_id, 'message_id': new_message['id'], 'content_preview': (content or '')[:80]}
                        )
                    finally:
                        cur2_conn.close()
            
            return jsonify({
                'success': True,
                'message': new_message
            })
    except Exception as e:
        print(f"Error saving message: {e}")
        conn.rollback()
        return jsonify({'success': False, 'error': 'Failed to save message'}), 500
    finally:
        conn.close()


@chat_bp.route('/sessions/<session_id>/messages/<int:message_id>', methods=['PATCH'])
def update_message(session_id, message_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'Request data required'}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database connection failed'}), 500

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT cm.id, cm.metadata FROM chat_messages cm
                JOIN chat_sessions cs ON cm.session_id = cs.id
                WHERE cm.id = %s AND cs.session_id = %s AND cs.user_id = %s
            """, (message_id, session_id, user['user_id']))
            msg = cur.fetchone()
            if not msg:
                return jsonify({'success': False, 'error': 'Message not found'}), 404

            import json
            existing_meta = msg['metadata'] if isinstance(msg['metadata'], dict) else (json.loads(msg['metadata']) if msg['metadata'] else {})
            patch_meta = data.get('metadata', {})
            merged_meta = {**existing_meta, **patch_meta}

            updates = []
            params = []

            if 'content' in data:
                updates.append("content = %s")
                params.append(data['content'])

            updates.append("metadata = %s")
            params.append(json.dumps(merged_meta))
            params.append(msg['id'])

            cur.execute(f"""
                UPDATE chat_messages SET {', '.join(updates)}
                WHERE id = %s
                RETURNING id, metadata
            """, params)

            conn.commit()
            invalidate_messages_cache(session_id)
            return jsonify({'success': True})
    except Exception as e:
        print(f"Error updating message: {e}")
        conn.rollback()
        return jsonify({'success': False, 'error': 'Failed to update message'}), 500
    finally:
        conn.close()


@chat_bp.route('/sessions/<session_id>', methods=['PUT'])
def update_session(session_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'Request data required'}), 400
    
    title = data.get('title')
    status = data.get('status')
    old_session_id = data.get('oldSessionId')
    new_session_id = data.get('newSessionId')
    old_file_name = data.get('oldFileName')
    new_file_name = data.get('newFileName')
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database connection failed'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id FROM chat_sessions 
                WHERE session_id = %s AND user_id = %s
            """, (session_id, user['user_id']))
            
            session = cur.fetchone()
            if not session:
                return jsonify({'success': False, 'error': 'Session not found'}), 404
            
            session_db_id = session['id']
            updates = []
            params = []
            
            if title is not None:
                updates.append("title = %s")
                params.append(title)
            
            if status is not None:
                updates.append("status = %s")
                params.append(status)
            
            if old_session_id is not None:
                updates.append("old_session_id = %s")
                params.append(old_session_id)
            
            if new_session_id is not None:
                updates.append("new_session_id = %s")
                params.append(new_session_id)
            
            if updates:
                updates.append("updated_at = CURRENT_TIMESTAMP")
                updates.append("last_activity_at = CURRENT_TIMESTAMP")
                params.append(session_db_id)
                
                cur.execute(f"""
                    UPDATE chat_sessions 
                    SET {', '.join(updates)}
                    WHERE id = %s
                    RETURNING *
                """, params)
                
                updated_session = cur.fetchone()
            
            if old_file_name:
                cur.execute("SELECT id FROM chat_session_files WHERE session_id = %s AND file_type = 'old_schedule'", (session_db_id,))
                if not cur.fetchone():
                    cur.execute("INSERT INTO chat_session_files (session_id, file_type, original_filename) VALUES (%s, %s, %s)",
                                (session_db_id, 'old_schedule', old_file_name))
            
            if new_file_name:
                cur.execute("SELECT id FROM chat_session_files WHERE session_id = %s AND file_type = 'new_schedule'", (session_db_id,))
                if not cur.fetchone():
                    cur.execute("INSERT INTO chat_session_files (session_id, file_type, original_filename) VALUES (%s, %s, %s)",
                                (session_db_id, 'new_schedule', new_file_name))
            
            conn.commit()
            
            cur.execute("SELECT * FROM chat_sessions WHERE id = %s", (session_db_id,))
            final_session = cur.fetchone()
            
            cur.execute("SELECT company_id FROM users WHERE id = %s", (user['user_id'],))
            user_row = cur.fetchone()
            user_company_id = user_row['company_id'] if user_row else None
            
            update_context = {'session_id': session_id}
            event_type = 'chat_updated'
            description = f"Chat session updated: {session_id}"
            
            if title is not None:
                event_type = 'chat_renamed'
                description = f"Chat session renamed to: {title}"
                update_context['new_title'] = title
            if old_file_name:
                update_context['old_file_name'] = old_file_name
            if new_file_name:
                update_context['new_file_name'] = new_file_name
            
            log_audit_event(
                event_type=event_type,
                actor_user_id=user['user_id'],
                company_id=user_company_id,
                event_description=description,
                context=update_context
            )
            
            return jsonify({
                'success': True,
                'session': final_session
            })
    except Exception as e:
        print(f"Error updating session: {e}")
        conn.rollback()
        return jsonify({'success': False, 'error': 'Failed to update session'}), 500
    finally:
        conn.close()


@chat_bp.route('/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database connection failed'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT company_id FROM users WHERE id = %s", (user['user_id'],))
            user_data = cur.fetchone()
            company_id = user_data['company_id'] if user_data else None
            
            cur.execute("""
                DELETE FROM chat_sessions 
                WHERE session_id = %s AND user_id = %s
                RETURNING id
            """, (session_id, user['user_id']))
            
            deleted = cur.fetchone()
            if not deleted:
                return jsonify({'success': False, 'error': 'Session not found'}), 404
            
            conn.commit()
            
            invalidate_sessions_cache(user['user_id'], company_id)
            
            log_audit_event(
                event_type='chat_deleted',
                actor_user_id=user['user_id'],
                company_id=company_id,
                event_description=f"Chat session deleted: {session_id}",
                context={'session_id': session_id}
            )
            
            return jsonify({
                'success': True,
                'message': 'Session deleted successfully'
            })
    except Exception as e:
        print(f"Error deleting session: {e}")
        conn.rollback()
        return jsonify({'success': False, 'error': 'Failed to delete session'}), 500
    finally:
        conn.close()


@chat_bp.route('/sessions/<session_id>/files', methods=['POST'])
def upload_session_files(session_id):
    """Upload files (binary data) for a chat session with user/company isolation"""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    if 'old_schedule' not in request.files and 'new_schedule' not in request.files:
        return jsonify({'success': False, 'error': 'No files provided'}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database connection failed'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, user_id, company_id FROM chat_sessions 
                WHERE session_id = %s AND user_id = %s
            """, (session_id, user['user_id']))
            
            session = cur.fetchone()
            if not session:
                return jsonify({'success': False, 'error': 'Session not found or access denied'}), 404
            
            session_db_id = session['id']
            uploaded_files = []
            
            for file_type in ['old_schedule', 'new_schedule']:
                if file_type in request.files:
                    file = request.files[file_type]
                    if file.filename:
                        file_data = file.read()
                        file_size = len(file_data)
                        mime_type = file.content_type or 'application/octet-stream'
                        
                        cur.execute("""
                            SELECT id FROM chat_session_files 
                            WHERE session_id = %s AND file_type = %s
                        """, (session_db_id, file_type))
                        
                        existing = cur.fetchone()
                        
                        if existing:
                            cur.execute("""
                                UPDATE chat_session_files 
                                SET original_filename = %s, file_size = %s, mime_type = %s, 
                                    file_data = %s, uploaded_at = CURRENT_TIMESTAMP
                                WHERE id = %s
                                RETURNING id, file_type, original_filename, file_size, mime_type, uploaded_at
                            """, (file.filename, file_size, mime_type, file_data, existing['id']))
                        else:
                            cur.execute("""
                                INSERT INTO chat_session_files 
                                (session_id, file_type, original_filename, file_size, mime_type, file_data)
                                VALUES (%s, %s, %s, %s, %s, %s)
                                RETURNING id, file_type, original_filename, file_size, mime_type, uploaded_at
                            """, (session_db_id, file_type, file.filename, file_size, mime_type, file_data))
                        
                        saved_file = cur.fetchone()
                        uploaded_files.append({
                            'id': saved_file['id'],
                            'fileType': saved_file['file_type'],
                            'filename': saved_file['original_filename'],
                            'size': saved_file['file_size'],
                            'mimeType': saved_file['mime_type'],
                            'uploadedAt': saved_file['uploaded_at'].isoformat() if saved_file['uploaded_at'] else None
                        })
            
            # After uploading files, check if both files exist and update the session title
            cur.execute("""
                SELECT 
                    (SELECT original_filename FROM chat_session_files WHERE session_id = %s AND file_type = 'old_schedule' LIMIT 1) as old_file_name,
                    (SELECT original_filename FROM chat_session_files WHERE session_id = %s AND file_type = 'new_schedule' LIMIT 1) as new_file_name
            """, (session_db_id, session_db_id))
            
            file_names_result = cur.fetchone()
            old_file_name = file_names_result['old_file_name']
            new_file_name = file_names_result['new_file_name']
            new_title = None
            
            # Update session title to file-based format when both files are uploaded
            if old_file_name and new_file_name:
                new_title = f"📄 {old_file_name} ↔ {new_file_name}"
                cur.execute("""
                    UPDATE chat_sessions SET title = %s, last_activity_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (new_title, session_db_id))
            
            conn.commit()
            
            file_names = [f['filename'] for f in uploaded_files]
            log_audit_event(
                event_type='file_uploaded',
                actor_user_id=user['user_id'],
                company_id=session.get('company_id'),
                event_description=f"Files uploaded: {', '.join(file_names)}",
                context={'session_id': session_id, 'files': file_names}
            )
            
            return jsonify({
                'success': True,
                'files': uploaded_files,
                'message': f'{len(uploaded_files)} file(s) uploaded successfully',
                'title': new_title,
                'oldFileName': old_file_name,
                'newFileName': new_file_name
            })
    except Exception as e:
        print(f"Error uploading files: {e}")
        conn.rollback()
        return jsonify({'success': False, 'error': 'Failed to upload files'}), 500
    finally:
        conn.close()


@chat_bp.route('/sessions/<session_id>/files/<file_type>', methods=['GET'])
def download_session_file(session_id, file_type):
    """Download a file from a chat session with user/company isolation"""
    from flask import Response
    
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    if file_type not in ['old_schedule', 'new_schedule']:
        return jsonify({'success': False, 'error': 'Invalid file type'}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database connection failed'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT cs.id, cs.user_id, cs.company_id 
                FROM chat_sessions cs
                WHERE cs.session_id = %s AND cs.user_id = %s
            """, (session_id, user['user_id']))
            
            session = cur.fetchone()
            if not session:
                return jsonify({'success': False, 'error': 'Session not found or access denied'}), 404
            
            cur.execute("""
                SELECT original_filename, file_size, mime_type, file_data
                FROM chat_session_files
                WHERE session_id = %s AND file_type = %s
            """, (session['id'], file_type))
            
            file_record = cur.fetchone()
            if not file_record or not file_record['file_data']:
                return jsonify({'success': False, 'error': 'File not found'}), 404
            
            log_audit_event(
                event_type='file_downloaded',
                actor_user_id=user['user_id'],
                company_id=session.get('company_id'),
                event_description=f"File downloaded: {file_record['original_filename']}",
                context={'session_id': session_id, 'file_type': file_type, 'filename': file_record['original_filename']}
            )
            
            return Response(
                bytes(file_record['file_data']),
                mimetype=file_record['mime_type'] or 'application/octet-stream',
                headers={
                    'Content-Disposition': f'attachment; filename="{file_record["original_filename"]}"',
                    'Content-Length': str(file_record['file_size'] or len(file_record['file_data']))
                }
            )
    except Exception as e:
        print(f"Error downloading file: {e}")
        return jsonify({'success': False, 'error': 'Failed to download file'}), 500
    finally:
        conn.close()


# =============================================================================
# TASK ANNOTATIONS ENDPOINTS
# =============================================================================

@chat_bp.route('/sessions/<session_id>/annotations', methods=['GET'])
def get_annotations(session_id):
    """Get all annotations for a session (company-scoped)"""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database connection failed'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT company_id FROM users WHERE id = %s", (user['user_id'],))
            user_data = cur.fetchone()
            user_company_id = user_data['company_id'] if user_data else None
            
            cur.execute("""
                SELECT cs.id, cs.company_id FROM chat_sessions cs
                WHERE cs.session_id = %s AND (cs.user_id = %s OR cs.company_id = %s)
            """, (session_id, user['user_id'], user_company_id))
            session = cur.fetchone()
            
            if not session:
                return jsonify({'success': False, 'error': 'Session not found or access denied'}), 404
            
            cur.execute("""
                SELECT ta.id, ta.task_key, ta.task_name, ta.annotation_text, ta.tags, ta.is_private,
                       ta.created_at, ta.updated_at, ta.user_id,
                       u.first_name, u.last_name
                FROM task_annotations ta
                LEFT JOIN users u ON ta.user_id = u.id
                WHERE ta.session_id = %s 
                  AND ta.company_id = %s
                  AND (ta.is_private = FALSE OR ta.user_id = %s)
                ORDER BY ta.task_key, ta.created_at DESC
            """, (session['id'], user_company_id, user['user_id']))
            
            annotations = cur.fetchall()
            
            result = {}
            for ann in annotations:
                task_key = ann.get('task_key') or ann['task_name']
                if task_key not in result:
                    result[task_key] = []
                result[task_key].append({
                    'id': ann['id'],
                    'text': ann['annotation_text'],
                    'tags': ann['tags'] or [],
                    'isPrivate': ann['is_private'],
                    'createdAt': ann['created_at'].isoformat() if ann['created_at'] else None,
                    'updatedAt': ann['updated_at'].isoformat() if ann['updated_at'] else None,
                    'userId': ann['user_id'],
                    'authorName': f"{ann['first_name'] or ''} {ann['last_name'] or ''}".strip() or 'Unknown'
                })
            
            return jsonify({'success': True, 'annotations': result})
    except Exception as e:
        print(f"Error getting annotations: {e}")
        return jsonify({'success': False, 'error': 'Failed to get annotations'}), 500
    finally:
        conn.close()


@chat_bp.route('/sessions/<session_id>/annotations', methods=['POST'])
def create_annotation(session_id):
    """Create a new annotation for a task (company-scoped)"""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400
    
    task_key = data.get('taskKey', '').strip()
    task_name = data.get('taskName', '').strip()
    annotation_text = data.get('text', '').strip()
    tags = data.get('tags', [])
    is_private = data.get('isPrivate', False)
    message_id = data.get('messageId')
    
    if not task_key:
        task_key = task_name
    
    if not task_key or not annotation_text:
        return jsonify({'success': False, 'error': 'Task key and annotation text are required'}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database connection failed'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT company_id FROM users WHERE id = %s", (user['user_id'],))
            user_data = cur.fetchone()
            user_company_id = user_data['company_id'] if user_data else None
            
            cur.execute("""
                SELECT cs.id, cs.company_id FROM chat_sessions cs
                WHERE cs.session_id = %s AND (cs.user_id = %s OR cs.company_id = %s)
            """, (session_id, user['user_id'], user_company_id))
            session = cur.fetchone()
            
            if not session:
                return jsonify({'success': False, 'error': 'Session not found or access denied'}), 404
            
            cur.execute("""
                INSERT INTO task_annotations 
                (session_id, message_id, company_id, user_id, task_key, task_name, annotation_text, tags, is_private)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, created_at
            """, (session['id'], message_id, user_company_id, user['user_id'], 
                  task_key, task_name, annotation_text, json.dumps(tags), is_private))
            
            new_annotation = cur.fetchone()
            conn.commit()
            
            log_audit_event(
                event_type='annotation_created',
                actor_user_id=user['user_id'],
                company_id=user_company_id,
                event_description=f"Added annotation to task: {task_name[:50]}",
                context={'session_id': session_id, 'task_name': task_name, 'annotation_id': new_annotation['id']}
            )
            
            return jsonify({
                'success': True,
                'annotation': {
                    'id': new_annotation['id'],
                    'taskKey': task_key,
                    'taskName': task_name,
                    'text': annotation_text,
                    'tags': tags,
                    'isPrivate': is_private,
                    'createdAt': new_annotation['created_at'].isoformat() if new_annotation['created_at'] else None
                }
            }), 201
    except Exception as e:
        print(f"Error creating annotation: {e}")
        conn.rollback()
        return jsonify({'success': False, 'error': 'Failed to create annotation'}), 500
    finally:
        conn.close()


@chat_bp.route('/annotations/<int:annotation_id>', methods=['PUT'])
def update_annotation(annotation_id):
    """Update an existing annotation (owner only, company-scoped)"""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database connection failed'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT company_id FROM users WHERE id = %s", (user['user_id'],))
            user_data = cur.fetchone()
            user_company_id = user_data['company_id'] if user_data else None
            
            if user_company_id is None:
                return jsonify({'success': False, 'error': 'User must belong to a company'}), 403
            
            cur.execute("""
                SELECT id, user_id, company_id, task_key, task_name FROM task_annotations WHERE id = %s
            """, (annotation_id,))
            annotation = cur.fetchone()
            
            if not annotation:
                return jsonify({'success': False, 'error': 'Annotation not found'}), 404
            
            if annotation['company_id'] is None or annotation['company_id'] != user_company_id:
                return jsonify({'success': False, 'error': 'Access denied'}), 403
            
            if annotation['user_id'] != user['user_id']:
                return jsonify({'success': False, 'error': 'You can only edit your own annotations'}), 403
            
            annotation_text = data.get('text', '').strip()
            tags = data.get('tags', [])
            is_private = data.get('isPrivate', False)
            
            if not annotation_text:
                return jsonify({'success': False, 'error': 'Annotation text is required'}), 400
            
            cur.execute("""
                UPDATE task_annotations 
                SET annotation_text = %s, tags = %s, is_private = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING updated_at
            """, (annotation_text, json.dumps(tags), is_private, annotation_id))
            
            updated = cur.fetchone()
            conn.commit()
            
            return jsonify({
                'success': True,
                'annotation': {
                    'id': annotation_id,
                    'taskKey': annotation['task_key'],
                    'taskName': annotation['task_name'],
                    'text': annotation_text,
                    'tags': tags,
                    'isPrivate': is_private,
                    'updatedAt': updated['updated_at'].isoformat() if updated['updated_at'] else None
                }
            })
    except Exception as e:
        print(f"Error updating annotation: {e}")
        conn.rollback()
        return jsonify({'success': False, 'error': 'Failed to update annotation'}), 500
    finally:
        conn.close()


@chat_bp.route('/annotations/<int:annotation_id>', methods=['DELETE'])
def delete_annotation(annotation_id):
    """Delete an annotation (owner only, company-scoped)"""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database connection failed'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT company_id FROM users WHERE id = %s", (user['user_id'],))
            user_data = cur.fetchone()
            user_company_id = user_data['company_id'] if user_data else None
            
            if user_company_id is None:
                return jsonify({'success': False, 'error': 'User must belong to a company'}), 403
            
            cur.execute("""
                SELECT id, user_id, company_id, task_key, task_name FROM task_annotations WHERE id = %s
            """, (annotation_id,))
            annotation = cur.fetchone()
            
            if not annotation:
                return jsonify({'success': False, 'error': 'Annotation not found'}), 404
            
            if annotation['company_id'] is None or annotation['company_id'] != user_company_id:
                return jsonify({'success': False, 'error': 'Access denied'}), 403
            
            if annotation['user_id'] != user['user_id']:
                return jsonify({'success': False, 'error': 'You can only delete your own annotations'}), 403
            
            cur.execute("DELETE FROM task_annotations WHERE id = %s", (annotation_id,))
            conn.commit()
            
            log_audit_event(
                event_type='annotation_deleted',
                actor_user_id=user['user_id'],
                company_id=user_company_id,
                event_description=f"Deleted annotation from task: {annotation['task_name'][:50]}",
                context={'task_name': annotation['task_name'], 'annotation_id': annotation_id}
            )
            
            return jsonify({'success': True, 'message': 'Annotation deleted successfully'})
    except Exception as e:
        print(f"Error deleting annotation: {e}")
        conn.rollback()
        return jsonify({'success': False, 'error': 'Failed to delete annotation'}), 500
    finally:
        conn.close()


@chat_bp.route('/sessions/<session_id>/messages/<int:message_id>/pdf', methods=['GET'])
def download_message_pdf(session_id, message_id):
    from flask import send_file
    from utils.pdf_generator import generate_message_pdf, sanitize_filename
    import re as re_mod
    
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    language = request.args.get('lang', 'da')
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database connection failed'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT role, company_id, first_name, last_name, email FROM users WHERE id = %s", (user['user_id'],))
            user_data = cur.fetchone()
            user_role = user_data['role'] if user_data else 'user'
            user_company_id = user_data['company_id'] if user_data else None
            user_name = f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}".strip() or user_data.get('email', 'User')
            
            cur.execute("""
                SELECT cs.id, cs.user_id, cs.company_id, cs.title,
                       (SELECT original_filename FROM chat_session_files WHERE session_id = cs.id AND file_type = 'old_schedule' LIMIT 1) as old_file_name,
                       (SELECT original_filename FROM chat_session_files WHERE session_id = cs.id AND file_type = 'new_schedule' LIMIT 1) as new_file_name
                FROM chat_sessions cs
                WHERE cs.session_id = %s
            """, (session_id,))
            
            session = cur.fetchone()
            if not session:
                return jsonify({'success': False, 'error': 'Session not found'}), 404
            
            is_owner = session['user_id'] == user['user_id']
            is_company_admin = user_role in ['company_owner', 'admin'] and session['company_id'] == user_company_id
            is_super_admin = user_role == 'super_admin'
            
            if not (is_owner or is_company_admin or is_super_admin):
                return jsonify({'success': False, 'error': 'Access denied'}), 403
            
            cur.execute("""
                SELECT id, sender_type, content, content_type, is_html, metadata, created_at
                FROM chat_messages
                WHERE session_id = %s AND id = %s
            """, (session['id'], message_id))
            
            message = cur.fetchone()
            if not message:
                return jsonify({'success': False, 'error': 'Message not found'}), 404
            
            query_text = None
            if message['sender_type'] == 'bot':
                cur.execute("""
                    SELECT content FROM chat_messages
                    WHERE session_id = %s AND id < %s AND sender_type = 'user'
                    ORDER BY id DESC LIMIT 1
                """, (session['id'], message_id))
                prev_msg = cur.fetchone()
                if prev_msg:
                    query_text = prev_msg['content']
            else:
                query_text = message['content']
            
            message_data = {
                'id': message['id'],
                'sender_type': message['sender_type'],
                'content': message['content'],
                'content_type': message['content_type'],
                'is_html': message['is_html'],
                'metadata': message['metadata'],
                'created_at': message['created_at'].isoformat() if message['created_at'] else None
            }
            
            session_info = {
                'title': session['title'],
                'old_file_name': session['old_file_name'],
                'new_file_name': session['new_file_name']
            }
            
            user_info = {
                'name': user_name,
                'company': None
            }
            
            if user_company_id:
                cur.execute("SELECT name FROM companies WHERE id = %s", (user_company_id,))
                company = cur.fetchone()
                if company:
                    user_info['company'] = company['name']
            
            print(f"📄 Generating PDF for message_id={message_id}, session={session_id}")
            print(f"📄 Query text: {query_text[:50] if query_text else 'N/A'}")
            
            pdf_buffer = generate_message_pdf(message_data, session_info, user_info, language, query_text)
            
            if not pdf_buffer:
                return jsonify({'success': False, 'error': 'Failed to generate PDF content'}), 500
            
            date_str = datetime.now().strftime('%Y-%m-%d')
            if query_text:
                query_name = sanitize_filename(query_text, 40)
            elif session.get('title'):
                query_name = sanitize_filename(session['title'], 40)
            else:
                content_preview = (message_data.get('content', '') or '')[:60]
                query_name = sanitize_filename(content_preview, 40) if content_preview else f'message_{message_id}'
            filename = f"{query_name}_{date_str}.pdf"
            print(f"✅ PDF generated successfully: {filename}")
            
            log_audit_event(
                event_type='pdf_downloaded',
                actor_user_id=user['user_id'],
                company_id=user_company_id,
                event_description=f"PDF downloaded for message in session: {session['title'] or session_id}",
                context={'session_id': session_id, 'message_id': message_id, 'filename': filename}
            )
            
            return send_file(
                pdf_buffer,
                mimetype='application/pdf',
                as_attachment=True,
                download_name=filename
            )
    except Exception as e:
        print(f"❌ Error generating message PDF: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': f'Failed to generate PDF: {str(e)}'}), 500
    finally:
        conn.close()


@chat_bp.route('/sessions/<session_id>/pdf', methods=['GET'])
def download_session_pdf(session_id):
    from flask import send_file
    from utils.pdf_generator import generate_session_pdf
    
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    language = request.args.get('lang', 'da')
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database connection failed'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT role, company_id, first_name, last_name, email FROM users WHERE id = %s", (user['user_id'],))
            user_data = cur.fetchone()
            user_role = user_data['role'] if user_data else 'user'
            user_company_id = user_data['company_id'] if user_data else None
            user_name = f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}".strip() or user_data.get('email', 'User')
            
            cur.execute("""
                SELECT cs.id, cs.user_id, cs.company_id, cs.title, cs.created_at,
                       (SELECT original_filename FROM chat_session_files WHERE session_id = cs.id AND file_type = 'old_schedule' LIMIT 1) as old_file_name,
                       (SELECT original_filename FROM chat_session_files WHERE session_id = cs.id AND file_type = 'new_schedule' LIMIT 1) as new_file_name
                FROM chat_sessions cs
                WHERE cs.session_id = %s
            """, (session_id,))
            
            session = cur.fetchone()
            if not session:
                return jsonify({'success': False, 'error': 'Session not found'}), 404
            
            is_owner = session['user_id'] == user['user_id']
            is_company_admin = user_role in ['company_owner', 'admin'] and session['company_id'] == user_company_id
            is_super_admin = user_role == 'super_admin'
            
            if not (is_owner or is_company_admin or is_super_admin):
                return jsonify({'success': False, 'error': 'Access denied'}), 403
            
            cur.execute("""
                SELECT id, sender_type, content, content_type, is_html, metadata, created_at
                FROM chat_messages
                WHERE session_id = %s
                ORDER BY created_at ASC
            """, (session['id'],))
            
            messages = cur.fetchall()
            
            messages_list = []
            for msg in messages:
                messages_list.append({
                    'id': msg['id'],
                    'sender_type': msg['sender_type'],
                    'content': msg['content'],
                    'content_type': msg['content_type'],
                    'is_html': msg['is_html'],
                    'metadata': msg['metadata'],
                    'created_at': msg['created_at'].isoformat() if msg['created_at'] else None
                })
            
            cur.execute("""
                SELECT ta.id, ta.task_key, ta.task_name, ta.annotation_text, ta.tags, ta.is_private, ta.created_at,
                       COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.email) as author_name
                FROM task_annotations ta
                LEFT JOIN users u ON ta.user_id = u.id
                WHERE ta.session_id = %s
                ORDER BY ta.task_key, ta.created_at
            """, (session['id'],))
            
            annotations_raw = cur.fetchall()
            annotations = {}
            for ann in annotations_raw:
                key = ann['task_key']
                if key not in annotations:
                    annotations[key] = []
                annotations[key].append({
                    'id': ann['id'],
                    'task_key': ann['task_key'],
                    'task_name': ann['task_name'],
                    'annotation_text': ann['annotation_text'],
                    'tags': ann['tags'],
                    'is_private': ann['is_private'],
                    'created_at': ann['created_at'].isoformat() if ann['created_at'] else None,
                    'author_name': ann['author_name']
                })
            
            session_info = {
                'title': session['title'],
                'old_file_name': session['old_file_name'],
                'new_file_name': session['new_file_name'],
                'created_at': session['created_at'].isoformat() if session['created_at'] else None
            }
            
            user_info = {
                'name': user_name,
                'company': None
            }
            
            if user_company_id:
                cur.execute("SELECT name FROM companies WHERE id = %s", (user_company_id,))
                company = cur.fetchone()
                if company:
                    user_info['company'] = company['name']
            
            pdf_buffer = generate_session_pdf(messages_list, session_info, user_info, annotations, language)
            
            from utils.pdf_generator import sanitize_filename
            date_str = datetime.now().strftime('%Y-%m-%d')
            safe_title = sanitize_filename(session['title'] or 'chat', 40)
            filename = f"{safe_title}_{date_str}.pdf"
            
            log_audit_event(
                event_type='pdf_session_downloaded',
                actor_user_id=user['user_id'],
                company_id=user_company_id,
                event_description=f"Full session PDF downloaded: {session['title'] or session_id}",
                context={'session_id': session_id, 'filename': filename, 'message_count': len(messages_list)}
            )
            
            return send_file(
                pdf_buffer,
                mimetype='application/pdf',
                as_attachment=True,
                download_name=filename
            )
    except Exception as e:
        print(f"Error generating session PDF: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': 'Failed to generate PDF'}), 500
    finally:
        conn.close()


AGENT_BASE_URL = "https://nova-azure-ai-rag-agent-fork.replit.app"

@chat_bp.route('/proxy/query', methods=['POST'])
def proxy_query():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    try:
        query = request.form.get('query', '')
        vs_table = request.form.get('vs_table', '')
        language = request.form.get('language', 'da')
        old_session_id = request.form.get('old_session_id', 'none')
        new_session_id = request.form.get('new_session_id', 'none')
        
        print(f"🔄 Proxying query to Azure agent: {query[:80]}...")
        print(f"🔑 vs_table: {vs_table}, old: {old_session_id}, new: {new_session_id}")
        
        form_data = {
            'query': query,
            'vs_table': vs_table,
            'language': language,
            'old_session_id': old_session_id,
            'new_session_id': new_session_id,
        }
        
        resp = http_requests.post(
            f"{AGENT_BASE_URL}/query",
            data=form_data,
            timeout=300,
            verify=False,
        )
        
        print(f"✅ Azure agent responded: {resp.status_code}")
        
        if resp.status_code != 200:
            return jsonify({'success': False, 'error': f'Agent returned {resp.status_code}'}), resp.status_code
        
        return jsonify(resp.json())
    except http_requests.exceptions.Timeout:
        print("⏰ Azure agent query timed out after 5 minutes")
        return jsonify({'success': False, 'error': 'Query timed out after 5 minutes. The server may be processing a large document.'}), 504
    except http_requests.exceptions.ConnectionError as e:
        print(f"🔌 Azure agent connection error: {e}")
        return jsonify({'success': False, 'error': 'Could not connect to the AI agent. Please try again.'}), 502
    except Exception as e:
        print(f"❌ Proxy query error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@chat_bp.route('/proxy/upload', methods=['POST'])
def proxy_upload():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    try:
        files = {}
        for key in request.files:
            f = request.files[key]
            files[key] = (f.filename, f.stream, f.content_type)
        
        form_data = {}
        for key in request.form:
            form_data[key] = request.form[key]
        
        print(f"🔄 Proxying upload to Azure agent with {len(files)} file(s)")
        print(f"📎 File keys: {list(files.keys())}")
        print(f"📝 Form keys: {list(form_data.keys())}")
        
        resp = http_requests.post(
            f"{AGENT_BASE_URL}/upload",
            files=files,
            data=form_data,
            timeout=300,
            verify=False,
        )
        
        print(f"✅ Azure agent upload responded: {resp.status_code}")
        resp_data = resp.json()
        print(f"📥 Azure response: {resp_data}")
        
        if resp.status_code != 200:
            return jsonify({'success': False, 'error': f'Agent returned {resp.status_code}'}), resp.status_code
        
        return jsonify(resp_data)
    except http_requests.exceptions.Timeout:
        return jsonify({'success': False, 'error': 'Upload timed out after 5 minutes'}), 504
    except Exception as e:
        print(f"❌ Proxy upload error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@chat_bp.route('/proxy/upload/progress/<upload_id>', methods=['GET'])
def proxy_upload_progress(upload_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    try:
        resp = http_requests.get(
            f"{AGENT_BASE_URL}/upload/progress/{upload_id}",
            timeout=30,
            verify=False,
        )
        
        if resp.status_code != 200:
            return jsonify({'success': False, 'error': f'Agent returned {resp.status_code}'}), resp.status_code
        
        return jsonify(resp.json())
    except Exception as e:
        print(f"❌ Proxy progress error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
