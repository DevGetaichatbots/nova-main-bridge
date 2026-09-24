import psycopg2
import psycopg2.extensions
from psycopg2 import pool as pg_pool
from psycopg2.extras import RealDictCursor
import os
import threading

_pool = None
_pool_lock = threading.Lock()


class _PooledConnection(psycopg2.extensions.connection):
    """close() hands the connection back to the pool, so existing
    `conn = get_db_connection() ... conn.close()` call sites reuse connections."""
    _checked_out = False

    def close(self):
        if self._checked_out:
            self._checked_out = False
            _pool.putconn(self)  # pool rolls back any open transaction
        else:
            super().close()  # pool discarding it, or never pooled


def _get_pool():
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                size = int(os.getenv('DB_POOL_SIZE', 10))
                kwargs = {
                    'connection_factory': _PooledConnection,
                    # detect connections silently dropped by Azure/NAT idle timeouts
                    'keepalives': 1, 'keepalives_idle': 60,
                    'keepalives_interval': 10, 'keepalives_count': 5,
                }
                database_url = os.getenv('DATABASE_URL')
                if database_url:
                    kwargs['dsn'] = database_url
                else:
                    kwargs.update(
                        host=os.getenv('DB_HOST', 'localhost'),
                        database=os.getenv('DB_NAME', 'postgres'),
                        user=os.getenv('DB_USER', 'postgres'),
                        password=os.getenv('DB_PASSWORD', ''),
                        port=os.getenv('DB_PORT', 5432),
                        sslmode=os.getenv('DB_SSLMODE', 'require'),
                    )
                # minconn == maxconn: psycopg2 closes returned conns beyond minconn
                _pool = pg_pool.ThreadedConnectionPool(size, size, **kwargs)
    return _pool


def get_db_connection():
    """Borrow a pooled connection. Call conn.close() to return it."""
    try:
        pool = _get_pool()
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute('SELECT 1')
            conn.rollback()
        except psycopg2.Error:
            pool.putconn(conn, close=True)  # stale, replace it
            conn = pool.getconn()
        conn._checked_out = True
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        return None


def init_database():
    """Initialize database tables for authentication system"""
    conn = get_db_connection()
    if not conn:
        return False

    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS companies (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    cvr_number VARCHAR(20) UNIQUE,
                    address TEXT,
                    website VARCHAR(255),
                    industry VARCHAR(100),
                    size VARCHAR(50),
                    phone_number VARCHAR(20),
                    email VARCHAR(255),
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
                CREATE INDEX IF NOT EXISTS idx_companies_cvr ON companies(cvr_number);
            """)
            
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    first_name VARCHAR(100) NOT NULL,
                    last_name VARCHAR(100) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(20) DEFAULT 'user',
                    phone_number VARCHAR(20),
                    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
                    company_name VARCHAR(255),
                    company_address TEXT,
                    company_website VARCHAR(255),
                    company_industry VARCHAR(100),
                    company_size VARCHAR(50),
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            cur.execute("""
                DO $$ 
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone_number') THEN
                        ALTER TABLE users ADD COLUMN phone_number VARCHAR(20);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='company_name') THEN
                        ALTER TABLE users ADD COLUMN company_name VARCHAR(255);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='company_address') THEN
                        ALTER TABLE users ADD COLUMN company_address TEXT;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='company_website') THEN
                        ALTER TABLE users ADD COLUMN company_website VARCHAR(255);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='company_industry') THEN
                        ALTER TABLE users ADD COLUMN company_industry VARCHAR(100);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='company_size') THEN
                        ALTER TABLE users ADD COLUMN company_size VARCHAR(50);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='company_id') THEN
                        ALTER TABLE users ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_active') THEN
                        ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
                    END IF;
                END $$;
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
                CREATE INDEX IF NOT EXISTS idx_users_company_name ON users(company_name);
                CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
                CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
            """)
            
            cur.execute("""
                CREATE TABLE IF NOT EXISTS password_reset_otps (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    otp_code VARCHAR(6) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL,
                    is_used BOOLEAN DEFAULT FALSE,
                    used_at TIMESTAMP
                );

                CREATE INDEX IF NOT EXISTS idx_otp_user_id ON password_reset_otps(user_id);
                CREATE INDEX IF NOT EXISTS idx_otp_code ON password_reset_otps(otp_code);

                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    token_hash VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL,
                    is_revoked BOOLEAN DEFAULT FALSE
                );

                CREATE INDEX IF NOT EXISTS idx_refresh_token_user_id ON refresh_tokens(user_id);
                CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_tokens(token_hash);
            """)
            conn.commit()
            return True
    except Exception as e:
        print(f"Error initializing database: {e}")
        return False
    finally:
        conn.close()


def migrate_company_subdomains():
    """Add slug/subdomain/status to companies, backfill missing subdomains, add unique indexes."""
    from utils.validators import slugify, unique_subdomain
    conn = get_db_connection()
    if not conn:
        return False
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                ALTER TABLE companies ADD COLUMN IF NOT EXISTS slug VARCHAR(63);
                ALTER TABLE companies ADD COLUMN IF NOT EXISTS subdomain VARCHAR(63);
                ALTER TABLE companies ADD COLUMN IF NOT EXISTS status VARCHAR(20)
                    GENERATED ALWAYS AS (CASE WHEN is_active THEN 'active' ELSE 'inactive' END) STORED;
            """)
        # Commit the columns on their own: login selects c.subdomain, so a later
        # backfill/index failure must not roll them back.
        conn.commit()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, name FROM companies WHERE subdomain IS NULL ORDER BY id")
            for row in cur.fetchall():
                sub = unique_subdomain(cur, slugify(row['name']))
                cur.execute("UPDATE companies SET slug = %s, subdomain = %s WHERE id = %s",
                            (sub, sub, row['id']))
            cur.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
                CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_subdomain ON companies(subdomain);
            """)
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Company subdomain migration error: {e}")
        return False
    finally:
        conn.close()
