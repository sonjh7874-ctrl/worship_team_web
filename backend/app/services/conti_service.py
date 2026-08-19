from fastapi import HTTPException

from app.repositories import conti_repository
from app.schemas.conti import ContiCreate, ContiDetail, ContiListItem


def list_contis() -> list[ContiListItem]:
    return [ContiListItem(**row) for row in conti_repository.find_all()]


def get_latest_conti() -> ContiDetail:
    latest = conti_repository.find_latest()
    if latest is None:
        raise HTTPException(status_code=404, detail="등록된 콘티가 없습니다.")
    return get_conti(latest["id"])


def get_conti(conti_id: int) -> ContiDetail:
    row = conti_repository.find_by_id(conti_id)
    if row is None:
        raise HTTPException(status_code=404, detail="콘티를 찾을 수 없습니다.")

    songs = [
        {
            "order_no": cs["order_no"],
            "song_key": cs["song_key"],
            "song_form": cs["song_form"],
            "note": cs["note"],
            "song": cs["songs"],
        }
        for cs in row.get("conti_songs", [])
    ]

    return ContiDetail(
        id=row["id"],
        service_date=row["service_date"],
        title=row["title"],
        status=row["status"],
        songs=songs,
        sheet_files=row.get("sheet_files", []),
    )


def create_conti(payload: ContiCreate) -> ContiListItem:
    row = conti_repository.create(payload.service_date, payload.title)
    return ContiListItem(**row)
