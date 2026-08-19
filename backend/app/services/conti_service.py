from fastapi import HTTPException

from app.repositories import conti_repository, song_repository
from app.schemas.conti import (
    ContiCreate,
    ContiDetail,
    ContiListItem,
    ContiSongsPutRequest,
    ContiUpdate,
)


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


def update_conti(conti_id: int, payload: ContiUpdate) -> ContiListItem:
    fields = payload.model_dump(exclude_unset=True)
    if "service_date" in fields and fields["service_date"] is not None:
        fields["service_date"] = fields["service_date"].isoformat()

    row = conti_repository.update(conti_id, fields) if fields else conti_repository.find_by_id(conti_id)
    if row is None:
        raise HTTPException(status_code=404, detail="콘티를 찾을 수 없습니다.")
    return ContiListItem(**row)


def delete_conti(conti_id: int) -> None:
    if not conti_repository.delete(conti_id):
        raise HTTPException(status_code=404, detail="콘티를 찾을 수 없습니다.")


def put_conti_songs(conti_id: int, payload: ContiSongsPutRequest) -> ContiDetail:
    if conti_repository.find_by_id(conti_id) is None:
        raise HTTPException(status_code=404, detail="콘티를 찾을 수 없습니다.")

    rows = []
    for order_no, item in enumerate(payload.songs, start=1):
        song_id = item.song_id
        if song_id is None:
            if item.new_song is None:
                raise HTTPException(
                    status_code=400,
                    detail="song_id 또는 new_song 중 하나는 필수입니다.",
                )
            new_song = song_repository.create(
                item.new_song.title, item.new_song.artist, item.new_song.default_key
            )
            song_id = new_song["id"]
        rows.append(
            {
                "conti_id": conti_id,
                "song_id": song_id,
                "order_no": order_no,
                "song_key": item.song_key,
                "song_form": item.song_form,
                "note": item.note,
            }
        )

    conti_repository.replace_songs(conti_id, rows)
    return get_conti(conti_id)


def delete_conti_song(conti_id: int, order_no: int) -> None:
    if not conti_repository.delete_song(conti_id, order_no):
        raise HTTPException(status_code=404, detail="해당 순서의 곡을 찾을 수 없습니다.")
