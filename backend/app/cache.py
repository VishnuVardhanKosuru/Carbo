"""
Carbo Backend — In-memory TTL cache (mirrors ElectionApp CivicResponseCache).

Uses ``cachetools.TTLCache`` with SHA-256 key hashing so raw user data
is never stored as cache keys. Cache statistics are exposed via the API.
"""

from __future__ import annotations

import hashlib
import json
import time
from typing import Any, Optional

import cachetools

from app.config import get_settings

_settings = get_settings()

# Module-level cache instance (shared across requests)
_cache: Optional[cachetools.TTLCache] = None

# Counters
_hits: int = 0
_misses: int = 0
_start_time: float = time.monotonic()


def _get_cache() -> cachetools.TTLCache:
    """Lazily initialise and return the global TTLCache instance.

    Returns:
        Configured ``TTLCache`` instance.
    """
    global _cache
    if _cache is None:
        _cache = cachetools.TTLCache(
            maxsize=_settings.cache_maxsize,
            ttl=_settings.cache_ttl_seconds,
        )
    return _cache


def make_key(*args: Any, **kwargs: Any) -> str:
    """Compute a deterministic SHA-256 cache key from arbitrary arguments.

    Serialises ``args`` and ``kwargs`` to JSON (sorted keys) then hashes
    them so no raw user data appears in cache keys.

    Args:
        *args: Positional values to incorporate into the key.
        **kwargs: Keyword values to incorporate into the key.

    Returns:
        Hex-encoded SHA-256 digest string.
    """
    payload = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()


def get(key: str) -> Optional[Any]:
    """Retrieve a cached value, updating hit/miss counters.

    Args:
        key: Cache key string (from ``make_key``).

    Returns:
        Cached value or ``None`` on miss / expiry.
    """
    global _hits, _misses
    cache = _get_cache()
    val = cache.get(key)
    if val is None:
        _misses += 1
        return None
    _hits += 1
    return val


def set(key: str, value: Any) -> None:  # noqa: A001 – shadowing built-in intentionally
    """Store a value in the cache.

    Args:
        key: Cache key string.
        value: Value to store.
    """
    _get_cache()[key] = value


def clear() -> None:
    """Clear all cache entries and reset counters."""
    global _hits, _misses
    _get_cache().clear()
    _hits = 0
    _misses = 0


def stats() -> dict[str, Any]:
    """Return cache performance statistics.

    Returns:
        Dictionary containing hit count, miss count, current size,
        max size, TTL, and hit rate percentage.
    """
    cache = _get_cache()
    total = _hits + _misses
    hit_rate = round((_hits / total) * 100, 2) if total else 0.0
    return {
        "hits": _hits,
        "misses": _misses,
        "hit_rate_pct": hit_rate,
        "current_size": len(cache),
        "max_size": cache.maxsize,
        "ttl_seconds": cache.ttl,
        "uptime_seconds": round(time.monotonic() - _start_time, 2),
    }
