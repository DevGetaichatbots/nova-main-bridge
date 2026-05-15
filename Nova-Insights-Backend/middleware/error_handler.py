from flask import jsonify
import traceback


class APIError(Exception):
    """Custom API Error class"""
    def __init__(self, message, code='ERROR', status_code=400, data=None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.data = data


def register_error_handlers(app):
    """Register global error handlers"""
    
    @app.errorhandler(APIError)
    def handle_api_error(error):
        """Handle custom API errors"""
        response = {
            'success': False,
            'error': error.message,
            'code': error.code
        }
        if error.data:
            response['data'] = error.data
        return jsonify(response), error.status_code
    
    @app.errorhandler(400)
    def bad_request(error):
        """Handle 400 errors"""
        return jsonify({
            'success': False,
            'error': 'Ugyldig anmodning',
            'code': 'BAD_REQUEST'
        }), 400
    
    @app.errorhandler(401)
    def unauthorized(error):
        """Handle 401 errors"""
        return jsonify({
            'success': False,
            'error': 'Ikke autoriseret',
            'code': 'UNAUTHORIZED'
        }), 401
    
    @app.errorhandler(403)
    def forbidden(error):
        """Handle 403 errors"""
        return jsonify({
            'success': False,
            'error': 'Forbudt',
            'code': 'FORBIDDEN'
        }), 403
    
    @app.errorhandler(404)
    def not_found(error):
        """Handle 404 errors for API routes"""
        return jsonify({
            'success': False,
            'error': 'Ikke fundet',
            'code': 'NOT_FOUND'
        }), 404
    
    @app.errorhandler(429)
    def rate_limit_exceeded(error):
        """Handle 429 errors"""
        return jsonify({
            'success': False,
            'error': 'For mange forsøg. Prøv igen senere',
            'code': 'RATE_LIMIT_EXCEEDED'
        }), 429
    
    @app.errorhandler(500)
    def internal_error(error):
        """Handle 500 errors"""
        print(f"Internal error: {error}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': 'Intern serverfejl',
            'code': 'INTERNAL_ERROR'
        }), 500
    
    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        """Handle unexpected errors"""
        print(f"Unexpected error: {error}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': 'Der opstod en uventet fejl',
            'code': 'UNEXPECTED_ERROR'
        }), 500
