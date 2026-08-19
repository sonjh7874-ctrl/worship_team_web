from fastapi import FastAPI

from app.routers import calendar, contis, members, notices, schedules

app = FastAPI(title="청년부 주일찬양팀 웹 API")

app.include_router(contis.router)
app.include_router(notices.router)
app.include_router(schedules.router)
app.include_router(calendar.router)
app.include_router(members.router)


@app.get("/")
def health_check():
    return {"status": "ok"}
