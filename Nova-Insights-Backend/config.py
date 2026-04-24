
import os
from datetime import timedelta

class Config:
    SECRET_KEY = os.getenv('JWT_SECRET', 'your-secret-key-change-in-production')
    
    # Database configuration
    DATABASE = {
        'host': os.getenv('DB_HOST', 'localhost'),
        'database': os.getenv('DB_NAME', 'fileai'),
        'user': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASSWORD', ''),
        'port': int(os.getenv('DB_PORT', 5432))
    }
    
    # JWT configuration
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)
    JWT_ALGORITHM = 'HS256'
    
    # CORS configuration
    CORS_ORIGINS = ['http://localhost:5173', 'http://localhost:3000']
    
class DevelopmentConfig(Config):
    DEBUG = True
    
class ProductionConfig(Config):
    DEBUG = False

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
