import os, psycopg2

from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from dotenv import load_dotenv

from ..logger import logger

load_dotenv()

DATABASE_URI = os.getenv("DATABASE_URI")

if not DATABASE_URI:
    raise ValueError("DATABASE_URI environment variable is not set")

@contextmanager
def get_connection():
    """
    Context manager for database connections.
    Automatically handles connection cleanup.
    
    Usage:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM leads")
                results = cur.fetchall()
    """
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URI)
        yield conn
    except psycopg2.Error as e:
        logger.error(f"Database connection error: {e}")
        raise
    finally:
        if conn:
            conn.close()

@contextmanager
def get_cursor(commit: bool = False):
    """
    Context manager for database cursor with automatic commit/rollback.
    Returns a RealDictCursor for dictionary-style row access.
    
    Args:
        commit: If True, commits on success. If False, caller handles commit.
    
    Usage:
        with get_cursor() as cur:
            cur.execute("INSERT INTO leads (email) VALUES (%s)", ("test@example.com",))
            # Automatically commits on exit
        
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