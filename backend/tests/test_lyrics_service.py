"""자막 가사 조합 서비스(app/services/lyrics_service.py)의 순수 로직 회귀 테스트 (Phase 9).

`_build_song_blocks`는 DB 접근 없이 이미 조회된 구간 딕셔너리를 인자로 받는 내부 함수라
더미 데이터만으로 pytest가 돈다. 여기 쓰인 텍스트는 전부 테스트용 더미 문자열이다.

실행: backend 디렉터리에서 `python -m pytest`
"""

from app.services.lyrics_service import _build_song_blocks


def _lookup(rows: dict[str, str]) -> dict[str, dict]:
    # section_code -> lyrics 형태의 더미 데이터를 lyrics_service가 기대하는 조회 딕셔너리로 변환한다.
    return {code: {"lyrics": text, "canonical": code, "via_alias": False} for code, text in rows.items()}


def test_non_ascii_unresolved_token_resolves_when_registered_exactly():
    # 회귀 테스트: 파서가 "구간(section)" 종류로 분류하지 못하는 토큰(한글 단어 등, ^[A-Za-z]로
    # 시작하지 않는 경우)은 kind="unresolved"로 분류돼 예전엔 구간 조회를 아예 시도하지 않고
    # 무조건 미해결로 남았다. 정확히 등록했는데도 계속 미해결로 보이던 실제 버그.
    sections = _lookup({"호흡있는": "더미 가사"})
    blocks, unresolved_count = _build_song_blocks("호흡있는", sections)
    assert unresolved_count == 0
    assert [(b.kind, b.section_code, b.text) for b in blocks] == [("lyrics", "호흡있는", "더미 가사")]


def test_non_ascii_unresolved_token_stays_unresolved_when_not_registered():
    sections = _lookup({})
    blocks, unresolved_count = _build_song_blocks("호흡있는", sections)
    assert unresolved_count == 1
    assert blocks[0].kind == "unresolved"
    assert blocks[0].text == "호흡있는"


def test_multiword_english_phrase_resolves_and_repeats():
    sections = _lookup({"Let Everything": "더미 가사"})
    blocks, unresolved_count = _build_song_blocks("Let Everything x2", sections)
    assert unresolved_count == 0
    assert [(b.kind, b.section_code) for b in blocks] == [
        ("lyrics", "Let Everything"),
        ("lyrics", "Let Everything"),
    ]


def test_ordinary_section_reference_still_resolves():
    sections = _lookup({"A1": "더미 가사 A1", "B": "더미 가사 B"})
    blocks, unresolved_count = _build_song_blocks("A1 B", sections)
    assert unresolved_count == 0
    assert [b.section_code for b in blocks] == ["A1", "B"]
