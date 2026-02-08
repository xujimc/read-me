import hashlib
import json
import os

CACHE_DIR = os.path.join(os.path.dirname(__file__), '.cache')

def _ensure_cache_dir():
    os.makedirs(CACHE_DIR, exist_ok=True)

def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]

def get_cached_questions(article_text: str) -> list[str] | None:
    """Get cached questions for article text, or None if not cached."""
    _ensure_cache_dir()
    cache_file = os.path.join(CACHE_DIR, f'questions_{_hash_text(article_text)}.json')

    if os.path.exists(cache_file):
        with open(cache_file, 'r') as f:
            return json.load(f)
    return None

def cache_questions(article_text: str, questions: list[str]):
    """Cache questions for article text."""
    _ensure_cache_dir()
    cache_file = os.path.join(CACHE_DIR, f'questions_{_hash_text(article_text)}.json')

    with open(cache_file, 'w') as f:
        json.dump(questions, f)

def is_article_stored(article_text: str) -> bool:
    """Check if article has been stored in vector store."""
    _ensure_cache_dir()
    marker_file = os.path.join(CACHE_DIR, f'stored_{_hash_text(article_text)}')
    return os.path.exists(marker_file)

def mark_article_stored(article_text: str):
    """Mark article as stored in vector store."""
    _ensure_cache_dir()
    marker_file = os.path.join(CACHE_DIR, f'stored_{_hash_text(article_text)}')
    open(marker_file, 'w').close()
