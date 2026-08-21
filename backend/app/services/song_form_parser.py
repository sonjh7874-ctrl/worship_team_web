"""송폼 문자열을 토큰 단위로 분류하는 순수 함수 모듈 (Phase 9).

Supabase 접근이나 다른 서비스 호출이 전혀 없다 — 입력 문자열만으로 결정되는 로직이라
`song_sections` 없이도, 네트워크 없이도 pytest로 검증할 수 있다. 실제 가사 조회·조합(구간 코드를
song_sections와 매칭하고 반복을 전개하는 일)은 이 모듈이 아니라 lyrics_service가 담당한다 —
"파서는 분류만, 조합은 서비스가"로 I/O와 순수 로직을 분리했다.

실제 콘티 27건(README 부록 B 포함)에서 관찰된 송폼 표기는 아래 5종으로 갈린다.
    - 구간 참조: A, A1, A2, B, C*, C**, B''' ...
    - 마디/간주 표기: (4), (8), (맞4), (맞8), (up) — 가사 없는 마커
    - 반복: x2, *2 (직전 블록을 n회 반복하라는 지시)
    - 인용 딸린 지시: bis(주 사랑만이~)*2, Tag(나의 노래로~받으소서)
    - 미해결: 위 어디에도 안 맞는 토큰(가사 첫 구절이 그대로 토큰인 경우 등) — 에러로 취급하지 않고
      원문 그대로 남겨 사람이 구간으로 등록하게 한다(README/API명세의 "부분 결과도 쓸모 있다" 원칙과 동일).
"""

import re
from dataclasses import dataclass

_SECTION_RE = re.compile(r"^[A-Za-z][0-9]*['*]*$")
_MARKER_RE = re.compile(r"^\((?:\d+|맞\d+|up)\)$")
_REPEAT_RE = re.compile(r"^[x*](\d+)$")
# 인용 안에 공백이 섞여 있어도(예: "주 사랑만이~") 그룹 전체를 하나로 묶어야 하므로
# tokenize 단계에서 이미 괄호 블록을 통째로 한 토큰으로 만들어 넘겨준다.
_QUOTED_RE = re.compile(r"^(\S+?)\((.+)\)(?:[x*](\d+))?$")

# 괄호 안의 공백은 토큰 구분자로 보지 않는다 — "bis(주 사랑만이~)*2"가 공백 때문에
# 두 토큰으로 쪼개지면 안 되기 때문에, 괄호 블록(+선택적 접두어/반복 접미어)을 먼저 통째로 매치한다.
_TOKENIZE_RE = re.compile(r"[^\s(]*\([^)]*\)[x*]?\d*|\S+")


@dataclass(frozen=True)
class Token:
    kind: str  # "section" | "marker" | "repeat" | "quoted" | "unresolved"
    raw: str
    section_code: str | None = None
    fallback_code: str | None = None  # 접미사(*, ')를 뗀 기본 구간 코드. 없으면 raw와 동일해 생략
    quote_text: str | None = None
    repeat_count: int | None = None


def tokenize(song_form: str | None) -> list[str]:
    if not song_form:
        return []
    return _TOKENIZE_RE.findall(song_form)


def _strip_variant_suffix(code: str) -> str | None:
    """"C**" -> "C", "B'''" -> "B". 변화가 없으면(접미사가 없으면) None을 돌려준다."""
    stripped = re.sub(r"[*']+$", "", code)
    return stripped if stripped != code else None


def classify_token(raw: str) -> Token:
    if _MARKER_RE.match(raw):
        return Token(kind="marker", raw=raw)

    repeat_match = _REPEAT_RE.match(raw)
    if repeat_match:
        return Token(kind="repeat", raw=raw, repeat_count=int(repeat_match.group(1)))

    quoted_match = _QUOTED_RE.match(raw)
    if quoted_match:
        prefix, quote, repeat_str = quoted_match.groups()
        return Token(
            kind="quoted",
            raw=raw,
            # prefix가 실제로 등록된 구간 코드인지는 lyrics_service가 song_sections를 조회해 판단한다.
            # 여기서는 형식을 가리지 않고 그대로 넘긴다("Tag"·"bis"처럼 A1 형식이 아닌 코드도 있을 수 있음).
            section_code=prefix,
            quote_text=quote,
            repeat_count=int(repeat_str) if repeat_str else None,
        )

    if _SECTION_RE.match(raw):
        return Token(
            kind="section",
            raw=raw,
            section_code=raw,
            fallback_code=_strip_variant_suffix(raw),
        )

    return Token(kind="unresolved", raw=raw)


def _merge_multiword_tokens(raw_tokens: list[str], known_multiword_codes: list[str]) -> list[str | Token]:
    """등록된 구간 코드 중 공백이 포함된 것("Let Everything" 등)이 있으면, 토큰화 이후에도
    여전히 따로 떨어진 원문 조각들을 다시 하나로 묶는다.

    송폼 원문(팀원이 그대로 보는 화면 텍스트)은 건드리지 않고 "Let Everything x2"처럼 그대로 두면서도,
    리더가 구간 코드를 원문 그대로("Let Everything") 등록해두면 자동으로 한 구간으로 인식되게 하는
    핵심 로직. 긴 코드부터 매칭해야 짧은 코드가 먼저 걸려 잘못 잘리는 일이 없다.
    """
    if not known_multiword_codes:
        return list(raw_tokens)

    phrases = sorted(
        ((code, code.split()) for code in known_multiword_codes if " " in code),
        key=lambda pair: -len(pair[1]),
    )
    if not phrases:
        return list(raw_tokens)

    merged: list[str | Token] = []
    i = 0
    n = len(raw_tokens)
    while i < n:
        matched_code = None
        matched_len = 0
        for code, words in phrases:
            span = len(words)
            if raw_tokens[i : i + span] == words:
                matched_code, matched_len = code, span
                break
        if matched_code:
            merged.append(Token(kind="section", raw=matched_code, section_code=matched_code))
            i += matched_len
        else:
            merged.append(raw_tokens[i])
            i += 1
    return merged


def parse_song_form(song_form: str | None, known_multiword_codes: list[str] | None = None) -> list[Token]:
    raw_tokens = tokenize(song_form)
    merged = _merge_multiword_tokens(raw_tokens, known_multiword_codes or [])
    return [item if isinstance(item, Token) else classify_token(item) for item in merged]
