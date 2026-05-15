"""
This file contains the new authentication routes registration.
Import and use this in app.py to keep code clean and separated.
"""

def register_auth_routes(app):
    """Register all new authentication routes"""
    from routes.auth import auth_bp
    from routes.forgot_password import forgot_password_bp
    from routes.verify_otp import verify_otp_bp
    from routes.reset_password import reset_password_bp
    from routes.update_profile import update_profile_bp
    from routes.admin import admin_bp
    from routes.company import company_bp
    from routes.super_admin import super_admin_bp
    from routes.chat import chat_bp, init_chat_tables
    from routes.schedule import schedule_bp, init_schedule_tables
    from routes.audit import audit_bp
    from middleware.error_handler import register_error_handlers
    
    if init_chat_tables():
        print("✅ Chat tables initialized successfully")
    else:
        print("⚠️ Could not initialize chat tables")
    
    if init_schedule_tables():
        print("✅ Schedule analysis tables initialized successfully")
    else:
        print("⚠️ Could not initialize schedule analysis tables")
    
    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(forgot_password_bp, url_prefix='/api')
    app.register_blueprint(verify_otp_bp, url_prefix='/api')
    app.register_blueprint(reset_password_bp, url_prefix='/api')
    app.register_blueprint(update_profile_bp, url_prefix='/api')
    app.register_blueprint(admin_bp, url_prefix='/api')
    app.register_blueprint(company_bp, url_prefix='/api')
    app.register_blueprint(super_admin_bp, url_prefix='/api')
    app.register_blueprint(chat_bp, url_prefix='/api/chat')
    app.register_blueprint(schedule_bp, url_prefix='/api/schedule')
    app.register_blueprint(audit_bp, url_prefix='/api')
    
    register_error_handlers(app)
    
    print("✅ Authentication routes registered successfully")
    print("✅ Admin routes registered successfully")
    print("✅ Company routes registered successfully")
    print("✅ Super Admin routes registered successfully")
    print("✅ Chat routes registered successfully")
    print("✅ Schedule analysis routes registered successfully")
    print("✅ Audit routes registered successfully")
