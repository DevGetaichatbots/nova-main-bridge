"""
Audit Logger Utility
Centralized logging for user activity tracking
"""
from utils.database import get_db_connection
from flask import request
from datetime import datetime
import json

EVENT_TYPES = {
    'LOGIN': 'login',
    'LOGOUT': 'logout',
    'LOGIN_FAILED': 'login_failed',
    'CHAT_CREATED': 'chat_created',
    'CHAT_RENAMED': 'chat_renamed',
    'CHAT_UPDATED': 'chat_updated',
    'CHAT_DELETED': 'chat_deleted',
    'MESSAGE_SENT': 'message_sent',
    'FILE_UPLOADED': 'file_uploaded',
    'FILE_DOWNLOADED': 'file_downloaded',
    'PDF_DOWNLOADED': 'pdf_downloaded',
    'PDF_SESSION_DOWNLOADED': 'pdf_session_downloaded',
    'ANNOTATION_CREATED': 'annotation_created',
    'ANNOTATION_UPDATED': 'annotation_updated',
    'ANNOTATION_DELETED': 'annotation_deleted',
    'USER_CREATED': 'user_created',
    'USER_UPDATED': 'user_updated',
    'USER_DELETED': 'user_deleted',
    'COMPANY_UPDATED': 'company_updated',
    'PASSWORD_RESET': 'password_reset',
    'PROFILE_UPDATED': 'profile_updated'
}

def log_audit_event(
    event_type: str,
    actor_user_id: int = None,
    company_id: int = None,
    target_user_id: int = None,
    event_description: str = None,
    context: dict = None,
    req = None
):
    """
    Log an audit event to the database
    
    Args:
        event_type: Type of event (login, logout, chat_created, etc.)
        actor_user_id: ID of the user performing the action
        company_id: ID of the company (for tenant isolation)
        target_user_id: ID of the user being affected (for user CRUD operations)
        event_description: Human-readable description of the event
        context: Additional context data (stored as JSONB)
        req: Flask request object (for IP and user agent)
    """
    conn = get_db_connection()
    if not conn:
        print(f"[AUDIT] Failed to log event - no DB connection: {event_type}")
        return False
    
    try:
        ip_address = None
        user_agent = None
        
        if req is None:
            try:
                req = request
            except RuntimeError:
                pass
        
        if req:
            ip_address = req.headers.get('X-Forwarded-For', req.remote_addr)
            if ip_address and ',' in ip_address:
                ip_address = ip_address.split(',')[0].strip()
            user_agent = req.headers.get('User-Agent', '')[:500]
        
        context_json = json.dumps(context) if context else '{}'
        
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO audit_logs 
                (company_id, actor_user_id, target_user_id, event_type, event_description, event_context, ip_address, user_agent)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                company_id,
                actor_user_id,
                target_user_id,
                event_type,
                event_description,
                context_json,
                ip_address,
                user_agent
            ))
            
            conn.commit()
            return True
            
    except Exception as e:
        print(f"[AUDIT] Error logging event: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def get_user_company_id(user_id: int) -> int:
    """Get company_id for a user"""
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT company_id FROM users WHERE id = %s", (user_id,))
            result = cur.fetchone()
            return result[0] if result else None
    except Exception as e:
        print(f"[AUDIT] Error getting company_id: {e}")
        return None
    finally:
        conn.close()
