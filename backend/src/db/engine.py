import os, psycopg2

from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from dotenv import load_dotenv

from ..logger import logger

load_dotenv()

DATABASE_URI = os.getenv("DATABASE_URI")

if not DATABASE_URI:
    raise ValueError("DATABASE_URI environment variable is not set")

# Connection pool (initialized lazily via init_pool)
pg_pool: pool.ThreadedConnectionPool | None = None

def init_pool() -> None:
    # Initialize the thread-safe connection pool. Call once at app startup.
    global pg_pool
    
    if pg_pool is not None:
        logger.warning("Connection pool already initialized, skipping")
        return
    
    try:
        # Min 2 connections, Max 20 connections
        pg_pool = pool.ThreadedConnectionPool(2, 20, DATABASE_URI)
        logger.info("Database connection pool created (min=2, max=20)")
    except Exception as e:
        logger.error(f"Error creating connection pool: {e}")
        raise

def close_pool() -> None:
    # Close all connections in the pool. Call at app shutdown.
    global pg_pool
    
    if pg_pool is None:
        logger.warning("Connection pool not initialized, nothing to close")
        return
    
    pg_pool.closeall()
    pg_pool = None
    logger.info("Database connection pool closed")

@contextmanager
def get_connection():
    """
    Context manager for database connections using the pool.
    Connections are returned to the pool after use, not closed.
    """
    if pg_pool is None:
        raise RuntimeError("Connection pool not initialized. Call init_pool() first.")
    
    conn = None
    try:
        conn = pg_pool.getconn()
        yield conn
    except psycopg2.Error as e:
        logger.error(f"Database connection error: {e}")
        raise
    finally:
        if conn:
            pg_pool.putconn(conn)

@contextmanager
def get_cursor(commit: bool = False):
    """
    Context manager for database cursor with automatic commit/rollback.
    Returns a RealDictCursor for dictionary-style row access.
    
    Args:
        commit: If True, commits on success. If False, caller handles commit.
    
    Usage:
        with get_cursor(commit=True) as cur:
            cur.execute("INSERT INTO leads (email) VALUES (%s)", ("test@example.com",))
        
        with get_cursor() as cur:
            cur.execute("SELECT * FROM leads WHERE id = %s", (lead_id,))
            lead = cur.fetchone()  # Returns dict: {"id": "...", "email": "..."}
    """
    with get_connection() as conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            yield cur
            if commit:
                conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Database operation failed, rolled back: {e}")
            raise
        finally:
            cur.close()

def test_connection() -> bool:
    # Test if database connection works.
    try:
        with get_cursor() as cur:
            cur.execute("SELECT 1")
            return True
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        return False