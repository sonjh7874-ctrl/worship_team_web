from functools import lru_cache

from supabase import Client, create_client

from app.config import SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL


@lru_cache
def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


@lru_cache
def get_supabase_anon() -> Client:
    # 회원가입·로그인·토큰 검증(auth.get_user)은 RLS를 우회할 필요가 없어
    # anon 키 클라이언트를 별도로 둔다(Phase 7).
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
