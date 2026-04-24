import os
from upstash_redis import Redis

_redis_client = None

def get_redis_client():
    """
    Get a singleton Redis client instance.
    Uses Upstash Redis REST API for serverless compatibility.
    """
    global _redis_client
    
    if _redis_client is None:
        url = os.environ.get('UPSTASH_REDIS_REST_URL')
        token = os.environ.get('UPSTASH_REDIS_REST_TOKEN')
        
        if not url or not token:
            print("⚠️  Upstash Redis credentials not found. Redis features disabled.")
            return None
        
        url = url.strip()
        if not url.startswith('http://') and not url.startswith('https://'):
            url = f"https://{url}"
        
        try:
            _redis_client = Redis(url=url, token=token)
            print("✅ Upstash Redis client initialized successfully")
        except Exception as e:
            print(f"❌ Failed to initialize Redis client: {e}")
            return None
    
    return _redis_client


def cache_set(key, value, ex=None):
    """
    Set a value in Redis cache.
    
    Args:
        key: The cache key
        value: The value to cache (will be JSON serialized)
        ex: Expiration time in seconds (optional)
    
    Returns:
        True if successful, False otherwise
    """
    client = get_redis_client()
    if not client:
        return False
    
    try:
        if ex:
            client.set(key, value, ex=ex)
        else:
            client.set(key, value)
        return True
    except Exception as e:
        print(f"Redis SET error: {e}")
        return False


def cache_get(key):
    """
    Get a value from Redis cache.
    
    Args:
        key: The cache key
    
    Returns:
        The cached value or None if not found
    """
    client = get_redis_client()
    if not client:
        return None
    
    try:
        return client.get(key)
    except Exception as e:
        print(f"Redis GET error: {e}")
        return None


def cache_delete(key):
    """
    Delete a key from Redis cache.
    
    Args:
        key: The cache key to delete
    
    Returns:
        True if successful, False otherwise
    """
    client = get_redis_client()
    if not client:
        return False
    
    try:
        client.delete(key)
        return True
    except Exception as e:
        print(f"Redis DELETE error: {e}")
        return False


def cache_exists(key):
    """
    Check if a key exists in Redis cache.
    
    Args:
        key: The cache key to check
    
    Returns:
        True if exists, False otherwise
    """
    client = get_redis_client()
    if not client:
        return False
    
    try:
        return client.exists(key) > 0
    except Exception as e:
        print(f"Redis EXISTS error: {e}")
        return False


def rate_limit_check(key, limit, window_seconds):
    """
    Check and update rate limit for a given key.
    Uses sliding window rate limiting.
    
    Args:
        key: The rate limit key (e.g., "rate_limit:user:123")
        limit: Maximum number of requests allowed
        window_seconds: Time window in seconds
    
    Returns:
        Tuple of (allowed: bool, remaining: int, reset_time: int)
    """
    client = get_redis_client()
    if not client:
        return (True, limit, 0)
    
    try:
        current = client.get(key)
        
        if current is None:
            client.set(key, 1, ex=window_seconds)
            return (True, limit - 1, window_seconds)
        
        count = int(current)
        
        if count >= limit:
            ttl = client.ttl(key)
            return (False, 0, ttl if ttl > 0 else window_seconds)
        
        client.incr(key)
        remaining = limit - count - 1
        ttl = client.ttl(key)
        
        return (True, remaining, ttl if ttl > 0 else window_seconds)
    except Exception as e:
        print(f"Rate limit check error: {e}")
        return (True, limit, 0)


def session_store(session_id, user_data, ttl_seconds=86400):
    """
    Store session data in Redis.
    
    Args:
        session_id: Unique session identifier
        user_data: Dictionary of user session data
        ttl_seconds: Session expiration time (default 24 hours)
    
    Returns:
        True if successful, False otherwise
    """
    import json
    key = f"session:{session_id}"
    return cache_set(key, json.dumps(user_data), ex=ttl_seconds)


def session_get(session_id):
    """
    Retrieve session data from Redis.
    
    Args:
        session_id: Unique session identifier
    
    Returns:
        Dictionary of user session data or None
    """
    import json
    key = f"session:{session_id}"
    data = cache_get(key)
    
    if data:
        try:
            return json.loads(data)
        except:
            return None
    return None


def session_delete(session_id):
    """
    Delete a session from Redis.
    
    Args:
        session_id: Unique session identifier
    
    Returns:
        True if successful, False otherwise
    """
    key = f"session:{session_id}"
    return cache_delete(key)


def increment_counter(key, amount=1):
    """
    Increment a counter in Redis.
    
    Args:
        key: The counter key
        amount: Amount to increment by (default 1)
    
    Returns:
        New counter value or None on error
    """
    client = get_redis_client()
    if not client:
        return None
    
    try:
        if amount == 1:
            return client.incr(key)
        else:
            return client.incrby(key, amount)
    except Exception as e:
        print(f"Redis INCR error: {e}")
        return None


def test_connection():
    """
    Test the Redis connection.
    
    Returns:
        True if connection is successful, False otherwise
    """
    client = get_redis_client()
    if not client:
        return False
    
    try:
        client.set("_test_connection", "ok", ex=10)
        result = client.get("_test_connection")
        client.delete("_test_connection")
        return result == "ok"
    except Exception as e:
        print(f"Redis connection test failed: {e}")
        return False
