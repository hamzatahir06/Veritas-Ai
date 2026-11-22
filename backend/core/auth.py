import logging
from functools import lru_cache

from fastapi import Depends, Header, HTTPException
from supabase import Client, create_client
from supabase_auth.errors import AuthApiError

from core.config import Settings, get_settings

log = logging.getLogger(__name__)


@lru_cache
def _client(url: str, key: str) -> Client:
    """One Supabase client per (url, key), reused across requests. The sync
    client is stateless for our use (token checks + service-role reads/writes),
    so sharing it is safe and avoids rebuilding the stack on every call."""
    return create_client(url, key)


def get_supabase(settings: Settings = Depends(get_settings)) -> Client:
    return _client(settings.supabase_url, settings.supabase_service_key)


def _resolve_user(authorization: str | None, supabase: Client, *, required: bool):
    """Supabase user for a Bearer token, or None when the header is missing /
    malformed or the token doesn't resolve to a user.

    Supabase rejects a bad / expired token with a 4xx AuthApiError: that is a
    plain "not signed in". A verification *error* (network, DNS, Supabase 5xx)
    is not a bad token, so it is logged and, when a user is `required`, answered with 503 —
    a 401 would wrongly tell a signed-in user they aren't. Optional routes
    degrade to guest instead, which the log makes visible."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ")
    try:
        result = supabase.auth.get_user(token)
    except Exception as e:
        if isinstance(e, AuthApiError) and e.status and e.status < 500:
            return None  # Supabase rejected the token itself: expired, malformed, revoked.
        log.warning("token verification failed: %s", e)
        if required:
            raise HTTPException(
                status_code=503, detail="Couldn't verify your sign-in right now — please try again."
            ) from e
        return None
    return result.user if result else None


def get_current_user(
    authorization: str | None = Header(default=None),
    supabase: Client = Depends(get_supabase),
):
    user = _resolve_user(authorization, supabase, required=True)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or missing bearer token")
    return user


def get_optional_user(
    authorization: str | None = Header(default=None),
    supabase: Client = Depends(get_supabase),
):
    """Like get_current_user, but returns None instead of raising — for
    endpoints that work for both signed-in and anonymous visitors."""
    return _resolve_user(authorization, supabase, required=False)
