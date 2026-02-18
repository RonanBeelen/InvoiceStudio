"""
Authentication middleware for FastAPI
Verifies Supabase JWT tokens and extracts user information.

Supports both:
  - ES256 (asymmetric) via SUPABASE_JWT_JWK env var (newer Supabase projects)
  - HS256 (symmetric) via SUPABASE_JWT_SECRET env var (legacy fallback)
"""
import os
import json
import jwt
from jwt import PyJWK
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

load_dotenv()

SUPABASE_JWT_JWK = os.getenv("SUPABASE_JWT_JWK")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

# Build the verification key and algorithm list at startup
_jwt_key = None
_jwt_algorithms = []

if SUPABASE_JWT_JWK:
    try:
        jwk_data = json.loads(SUPABASE_JWT_JWK)
        _jwt_key = PyJWK(jwk_data).key
        _jwt_algorithms = [jwk_data.get("alg", "ES256")]
        print(f"[Auth] Using JWK verification (alg={_jwt_algorithms[0]}, kid={jwk_data.get('kid', '?')})")
    except Exception as e:
        print(f"[Auth] WARNING: Failed to parse SUPABASE_JWT_JWK: {e}")

if not _jwt_key and SUPABASE_JWT_SECRET and SUPABASE_JWT_SECRET != "YOUR_JWT_SECRET_HERE":
    _jwt_key = SUPABASE_JWT_SECRET
    _jwt_algorithms = ["HS256"]
    print("[Auth] Using HS256 secret verification (legacy)")

security_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> dict:
    """
    FastAPI dependency that verifies the Supabase JWT token.
    Returns the decoded payload containing user_id in the 'sub' claim.

    Usage:
        @router.get("/templates")
        async def list_templates(user: dict = Depends(get_current_user)):
            user_id = user["sub"]
    """
    if not _jwt_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT verification key is not configured (set SUPABASE_JWT_JWK or SUPABASE_JWT_SECRET)",
        )

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            _jwt_key,
            algorithms=_jwt_algorithms,
            audience="authenticated",
        )
        return payload
    except jwt.ExpiredSignatureError:
        print("[Auth] Token expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is verlopen",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        print(f"[Auth] Invalid token error")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ongeldig token",
            headers={"WWW-Authenticate": "Bearer"},
        )
