"""송폼 파서(app/services/song_form_parser.py) 회귀 테스트 (Phase 9).

파서가 외부 I/O 없는 순수 함수라 픽스처·네트워크 없이 돈다. 여기 쓰인 송폼 문자열은
README 부록 B와 docs/전체_로드맵.md Phase 6 견적 검토에 이미 실려 있는 예시라 팀 가사
데이터를 새로 넣지 않아도 되므로, git에 올릴 수 있는 첫 테스트가 됐다.

실행: backend 디렉터리에서 `python -m pytest`
"""

from app.services.song_form_parser import parse_song_form, tokenize


def test_tokenize_keeps_parenthesized_quote_with_inner_space_intact():
    # "bis(주 사랑만이~)*2"는 괄호 안에 공백이 있어 단순 split()으로는 두 토큰으로 쪼개진다.
    # 이 케이스를 한 토큰으로 유지하는 것이 tokenize()의 핵심 역할이다.
    assert tokenize("D C* C bis(주 사랑만이~)*2") == ["D", "C*", "C", "bis(주 사랑만이~)*2"]


def test_empty_or_missing_song_form_returns_no_tokens():
    assert parse_song_form("") == []
    assert parse_song_form(None) == []


def test_plain_section_reference_has_no_fallback():
    tokens = parse_song_form("A1 A2 B")
    assert [(t.kind, t.raw, t.fallback_code) for t in tokens] == [
        ("section", "A1", None),
        ("section", "A2", None),
        ("section", "B", None),
    ]


def test_variant_suffix_section_reference_has_fallback_code():
    tokens = parse_song_form("(4) A B C (8) A B C C (4) C* C** (8)")
    variants = [(t.raw, t.fallback_code) for t in tokens if t.kind == "section" and t.raw in ("C*", "C**")]
    assert variants == [("C*", "C"), ("C**", "C")]


def test_apostrophe_variant_section_reference():
    tokens = parse_song_form("(8) C C C B B B'''")
    b_variant = next(t for t in tokens if t.raw == "B'''")
    assert b_variant.kind == "section"
    assert b_variant.fallback_code == "B"


def test_marker_tokens_carry_no_lyrics():
    tokens = parse_song_form("(4) A1 A2 B (맞4) A2 B (맞4) (up) B B")
    markers = [t.raw for t in tokens if t.kind == "marker"]
    assert markers == ["(4)", "(맞4)", "(맞4)", "(up)"]


def test_standalone_repeat_token():
    tokens = parse_song_form("Let Everything x2 A1")
    repeats = [t for t in tokens if t.kind == "repeat"]
    assert len(repeats) == 1
    assert repeats[0].repeat_count == 2


def test_quoted_directive_with_repeat_suffix():
    tokens = parse_song_form("D C* C bis(주 사랑만이~)*2")
    quoted = [t for t in tokens if t.kind == "quoted"]
    assert len(quoted) == 1
    assert quoted[0].section_code == "bis"
    assert quoted[0].quote_text == "주 사랑만이~"
    assert quoted[0].repeat_count == 2


def test_quoted_directive_without_repeat_suffix():
    tokens = parse_song_form("Tag(나의 노래로~받으소서) (up) B2 A")
    quoted = [t for t in tokens if t.kind == "quoted"]
    assert len(quoted) == 1
    assert quoted[0].section_code == "Tag"
    assert quoted[0].quote_text == "나의 노래로~받으소서"
    assert quoted[0].repeat_count is None


def test_unresolved_lyric_phrase_tokens_are_not_dropped():
    # 실제 오독 사례(README/Phase 6 후속: "호흡있는" -> "흐름있는")와 같은 유형 —
    # 견적 검토가 못 잡았던 5%가 여기 해당한다. 조용히 사라지지 않고 unresolved로 남아야 한다.
    tokens = parse_song_form("(8) Let Everything x2 호흡있는 x2")
    unresolved = [t.raw for t in tokens if t.kind == "unresolved"]
    assert unresolved == ["Let", "Everything", "호흡있는"]


def test_full_real_song_form_example_classifies_every_token():
    # README 부록 B의 실제 콘티 예시 원문. 모든 토큰이 5종 중 하나로 분류돼야 한다(누락 없음).
    song_form = "(12) A B C (맞4) A* B C (맞8) D C* C bis(주 사랑만이~)*2"
    tokens = parse_song_form(song_form)
    assert len(tokens) == len(tokenize(song_form))
    assert all(t.kind in ("section", "marker", "repeat", "quoted", "unresolved") for t in tokens)
    kinds = [t.kind for t in tokens]
    assert kinds.count("marker") == 3  # (12), (맞4), (맞8)
    assert kinds.count("quoted") == 1  # bis(...)*2
