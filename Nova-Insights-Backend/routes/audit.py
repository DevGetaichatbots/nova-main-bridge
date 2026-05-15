"""
Audit Log Routes
API endpoints for viewing and exporting audit logs
"""
from flask import Blueprint, request, jsonify, Response
from utils.database import get_db_connection
from middleware.auth_middleware import require_auth
from utils.redis_client import cache_get, cache_set, cache_delete
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import json
import re

audit_bp = Blueprint('audit', __name__)

AUDIT_LOGS_CACHE_TTL = 60
CHAT_HISTORY_CACHE_TTL = 120
CHAT_MESSAGES_CACHE_TTL = 300


def sanitize_filename(title):
    """Remove non-ASCII characters (like emojis) and sanitize for HTTP headers"""
    if not title:
        return 'chat'
    ascii_only = title.encode('ascii', 'ignore').decode('ascii')
    sanitized = re.sub(r'[^\w\s\-\.]', '', ascii_only)
    sanitized = sanitized.replace(' ', '_').strip('_')
    return sanitized[:30] if sanitized else 'chat'


def get_current_user():
    """Get current user from auth header or cookies"""
    token = None
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
    
    if not token:
        token = request.cookies.get('accessToken')
    
    if not token:
        return None
    
    from utils.token_manager import verify_access_token
    payload, error = verify_access_token(token)
    
    if error:
        return None
    
    return payload


def company_owner_or_super_admin_required(f):
    """Decorator to require company_owner or super_admin role"""
    from functools import wraps
    
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'Unauthorized'}), 401
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'error': 'Database error'}), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, role, company_id FROM users WHERE id = %s AND is_active = TRUE",
                    (user['user_id'],)
                )
                user_data = cur.fetchone()
                
                if not user_data:
                    return jsonify({'success': False, 'error': 'User not found'}), 401
                
                if user_data['role'] not in ['company_owner', 'super_admin']:
                    return jsonify({'success': False, 'error': 'Access denied'}), 403
                
                request.current_user = user_data
                
        finally:
            conn.close()
        
        return f(*args, **kwargs)
    
    return decorated_function


def super_admin_required(f):
    """Decorator to require super_admin role"""
    from functools import wraps
    
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'Unauthorized'}), 401
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'error': 'Database error'}), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, role, company_id FROM users WHERE id = %s AND is_active = TRUE",
                    (user['user_id'],)
                )
                user_data = cur.fetchone()
                
                if not user_data:
                    return jsonify({'success': False, 'error': 'User not found'}), 401
                
                if user_data['role'] != 'super_admin':
                    return jsonify({'success': False, 'error': 'Super admin access required'}), 403
                
                request.current_user = user_data
                
        finally:
            conn.close()
        
        return f(*args, **kwargs)
    
    return decorated_function


@audit_bp.route('/company/audit-logs', methods=['GET'])
@company_owner_or_super_admin_required
def get_company_audit_logs():
    """Get audit logs for the current user's company"""
    user = request.current_user
    company_id = user['company_id']
    
    if not company_id:
        return jsonify({'success': False, 'error': 'No company associated'}), 400
    
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    limit = min(limit, 100)
    offset = (page - 1) * limit
    
    event_type = request.args.get('eventType', '')
    actor_email = request.args.get('actorEmail', '')
    start_date = request.args.get('startDate', '')
    end_date = request.args.get('endDate', '')
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            where_clauses = ["al.company_id = %s"]
            params = [company_id]
            
            if event_type:
                where_clauses.append("al.event_type = %s")
                params.append(event_type)
            
            if actor_email:
                where_clauses.append("u.email ILIKE %s")
                params.append(f"%{actor_email}%")
            
            if start_date:
                where_clauses.append("al.created_at >= %s")
                params.append(start_date)
            
            if end_date:
                where_clauses.append("al.created_at <= %s")
                params.append(end_date + ' 23:59:59')
            
            where_sql = " AND ".join(where_clauses)
            
            cur.execute(f"SELECT COUNT(*) FROM audit_logs al LEFT JOIN users u ON al.actor_user_id = u.id WHERE {where_sql}", params)
            total = cur.fetchone()['count']
            
            cur.execute(f"""
                SELECT 
                    al.id,
                    al.event_type,
                    al.event_description,
                    al.event_context,
                    al.ip_address,
                    al.created_at,
                    u.email as actor_email,
                    u.first_name as actor_first_name,
                    u.last_name as actor_last_name,
                    tu.email as target_email,
                    tu.first_name as target_first_name,
                    tu.last_name as target_last_name
                FROM audit_logs al
                LEFT JOIN users u ON al.actor_user_id = u.id
                LEFT JOIN users tu ON al.target_user_id = tu.id
                WHERE {where_sql}
                ORDER BY al.created_at DESC
                LIMIT %s OFFSET %s
            """, params + [limit, offset])
            
            logs = cur.fetchall()
            
            formatted_logs = []
            for log in logs:
                formatted_logs.append({
                    'id': log['id'],
                    'eventType': log['event_type'],
                    'description': log['event_description'],
                    'context': log['event_context'] or {},
                    'ipAddress': log['ip_address'],
                    'createdAt': log['created_at'].isoformat() if log['created_at'] else None,
                    'actor': {
                        'email': log['actor_email'],
                        'name': f"{log['actor_first_name'] or ''} {log['actor_last_name'] or ''}".strip() or log['actor_email']
                    } if log['actor_email'] else None,
                    'target': {
                        'email': log['target_email'],
                        'name': f"{log['target_first_name'] or ''} {log['target_last_name'] or ''}".strip() or log['target_email']
                    } if log['target_email'] else None
                })
            
            return jsonify({
                'success': True,
                'logs': formatted_logs,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'total': total,
                    'totalPages': (total + limit - 1) // limit
                }
            })
            
    except Exception as e:
        print(f"Error fetching audit logs: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch logs'}), 500
    finally:
        conn.close()


@audit_bp.route('/company/audit-logs/export', methods=['GET'])
@company_owner_or_super_admin_required
def export_company_audit_logs():
    """Export audit logs for the current user's company as JSON"""
    user = request.current_user
    company_id = user['company_id']
    
    if not company_id:
        return jsonify({'success': False, 'error': 'No company associated'}), 400
    
    event_type = request.args.get('eventType', '')
    start_date = request.args.get('startDate', '')
    end_date = request.args.get('endDate', '')
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            where_clauses = ["al.company_id = %s"]
            params = [company_id]
            
            if event_type:
                where_clauses.append("al.event_type = %s")
                params.append(event_type)
            
            if start_date:
                where_clauses.append("al.created_at >= %s")
                params.append(start_date)
            
            if end_date:
                where_clauses.append("al.created_at <= %s")
                params.append(end_date + ' 23:59:59')
            
            where_sql = " AND ".join(where_clauses)
            
            cur.execute("SELECT name FROM companies WHERE id = %s", (company_id,))
            company = cur.fetchone()
            company_name = company['name'] if company else 'Unknown'
            
            cur.execute(f"""
                SELECT 
                    al.id,
                    al.event_type,
                    al.event_description,
                    al.event_context,
                    al.ip_address,
                    al.created_at,
                    u.email as actor_email,
                    u.first_name as actor_first_name,
                    u.last_name as actor_last_name,
                    tu.email as target_email
                FROM audit_logs al
                LEFT JOIN users u ON al.actor_user_id = u.id
                LEFT JOIN users tu ON al.target_user_id = tu.id
                WHERE {where_sql}
                ORDER BY al.created_at DESC
                LIMIT 10000
            """, params)
            
            logs = cur.fetchall()
            
            export_data = {
                'exportedAt': datetime.utcnow().isoformat(),
                'company': company_name,
                'totalLogs': len(logs),
                'filters': {
                    'eventType': event_type or 'all',
                    'startDate': start_date or 'none',
                    'endDate': end_date or 'none'
                },
                'logs': []
            }
            
            for log in logs:
                export_data['logs'].append({
                    'id': log['id'],
                    'eventType': log['event_type'],
                    'description': log['event_description'],
                    'context': log['event_context'] or {},
                    'ipAddress': log['ip_address'],
                    'timestamp': log['created_at'].isoformat() if log['created_at'] else None,
                    'actorEmail': log['actor_email'],
                    'actorName': f"{log['actor_first_name'] or ''} {log['actor_last_name'] or ''}".strip(),
                    'targetEmail': log['target_email']
                })
            
            response = Response(
                json.dumps(export_data, indent=2, ensure_ascii=False),
                mimetype='application/json',
                headers={
                    'Content-Disposition': f'attachment; filename=audit-logs-{company_name.replace(" ", "-")}-{datetime.now().strftime("%Y-%m-%d")}.json'
                }
            )
            return response
            
    except Exception as e:
        print(f"Error exporting audit logs: {e}")
        return jsonify({'success': False, 'error': 'Failed to export logs'}), 500
    finally:
        conn.close()


@audit_bp.route('/super-admin/audit-logs', methods=['GET'])
@super_admin_required
def get_all_audit_logs():
    """Get audit logs for all companies (super admin only)"""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    limit = min(limit, 100)
    offset = (page - 1) * limit
    
    company_id = request.args.get('companyId', '', type=int) if request.args.get('companyId') else None
    event_type = request.args.get('eventType', '')
    actor_email = request.args.get('actorEmail', '')
    start_date = request.args.get('startDate', '')
    end_date = request.args.get('endDate', '')
    user_id = request.args.get('userId', '', type=int) if request.args.get('userId') else None
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            where_clauses = ["1=1"]
            params = []
            
            if company_id:
                where_clauses.append("al.company_id = %s")
                params.append(company_id)
            
            if user_id:
                where_clauses.append("al.actor_user_id = %s")
                params.append(user_id)
            
            if event_type:
                where_clauses.append("al.event_type = %s")
                params.append(event_type)
            
            if actor_email:
                where_clauses.append("u.email ILIKE %s")
                params.append(f"%{actor_email}%")
            
            if start_date:
                where_clauses.append("al.created_at >= %s")
                params.append(start_date)
            
            if end_date:
                where_clauses.append("al.created_at <= %s")
                params.append(end_date + ' 23:59:59')
            
            where_sql = " AND ".join(where_clauses)
            
            cur.execute(f"SELECT COUNT(*) FROM audit_logs al LEFT JOIN users u ON al.actor_user_id = u.id WHERE {where_sql}", params)
            total = cur.fetchone()['count']
            
            cur.execute(f"""
                SELECT 
                    al.id,
                    al.event_type,
                    al.event_description,
                    al.event_context,
                    al.ip_address,
                    al.created_at,
                    c.name as company_name,
                    c.id as company_id,
                    u.email as actor_email,
                    u.first_name as actor_first_name,
                    u.last_name as actor_last_name,
                    tu.email as target_email,
                    tu.first_name as target_first_name,
                    tu.last_name as target_last_name
                FROM audit_logs al
                LEFT JOIN companies c ON al.company_id = c.id
                LEFT JOIN users u ON al.actor_user_id = u.id
                LEFT JOIN users tu ON al.target_user_id = tu.id
                WHERE {where_sql}
                ORDER BY al.created_at DESC
                LIMIT %s OFFSET %s
            """, params + [limit, offset])
            
            logs = cur.fetchall()
            
            cur.execute("SELECT id, name FROM companies ORDER BY name")
            companies = [{'id': c['id'], 'name': c['name']} for c in cur.fetchall()]
            
            formatted_logs = []
            for log in logs:
                formatted_logs.append({
                    'id': log['id'],
                    'eventType': log['event_type'],
                    'description': log['event_description'],
                    'context': log['event_context'] or {},
                    'ipAddress': log['ip_address'],
                    'createdAt': log['created_at'].isoformat() if log['created_at'] else None,
                    'company': {
                        'id': log['company_id'],
                        'name': log['company_name']
                    } if log['company_name'] else None,
                    'actor': {
                        'email': log['actor_email'],
                        'name': f"{log['actor_first_name'] or ''} {log['actor_last_name'] or ''}".strip() or log['actor_email']
                    } if log['actor_email'] else None,
                    'target': {
                        'email': log['target_email'],
                        'name': f"{log['target_first_name'] or ''} {log['target_last_name'] or ''}".strip() or log['target_email']
                    } if log['target_email'] else None
                })
            
            return jsonify({
                'success': True,
                'logs': formatted_logs,
                'companies': companies,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'total': total,
                    'totalPages': (total + limit - 1) // limit
                }
            })
            
    except Exception as e:
        print(f"Error fetching audit logs: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch logs'}), 500
    finally:
        conn.close()


def invalidate_chat_history_cache(company_id):
    """Invalidate chat history cache for a company"""
    cache_delete(f"chat_histories:{company_id}")


@audit_bp.route('/company/chat-histories', methods=['GET'])
@company_owner_or_super_admin_required
def get_company_chat_histories():
    """Get chat histories for all users in the company with Redis caching"""
    user = request.current_user
    company_id = user['company_id']
    
    if not company_id:
        return jsonify({'success': False, 'error': 'No company associated'}), 400
    
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    limit = min(limit, 100)
    offset = (page - 1) * limit
    
    user_filter = request.args.get('userId', '', type=int) if request.args.get('userId') else None
    search = request.args.get('search', '')
    
    if page == 1 and not user_filter and not search:
        cache_key = f"chat_histories:{company_id}"
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
        return jsonify({'success': False, 'error': 'Database error'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            where_clauses = ["cs.company_id = %s"]
            params = [company_id]
            
            if user_filter:
                where_clauses.append("cs.user_id = %s")
                params.append(user_filter)
            
            if search:
                where_clauses.append("(cs.title ILIKE %s OR u.email ILIKE %s OR u.first_name ILIKE %s OR u.last_name ILIKE %s)")
                params.extend([f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"])
            
            where_sql = " AND ".join(where_clauses)
            
            cur.execute(f"SELECT COUNT(*) FROM chat_sessions cs LEFT JOIN users u ON cs.user_id = u.id WHERE {where_sql}", params)
            total = cur.fetchone()['count']
            
            cur.execute(f"""
                SELECT 
                    cs.id,
                    cs.session_id,
                    cs.title,
                    cs.status,
                    cs.created_at,
                    cs.last_activity_at,
                    u.id as user_id,
                    u.email as user_email,
                    u.first_name,
                    u.last_name,
                    (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id) as message_count,
                    (SELECT original_filename FROM chat_session_files WHERE session_id = cs.id AND file_type = 'old_schedule' LIMIT 1) as old_file_name,
                    (SELECT original_filename FROM chat_session_files WHERE session_id = cs.id AND file_type = 'new_schedule' LIMIT 1) as new_file_name
                FROM chat_sessions cs
                LEFT JOIN users u ON cs.user_id = u.id
                WHERE {where_sql}
                ORDER BY cs.last_activity_at DESC
                LIMIT %s OFFSET %s
            """, params + [limit, offset])
            
            sessions = cur.fetchall()
            
            cur.execute("SELECT id, email, first_name, last_name FROM users WHERE company_id = %s AND is_active = TRUE ORDER BY email", (company_id,))
            users = [{'id': u['id'], 'email': u['email'], 'name': f"{u['first_name'] or ''} {u['last_name'] or ''}".strip() or u['email']} for u in cur.fetchall()]
            
            formatted_sessions = []
            for session in sessions:
                formatted_sessions.append({
                    'id': session['id'],
                    'sessionId': session['session_id'],
                    'title': session['title'],
                    'status': session['status'],
                    'createdAt': session['created_at'].isoformat() if session['created_at'] else None,
                    'lastActivityAt': session['last_activity_at'].isoformat() if session['last_activity_at'] else None,
                    'messageCount': session['message_count'],
                    'oldFileName': session['old_file_name'],
                    'newFileName': session['new_file_name'],
                    'user': {
                        'id': session['user_id'],
                        'email': session['user_email'],
                        'name': f"{session['first_name'] or ''} {session['last_name'] or ''}".strip() or session['user_email']
                    }
                })
            
            response_data = {
                'success': True,
                'sessions': formatted_sessions,
                'users': users,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'total': total,
                    'totalPages': (total + limit - 1) // limit
                }
            }
            
            if page == 1 and not user_filter and not search:
                cache_set(f"chat_histories:{company_id}", json.dumps(response_data), ex=CHAT_HISTORY_CACHE_TTL)
            
            return jsonify(response_data)
            
    except Exception as e:
        print(f"Error fetching chat histories: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch chat histories'}), 500
    finally:
        conn.close()


@audit_bp.route('/company/chat-histories/<int:session_id>/messages', methods=['GET'])
@company_owner_or_super_admin_required
def get_company_chat_messages(session_id):
    """Get messages for a specific chat session with Redis caching"""
    user = request.current_user
    company_id = user['company_id']
    
    cache_key = f"company_messages:{company_id}:{session_id}"
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
        return jsonify({'success': False, 'error': 'Database error'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT cs.*, u.email as user_email, u.first_name, u.last_name
                FROM chat_sessions cs
                LEFT JOIN users u ON cs.user_id = u.id
                WHERE cs.id = %s AND cs.company_id = %s
            """, (session_id, company_id))
            session = cur.fetchone()
            
            if not session:
                return jsonify({'success': False, 'error': 'Session not found'}), 404
            
            cur.execute("""
                SELECT id, sender_type, content, content_type, is_html, metadata, created_at
                FROM chat_messages
                WHERE session_id = %s
                ORDER BY created_at ASC
            """, (session_id,))
            messages = cur.fetchall()
            
            cur.execute("""
                SELECT file_type, original_filename, uploaded_at
                FROM chat_session_files
                WHERE session_id = %s
            """, (session_id,))
            files = cur.fetchall()
            
            formatted_messages = []
            for msg in messages:
                formatted_messages.append({
                    'id': msg['id'],
                    'senderType': msg['sender_type'],
                    'content': msg['content'],
                    'contentType': msg['content_type'],
                    'isHtml': msg['is_html'],
                    'metadata': msg['metadata'],
                    'createdAt': msg['created_at'].isoformat() if msg['created_at'] else None
                })
            
            response_data = {
                'success': True,
                'session': {
                    'id': session['id'],
                    'sessionId': session['session_id'],
                    'title': session['title'],
                    'status': session['status'],
                    'createdAt': session['created_at'].isoformat() if session['created_at'] else None,
                    'user': {
                        'email': session['user_email'],
                        'name': f"{session['first_name'] or ''} {session['last_name'] or ''}".strip() or session['user_email']
                    }
                },
                'messages': formatted_messages,
                'files': [{'fileType': f['file_type'], 'fileName': f['original_filename'], 'uploadedAt': f['uploaded_at'].isoformat() if f['uploaded_at'] else None} for f in files]
            }
            
            cache_set(cache_key, json.dumps(response_data), ex=CHAT_MESSAGES_CACHE_TTL)
            
            return jsonify(response_data)
            
    except Exception as e:
        print(f"Error fetching chat messages: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch messages'}), 500
    finally:
        conn.close()


@audit_bp.route('/super-admin/audit-logs/export', methods=['GET'])
@super_admin_required
def export_all_audit_logs():
    """Export all audit logs as JSON (super admin only)"""
    company_id = request.args.get('companyId', '', type=int) if request.args.get('companyId') else None
    event_type = request.args.get('eventType', '')
    start_date = request.args.get('startDate', '')
    end_date = request.args.get('endDate', '')
    user_id = request.args.get('userId', '', type=int) if request.args.get('userId') else None
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            where_clauses = ["1=1"]
            params = []
            
            if company_id:
                where_clauses.append("al.company_id = %s")
                params.append(company_id)
            
            if user_id:
                where_clauses.append("al.actor_user_id = %s")
                params.append(user_id)
            
            if event_type:
                where_clauses.append("al.event_type = %s")
                params.append(event_type)
            
            if start_date:
                where_clauses.append("al.created_at >= %s")
                params.append(start_date)
            
            if end_date:
                where_clauses.append("al.created_at <= %s")
                params.append(end_date + ' 23:59:59')
            
            where_sql = " AND ".join(where_clauses)
            
            cur.execute(f"""
                SELECT 
                    al.id,
                    al.event_type,
                    al.event_description,
                    al.event_context,
                    al.ip_address,
                    al.created_at,
                    c.name as company_name,
                    u.email as actor_email,
                    u.first_name as actor_first_name,
                    u.last_name as actor_last_name,
                    tu.email as target_email
                FROM audit_logs al
                LEFT JOIN companies c ON al.company_id = c.id
                LEFT JOIN users u ON al.actor_user_id = u.id
                LEFT JOIN users tu ON al.target_user_id = tu.id
                WHERE {where_sql}
                ORDER BY al.created_at DESC
                LIMIT 10000
            """, params)
            
            logs = cur.fetchall()
            
            export_data = {
                'exportedAt': datetime.utcnow().isoformat(),
                'exportedBy': 'Super Admin',
                'totalLogs': len(logs),
                'filters': {
                    'companyId': company_id or 'all',
                    'eventType': event_type or 'all',
                    'startDate': start_date or 'none',
                    'endDate': end_date or 'none'
                },
                'logs': []
            }
            
            for log in logs:
                export_data['logs'].append({
                    'id': log['id'],
                    'eventType': log['event_type'],
                    'description': log['event_description'],
                    'context': log['event_context'] or {},
                    'ipAddress': log['ip_address'],
                    'timestamp': log['created_at'].isoformat() if log['created_at'] else None,
                    'company': log['company_name'],
                    'actorEmail': log['actor_email'],
                    'actorName': f"{log['actor_first_name'] or ''} {log['actor_last_name'] or ''}".strip(),
                    'targetEmail': log['target_email']
                })
            
            response = Response(
                json.dumps(export_data, indent=2, ensure_ascii=False),
                mimetype='application/json',
                headers={
                    'Content-Disposition': f'attachment; filename=audit-logs-all-{datetime.now().strftime("%Y-%m-%d")}.json'
                }
            )
            return response
            
    except Exception as e:
        print(f"Error exporting audit logs: {e}")
        return jsonify({'success': False, 'error': 'Failed to export logs'}), 500
    finally:
        conn.close()


@audit_bp.route('/super-admin/chat-histories', methods=['GET'])
@super_admin_required
def get_all_chat_histories():
    """Get chat histories for all companies (super admin only)"""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    limit = min(limit, 100)
    offset = (page - 1) * limit
    
    company_filter = request.args.get('companyId', '', type=int) if request.args.get('companyId') else None
    user_filter = request.args.get('userId', '', type=int) if request.args.get('userId') else None
    search = request.args.get('search', '')
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            where_clauses = ["1=1"]
            params = []
            
            if company_filter:
                where_clauses.append("cs.company_id = %s")
                params.append(company_filter)
            
            if user_filter:
                where_clauses.append("cs.user_id = %s")
                params.append(user_filter)
            
            if search:
                where_clauses.append("(cs.title ILIKE %s OR u.email ILIKE %s OR u.first_name ILIKE %s OR u.last_name ILIKE %s)")
                params.extend([f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"])
            
            where_sql = " AND ".join(where_clauses)
            
            cur.execute(f"SELECT COUNT(*) FROM chat_sessions cs LEFT JOIN users u ON cs.user_id = u.id WHERE {where_sql}", params)
            total = cur.fetchone()['count']
            
            cur.execute(f"""
                SELECT 
                    cs.id,
                    cs.session_id,
                    cs.title,
                    cs.status,
                    cs.created_at,
                    cs.last_activity_at,
                    u.id as user_id,
                    u.email as user_email,
                    u.first_name,
                    u.last_name,
                    c.id as company_id,
                    c.name as company_name,
                    (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id) as message_count,
                    (SELECT original_filename FROM chat_session_files WHERE session_id = cs.id AND file_type = 'old_schedule' LIMIT 1) as old_file_name,
                    (SELECT original_filename FROM chat_session_files WHERE session_id = cs.id AND file_type = 'new_schedule' LIMIT 1) as new_file_name
                FROM chat_sessions cs
                LEFT JOIN users u ON cs.user_id = u.id
                LEFT JOIN companies c ON cs.company_id = c.id
                WHERE {where_sql}
                ORDER BY cs.last_activity_at DESC
                LIMIT %s OFFSET %s
            """, params + [limit, offset])
            
            sessions = cur.fetchall()
            
            cur.execute("SELECT id, name FROM companies ORDER BY name")
            companies = [{'id': c['id'], 'name': c['name']} for c in cur.fetchall()]
            
            formatted_sessions = []
            for session in sessions:
                formatted_sessions.append({
                    'id': session['id'],
                    'sessionId': session['session_id'],
                    'title': session['title'],
                    'status': session['status'],
                    'createdAt': session['created_at'].isoformat() if session['created_at'] else None,
                    'lastActivityAt': session['last_activity_at'].isoformat() if session['last_activity_at'] else None,
                    'messageCount': session['message_count'],
                    'oldFileName': session['old_file_name'],
                    'newFileName': session['new_file_name'],
                    'user': {
                        'id': session['user_id'],
                        'email': session['user_email'],
                        'name': f"{session['first_name'] or ''} {session['last_name'] or ''}".strip() or session['user_email']
                    },
                    'company': {
                        'id': session['company_id'],
                        'name': session['company_name']
                    } if session['company_name'] else None
                })
            
            return jsonify({
                'success': True,
                'sessions': formatted_sessions,
                'companies': companies,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'total': total,
                    'totalPages': (total + limit - 1) // limit
                }
            })
            
    except Exception as e:
        print(f"Error fetching chat histories: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch chat histories'}), 500
    finally:
        conn.close()


@audit_bp.route('/super-admin/chat-histories/<int:session_id>/messages', methods=['GET'])
@super_admin_required
def get_super_admin_chat_messages(session_id):
    """Get messages for a specific chat session (super admin only)"""
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT cs.*, u.email as user_email, u.first_name, u.last_name, c.name as company_name
                FROM chat_sessions cs
                LEFT JOIN users u ON cs.user_id = u.id
                LEFT JOIN companies c ON cs.company_id = c.id
                WHERE cs.id = %s
            """, (session_id,))
            session = cur.fetchone()
            
            if not session:
                return jsonify({'success': False, 'error': 'Session not found'}), 404
            
            cur.execute("""
                SELECT id, sender_type, content, content_type, is_html, metadata, created_at
                FROM chat_messages
                WHERE session_id = %s
                ORDER BY created_at ASC
            """, (session_id,))
            messages = cur.fetchall()
            
            cur.execute("""
                SELECT file_type, original_filename, uploaded_at
                FROM chat_session_files
                WHERE session_id = %s
            """, (session_id,))
            files = cur.fetchall()
            
            formatted_messages = []
            for msg in messages:
                formatted_messages.append({
                    'id': msg['id'],
                    'senderType': msg['sender_type'],
                    'content': msg['content'],
                    'contentType': msg['content_type'],
                    'isHtml': msg['is_html'],
                    'metadata': msg['metadata'],
                    'createdAt': msg['created_at'].isoformat() if msg['created_at'] else None
                })
            
            return jsonify({
                'success': True,
                'session': {
                    'id': session['id'],
                    'sessionId': session['session_id'],
                    'title': session['title'],
                    'status': session['status'],
                    'createdAt': session['created_at'].isoformat() if session['created_at'] else None,
                    'user': {
                        'email': session['user_email'],
                        'name': f"{session['first_name'] or ''} {session['last_name'] or ''}".strip() or session['user_email']
                    },
                    'company': session['company_name']
                },
                'messages': formatted_messages,
                'files': [{'fileType': f['file_type'], 'fileName': f['original_filename'], 'uploadedAt': f['uploaded_at'].isoformat() if f['uploaded_at'] else None} for f in files]
            })
            
    except Exception as e:
        print(f"Error fetching chat messages: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch messages'}), 500
    finally:
        conn.close()


def get_role_display_name(role):
    """Convert role key to display name"""
    role_names = {
        'super_admin': 'Super Admin',
        'company_owner': 'Company Owner',
        'admin': 'Admin',
        'standard_user': 'Standard User',
        'read_only_user': 'Read Only User',
        'guest': 'Guest'
    }
    return role_names.get(role, role)


@audit_bp.route('/company/chat-histories/export', methods=['GET'])
@company_owner_or_super_admin_required
def export_company_chat_histories():
    """Export chat histories for company as JSON"""
    user = request.current_user
    company_id = user['company_id']
    
    if not company_id:
        return jsonify({'success': False, 'error': 'No company associated'}), 400
    
    user_filter = request.args.get('userId', '', type=int) if request.args.get('userId') else None
    search = request.args.get('search', '')
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            where_clauses = ["cs.company_id = %s"]
            params = [company_id]
            
            if user_filter:
                where_clauses.append("cs.user_id = %s")
                params.append(user_filter)
            
            if search:
                where_clauses.append("(cs.title ILIKE %s OR u.email ILIKE %s OR u.first_name ILIKE %s OR u.last_name ILIKE %s)")
                params.extend([f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"])
            
            where_sql = " AND ".join(where_clauses)
            
            cur.execute(f"""
                SELECT 
                    cs.id,
                    cs.session_id,
                    cs.title,
                    cs.status,
                    cs.created_at,
                    cs.last_activity_at,
                    u.id as user_id,
                    u.email as user_email,
                    u.first_name,
                    u.last_name,
                    u.role as user_role,
                    (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id) as message_count,
                    (SELECT original_filename FROM chat_session_files WHERE session_id = cs.id AND file_type = 'old_schedule' LIMIT 1) as old_file_name,
                    (SELECT original_filename FROM chat_session_files WHERE session_id = cs.id AND file_type = 'new_schedule' LIMIT 1) as new_file_name
                FROM chat_sessions cs
                LEFT JOIN users u ON cs.user_id = u.id
                WHERE {where_sql}
                ORDER BY cs.last_activity_at DESC
                LIMIT 10000
            """, params)
            
            sessions = cur.fetchall()
            
            cur.execute("SELECT name FROM companies WHERE id = %s", (company_id,))
            company = cur.fetchone()
            
            export_data = {
                'exportedAt': datetime.utcnow().isoformat(),
                'company': company['name'] if company else 'Unknown',
                'totalSessions': len(sessions),
                'filters': {
                    'userId': user_filter or 'all',
                    'search': search or 'none'
                },
                'sessions': []
            }
            
            for session in sessions:
                export_data['sessions'].append({
                    'id': session['id'],
                    'sessionId': session['session_id'],
                    'title': session['title'],
                    'status': session['status'],
                    'createdAt': session['created_at'].isoformat() if session['created_at'] else None,
                    'lastActivityAt': session['last_activity_at'].isoformat() if session['last_activity_at'] else None,
                    'messageCount': session['message_count'],
                    'oldFileName': session['old_file_name'],
                    'newFileName': session['new_file_name'],
                    'userName': f"{session['first_name'] or ''} {session['last_name'] or ''}".strip() or session['user_email'],
                    'userEmail': session['user_email'],
                    'userRole': get_role_display_name(session['user_role'])
                })
            
            response = Response(
                json.dumps(export_data, indent=2, ensure_ascii=False),
                mimetype='application/json',
                headers={
                    'Content-Disposition': f'attachment; filename=chat-histories-{datetime.now().strftime("%Y-%m-%d")}.json'
                }
            )
            return response
            
    except Exception as e:
        print(f"Error exporting chat histories: {e}")
        return jsonify({'success': False, 'error': 'Failed to export chat histories'}), 500
    finally:
        conn.close()


@audit_bp.route('/company/chat-histories/<int:session_id>/export', methods=['GET'])
@company_owner_or_super_admin_required
def export_company_chat_session(session_id):
    """Export a single chat session with messages"""
    user = request.current_user
    company_id = user['company_id']
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT cs.*, u.email as user_email, u.first_name, u.last_name, u.role as user_role
                FROM chat_sessions cs
                LEFT JOIN users u ON cs.user_id = u.id
                WHERE cs.id = %s AND cs.company_id = %s
            """, (session_id, company_id))
            session = cur.fetchone()
            
            if not session:
                return jsonify({'success': False, 'error': 'Session not found'}), 404
            
            cur.execute("""
                SELECT id, sender_type, content, content_type, is_html, metadata, created_at
                FROM chat_messages
                WHERE session_id = %s
                ORDER BY created_at ASC
            """, (session_id,))
            messages = cur.fetchall()
            
            cur.execute("""
                SELECT file_type, original_filename, uploaded_at
                FROM chat_session_files
                WHERE session_id = %s
            """, (session_id,))
            files = cur.fetchall()
            
            export_data = {
                'exportedAt': datetime.utcnow().isoformat(),
                'session': {
                    'id': session['id'],
                    'sessionId': session['session_id'],
                    'title': session['title'],
                    'status': session['status'],
                    'createdAt': session['created_at'].isoformat() if session['created_at'] else None,
                    'userName': f"{session['first_name'] or ''} {session['last_name'] or ''}".strip() or session['user_email'],
                    'userEmail': session['user_email'],
                    'userRole': get_role_display_name(session['user_role'])
                },
                'files': [{'fileType': f['file_type'], 'fileName': f['original_filename'], 'uploadedAt': f['uploaded_at'].isoformat() if f['uploaded_at'] else None} for f in files],
                'messages': [{
                    'id': msg['id'],
                    'senderType': msg['sender_type'],
                    'content': msg['content'],
                    'createdAt': msg['created_at'].isoformat() if msg['created_at'] else None
                } for msg in messages]
            }
            
            safe_title = sanitize_filename(session['title'])
            response = Response(
                json.dumps(export_data, indent=2, ensure_ascii=False),
                mimetype='application/json',
                headers={
                    'Content-Disposition': f'attachment; filename={safe_title}-{datetime.now().strftime("%Y-%m-%d")}.json'
                }
            )
            return response
            
    except Exception as e:
        print(f"Error exporting chat session: {e}")
        return jsonify({'success': False, 'error': 'Failed to export session'}), 500
    finally:
        conn.close()


@audit_bp.route('/super-admin/chat-histories/export', methods=['GET'])
@super_admin_required
def export_all_chat_histories():
    """Export chat histories for all companies (super admin only)"""
    company_filter = request.args.get('companyId', '', type=int) if request.args.get('companyId') else None
    user_filter = request.args.get('userId', '', type=int) if request.args.get('userId') else None
    search = request.args.get('search', '')
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            where_clauses = ["1=1"]
            params = []
            
            if company_filter:
                where_clauses.append("cs.company_id = %s")
                params.append(company_filter)
            
            if user_filter:
                where_clauses.append("cs.user_id = %s")
                params.append(user_filter)
            
            if search:
                where_clauses.append("(cs.title ILIKE %s OR u.email ILIKE %s OR u.first_name ILIKE %s OR u.last_name ILIKE %s)")
                params.extend([f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"])
            
            where_sql = " AND ".join(where_clauses)
            
            cur.execute(f"""
                SELECT 
                    cs.id,
                    cs.session_id,
                    cs.title,
                    cs.status,
                    cs.created_at,
                    cs.last_activity_at,
                    u.id as user_id,
                    u.email as user_email,
                    u.first_name,
                    u.last_name,
                    u.role as user_role,
                    c.id as company_id,
                    c.name as company_name,
                    (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id) as message_count,
                    (SELECT original_filename FROM chat_session_files WHERE session_id = cs.id AND file_type = 'old_schedule' LIMIT 1) as old_file_name,
                    (SELECT original_filename FROM chat_session_files WHERE session_id = cs.id AND file_type = 'new_schedule' LIMIT 1) as new_file_name
                FROM chat_sessions cs
                LEFT JOIN users u ON cs.user_id = u.id
                LEFT JOIN companies c ON cs.company_id = c.id
                WHERE {where_sql}
                ORDER BY cs.last_activity_at DESC
                LIMIT 10000
            """, params)
            
            sessions = cur.fetchall()
            
            export_data = {
                'exportedAt': datetime.utcnow().isoformat(),
                'exportedBy': 'Super Admin',
                'totalSessions': len(sessions),
                'filters': {
                    'companyId': company_filter or 'all',
                    'userId': user_filter or 'all',
                    'search': search or 'none'
                },
                'sessions': []
            }
            
            for session in sessions:
                export_data['sessions'].append({
                    'id': session['id'],
                    'sessionId': session['session_id'],
                    'title': session['title'],
                    'status': session['status'],
                    'createdAt': session['created_at'].isoformat() if session['created_at'] else None,
                    'lastActivityAt': session['last_activity_at'].isoformat() if session['last_activity_at'] else None,
                    'messageCount': session['message_count'],
                    'oldFileName': session['old_file_name'],
                    'newFileName': session['new_file_name'],
                    'userName': f"{session['first_name'] or ''} {session['last_name'] or ''}".strip() or session['user_email'],
                    'userEmail': session['user_email'],
                    'userRole': get_role_display_name(session['user_role']),
                    'companyName': session['company_name']
                })
            
            response = Response(
                json.dumps(export_data, indent=2, ensure_ascii=False),
                mimetype='application/json',
                headers={
                    'Content-Disposition': f'attachment; filename=all-chat-histories-{datetime.now().strftime("%Y-%m-%d")}.json'
                }
            )
            return response
            
    except Exception as e:
        print(f"Error exporting chat histories: {e}")
        return jsonify({'success': False, 'error': 'Failed to export chat histories'}), 500
    finally:
        conn.close()


@audit_bp.route('/super-admin/chat-histories/<int:session_id>/export', methods=['GET'])
@super_admin_required
def export_super_admin_chat_session(session_id):
    """Export a single chat session with messages (super admin only)"""
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database error'}), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT cs.*, u.email as user_email, u.first_name, u.last_name, u.role as user_role, c.name as company_name
                FROM chat_sessions cs
                LEFT JOIN users u ON cs.user_id = u.id
                LEFT JOIN companies c ON cs.company_id = c.id
                WHERE cs.id = %s
            """, (session_id,))
            session = cur.fetchone()
            
            if not session:
                return jsonify({'success': False, 'error': 'Session not found'}), 404
            
            cur.execute("""
                SELECT id, sender_type, content, content_type, is_html, metadata, created_at
                FROM chat_messages
                WHERE session_id = %s
                ORDER BY created_at ASC
            """, (session_id,))
            messages = cur.fetchall()
            
            cur.execute("""
                SELECT file_type, original_filename, uploaded_at
                FROM chat_session_files
                WHERE session_id = %s
            """, (session_id,))
            files = cur.fetchall()
            
            export_data = {
                'exportedAt': datetime.utcnow().isoformat(),
                'session': {
                    'id': session['id'],
                    'sessionId': session['session_id'],
                    'title': session['title'],
                    'status': session['status'],
                    'createdAt': session['created_at'].isoformat() if session['created_at'] else None,
                    'userName': f"{session['first_name'] or ''} {session['last_name'] or ''}".strip() or session['user_email'],
                    'userEmail': session['user_email'],
                    'userRole': get_role_display_name(session['user_role']),
                    'companyName': session['company_name']
                },
                'files': [{'fileType': f['file_type'], 'fileName': f['original_filename'], 'uploadedAt': f['uploaded_at'].isoformat() if f['uploaded_at'] else None} for f in files],
                'messages': [{
                    'id': msg['id'],
                    'senderType': msg['sender_type'],
                    'content': msg['content'],
                    'createdAt': msg['created_at'].isoformat() if msg['created_at'] else None
                } for msg in messages]
            }
            
            safe_title = sanitize_filename(session['title'])
            response = Response(
                json.dumps(export_data, indent=2, ensure_ascii=False),
                mimetype='application/json',
                headers={
                    'Content-Disposition': f'attachment; filename={safe_title}-{datetime.now().strftime("%Y-%m-%d")}.json'
                }
            )
            return response
            
    except Exception as e:
        print(f"Error exporting chat session: {e}")
        return jsonify({'success': False, 'error': 'Failed to export session'}), 500
    finally:
        conn.close()
