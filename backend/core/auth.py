from functools import lru_cache

from fastapi import Header, HTTPException, Depends
from supabase import create_client, Client

from core.config import get_settings, Settings


@lru_cache
def _client(url: str, key: str) -> Client:
    """One Supabase client per (url, key), reused across requests. The sync
    client is stateless for our use (token checks + service-role reads/writes),
    so sharing it is safe and avoids rebuilding the stack on every call."""
    return create_client(url, key)


def get_supabase(settings: Settings = Depends(get_settings)) -> Client:
    return _client(settings.supabase_url, settings.supabase_service_key)


def _resolve_user(authorization: str | None, supabase: Client):
    """Supabase user for a Bearer token, or None when the header is missing /
    malformed or the token doesn't resolve to a user. A verification *error*
    (network, Supabase 5xx, rate-limit) is logged before returning None so a
    signed-in user silently degrading to guest is at least visible in the log."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ")
    try:
        result = supabase.auth.get_user(token)
    except Exception as e:
        print(f"[auth] token verification failed: {e}")
        return None
    return result.user if result else None


def get_current_user(
    authorization: str | None = Header(default=None),
    supabase: Client = Depends(get_supabase),
):
    user = _resolve_user(authorization, supabase)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or missing bearer token")
    return user


def get_optional_user(
    authorization: str | None = Header(default=None),
    supabase: Client = Depends(get_supabase),
):
    """Like get_current_user, but returns None instead of raising — for
    endpoints that work for both signed-in and anonymous visitors."""
    return _resolve_user(authorization, supabase)
