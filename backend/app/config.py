import os

from dotenv import load_dotenv

load_dotenv(".env.local")

EDIT_PASSWORD = os.getenv("EDIT_PASSWORD")
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
