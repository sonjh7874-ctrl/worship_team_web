import os

from dotenv import load_dotenv

load_dotenv(".env.local")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
# 로그인(회원가입·로그인·토큰 검증)은 anon 키로 호출한다.
# service_role 키는 RLS를 우회하므로 프로필 조회 등 서버 내부 로직에서만 쓴다(Phase 7).
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# AI 콘티 이미지 인식(Phase 6)용 OpenAI 설정.
# 모델은 vision + JSON 응답을 함께 지원하는 값이어야 하며, 교체 실험을 위해 환경변수로 덮어쓸 수 있게 둔다.
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_VISION_MODEL = os.getenv("OPENAI_VISION_MODEL", "gpt-4o")
# 이미지 1장 인식은 보통 10~20초 안에 끝나지만, 콘티가 길거나 응답이 느릴 때를 감안해 여유를 둔다.
OPENAI_TIMEOUT_SECONDS = 60

# 운영 프론트 도메인을 CORS 허용 출처에 추가한다(쉼표로 여러 개 구분, 예:
# "https://worship.example.com,https://www.worship.example.com"). 비워두면 로컬 개발 주소
# (localhost/127.0.0.1)만 허용된다 — 전체_구현_점검_보고서.md 2-3절. 배포 도메인이 정해지면
# 이 값을 .env.local(로컬) 또는 실제 운영 환경변수로 설정한다.
_cors_origins_raw = os.getenv("CORS_ALLOWED_ORIGINS", "")
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in _cors_origins_raw.split(",") if origin.strip()]
