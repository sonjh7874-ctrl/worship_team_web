from fastapi import HTTPException, UploadFile

from app.repositories import conti_repository, sheet_file_repository, song_repository
from app.schemas.conti import (
    ContiCreate,
    ContiDetail,
    ContiListItem,
    ContiSongsPutRequest,
    ContiUpdate,
    SheetFileItem,
)

ALLOWED_FILE_TYPES = {"score_pdf", "conti_image"}


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

    # Supabase 중첩 select 결과의 "songs" 키(조인된 곡 마스터)를 API 응답 스키마의 "song" 필드로 옮겨 담는다.
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

    # 파일마다 매번 새 서명 URL을 발급한다 — Storage 버킷이 Private이라 저장된 고정 URL이 없다.
    sheet_files = [
        SheetFileItem(
            id=sf["id"],
            file_type=sf["file_type"],
            file_name=sf["file_name"],
            url=sheet_file_repository.get_signed_url(sf["storage_path"]),
        )
        for sf in row.get("sheet_files", [])
    ]

    return ContiDetail(
        id=row["id"],
        service_date=row["service_date"],
        title=row["title"],
        status=row["status"],
        songs=songs,
        sheet_files=sheet_files,
    )


def create_conti(payload: ContiCreate) -> ContiListItem:
    row = conti_repository.create(payload.service_date, payload.title)
    return ContiListItem(**row)


def update_conti(conti_id: int, payload: ContiUpdate) -> ContiListItem:
    # exclude_unset으로 요청에 없는 필드는 그대로 두는 부분 수정(PATCH)을 구현한다.
    fields = payload.model_dump(exclude_unset=True)
    if "service_date" in fields and fields["service_date"] is not None:
        fields["service_date"] = fields["service_date"].isoformat()

    # 바꿀 필드가 하나도 없으면 update를 호출하지 않고 현재 값을 그대로 조회해 반환한다.
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

    # 배열 순서를 그대로 order_no(1부터)로 채택한다 — 요청 순서 = 콘티 상의 곡 순서.
    rows = []
    for order_no, item in enumerate(payload.songs, start=1):
        song_id = item.song_id
        # song_id가 없으면 검수 화면 등에서 "새로 등록"을 선택한 것이므로,
        # 곡 마스터를 먼저 만들고 그 id로 배치한다 (API명세 1-3 new_song 처리).
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


async def upload_sheet_file(conti_id: int, file_type: str, file: UploadFile) -> SheetFileItem:
    if conti_repository.find_by_id(conti_id) is None:
        raise HTTPException(status_code=404, detail="콘티를 찾을 수 없습니다.")
    # file_type은 DB의 check 제약(score_pdf | conti_image)과 동일하게 API 레벨에서도 먼저 걸러
    # Storage 업로드까지 갔다가 DB insert에서 실패하는 상황을 막는다.
    if file_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"file_type은 {sorted(ALLOWED_FILE_TYPES)} 중 하나여야 합니다.",
        )

    content = await file.read()
    row = sheet_file_repository.create(
        conti_id, file_type, file.filename or "file", content, file.content_type
    )
    return SheetFileItem(
        id=row["id"],
        file_type=row["file_type"],
        file_name=row["file_name"],
        url=sheet_file_repository.get_signed_url(row["storage_path"]),
    )


def delete_sheet_file(file_id: int) -> None:
    if not sheet_file_repository.delete(file_id):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
