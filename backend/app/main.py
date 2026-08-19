from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError

from app.routers import calendar, contis, files, members, notices, schedules, songs

app = FastAPI(title="청년부 주일찬양팀 웹 API")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(APIError)
def handle_postgrest_api_error(request: Request, exc: APIError):
    # Supabase(Postgrest)가 DB 제약 위반 시 던지는 예외를 잡아 의미 있는 상태 코드로 변환한다.
    # 라우터마다 사전 중복 체크를 넣는 대신 여기서 한 번에 처리한다 — 콘티/곡/월스케줄/주차 등
    # unique 제약이 걸린 테이블 전부에 공통 적용됨(API명세 0-2절의 409 정의를 실제로 구현).
    if exc.code == "23505":
        return JSONResponse(
            status_code=409,
            content={"detail": "이미 존재하는 데이터입니다.", "error_code": "DUPLICATE"},
        )
    return JSONResponse(
        status_code=500,
        content={"detail": exc.message, "error_code": "DB_ERROR"},
    )

app.include_router(contis.router)
app.include_router(notices.router)
app.include_router(schedules.router)
app.include_router(calendar.router)
app.include_router(members.router)
app.include_router(songs.router)
app.include_router(files.router)


@app.get("/")
def health_check():
    return {"status": "ok"}
