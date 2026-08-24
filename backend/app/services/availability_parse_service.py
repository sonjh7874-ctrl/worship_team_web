"""참/불참 텍스트 AI 파싱 (Phase 11-B).

여러 명의 참/불참 텍스트를 한 번에 붙여넣으면, OpenAI 텍스트 모델을 1회 호출해 "빈 줄로 구분된
사람별 블록"을 사람별 JSON으로 구조화한다. 결과는 DB에 저장하지 않고 검수 화면으로 그대로 반환한다
(app/services/ai_parse_service.py의 이미지 인식과 동일한 역할 분리 — 이미지 대신 텍스트만 다뤄 별도 파일로
분리했다. 날짜(연/월+일)는 모델이 아니라 서버가 조합한다 — Phase 6의 "날짜는 서버가 계산" 원칙과 동일하게,
모델이 연/월을 잘못 짚는 위험을 원천 차단한다).
"""

import json
import re
import unicodedata
from datetime import date

import openai
from fastapi import HTTPException

from app.config import OPENAI_API_KEY, OPENAI_TIMEOUT_SECONDS, OPENAI_VISION_MODEL
from app.repositories import member_repository
from app.schemas.availability import AvailabilityEntry, AvailabilityParseResult, ParsedPerson

# 실제 카톡 텍스트(2026-08-24 사용자 제공, 7명분)를 기준으로 관찰한 표기를 그대로 프롬프트에 담았다.
# 콤마·공백 유무가 사람마다 다르고 `전참`/`전체 불참` 같은 자연어 축약이 섞여 있어, 콘티 송폼과 마찬가지로
# 정규식보다 AI 파싱이 맞는 케이스다(전체_로드맵.md Phase 11-B 관찰 참고).
PROMPT = """당신은 교회 찬양팀의 월간 참/불참 제출 텍스트를 읽어 JSON으로 옮기는 도구입니다.

여러 사람의 메시지가 빈 줄로 구분되어 하나의 텍스트로 붙여넣어져 있습니다. 각 사람의 메시지는
보통 이런 구조입니다:

예시 1:
```
8월 섬김 일정 (서유진)
1,2일 참
8,9일 참
15,16일 참
22,23일 참
29일 불참(결혼식), 30일 참

특새 참
```

예시 2:
```
8월 섬김 일정 (김진유)

1일 불참 (청소년부 수련회) 2일 참
8, 9일 참
15일 불참 (가족일정) 16일 참
22, 23일 참
29, 30일 참

특새 참
```

예시 3 (전체 참석/불참 축약):
```
8월 섬김 일정 (송지오)

전참/ 특새 참
```
```
8월 섬김 일정(김예진)
전체 불참(출근)
```

다음 JSON 형식으로만 응답하세요:
{
  "people": [
    {
      "name_raw": "헤더 괄호 안의 이름",
      "default": "all_available" | "all_unavailable" | null,
      "default_reason": "전체 불참일 때 괄호 안 사유 또는 null",
      "days": [
        {"day": 1, "status": "available", "reason": null},
        {"day": 2, "status": "available", "reason": null},
        {"day": 29, "status": "unavailable", "reason": "결혼식"},
        {"day": 30, "status": "available", "reason": null}
      ]
    }
  ]
}

규칙:
1. `name_raw`는 헤더의 `OO월 섬김 일정 (이름)`에서 괄호 안 이름만 뽑습니다. 괄호 앞뒤 공백은 무시합니다.
2. **날짜는 "일(day)" 숫자만 뽑으세요.** 연도·월은 신경 쓰지 말고 텍스트에 적힌 일(day) 숫자 그대로
   정수로 옮깁니다. `1,2일 참`이면 1일과 2일 각각을 `days` 배열에 넣습니다.
3. `1,2일 참`처럼 같은 상태로 묶여 있으면 각 날짜를 개별 항목으로 풀어서 넣되 상태(status)는 동일하게,
   사유(reason)도 동일하게 채웁니다.
4. `29일 불참(결혼식), 30일 참`처럼 같은 페어 안에서 날짜별로 상태가 다르면 **각 날짜를 정확히 그 상태로**
   나눠 넣습니다. 절대 합치거나 앞 날짜의 상태로 뒤 날짜를 덮어쓰지 마세요.
5. `전참`은 `default: "all_available"`로, `전체 불참(사유)`는 `default: "all_unavailable"` +
   `default_reason`에 괄호 안 사유로 표시합니다. 이 경우 `days`는 빈 배열로 둡니다.
6. `특새` 관련 줄(`특새 참`, `특새 불참(출근)` 등)은 **무시하고 결과에 포함하지 마세요.**
   정기 주일 스케줄과 무관한 별도 항목입니다.
7. status는 반드시 "available" 또는 "unavailable" 중 하나입니다.
8. 사유가 없으면 reason은 null입니다. 괄호 안 텍스트를 그대로 옮기되 괄호 자체는 빼고 내용만 담습니다.
9. 한 사람의 메시지에서 아무 참/불참 정보도 찾을 수 없으면 `default`와 `days` 모두 비워두지 말고
   그 사람 항목 자체를 결과에서 제외하세요.
10. **텍스트에 없는 내용을 만들어 넣지 마세요.**
"""


def _normalize_name(name: str) -> str:
    """이름 매칭용 정규화 — 공백·특수문자 제거.

    ai_parse_service._normalize_title과 동일한 목적이지만, 로직이 짧아 공유 모듈로 뽑기보다
    이 파일에 그대로 둔다(전체_로드맵.md Phase 11-B 파생 결정 7).
    """
    return re.sub(r"[^0-9a-z가-힣]", "", unicodedata.normalize("NFKC", name).lower())


def _build_member_index() -> tuple[dict[str, int], dict[int, str]]:
    members = member_repository.find_all()
    name_index: dict[str, int] = {}
    team_by_id: dict[int, str] = {}
    for row in members:
        key = _normalize_name(row["name"])
        if key and key not in name_index:
            name_index[key] = row["id"]
        team_by_id[row["id"]] = row["team"]
    return name_index, team_by_id


def _call_openai(prompt: str, text: str) -> str:
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY가 설정되지 않았습니다.")

    client = openai.OpenAI(api_key=OPENAI_API_KEY, timeout=OPENAI_TIMEOUT_SECONDS)
    try:
        response = client.chat.completions.create(
            model=OPENAI_VISION_MODEL,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "user", "content": f"{prompt}\n\n다음은 실제 참/불참 텍스트입니다:\n\n{text}"}
            ],
        )
    except openai.APITimeoutError:
        raise HTTPException(
            status_code=504,
            detail="AI 인식이 시간 내에 끝나지 않았습니다. 다시 시도하거나 직접 입력해주세요.",
        )
    except openai.APIError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI 인식에 실패했습니다. 다시 시도하거나 직접 입력해주세요. ({type(exc).__name__})",
        )

    content = response.choices[0].message.content if response.choices else None
    if not content:
        raise HTTPException(
            status_code=502, detail="AI 인식 결과가 비어 있습니다. 다시 시도하거나 직접 입력해주세요."
        )
    return content


def split_person_blocks(full_text: str, names: list[str]) -> dict[str, str]:
    """전체 붙여넣기 텍스트를 이름 헤더 위치 기준으로 사람별 블록으로 나눈다.

    빈 줄 개수로 블록을 나누면 한 사람의 헤더와 본문 사이에 낀 빈 줄(`8월 섬김 일정 (송지오)\n\n전참...`
    같은 표기)도 블록 경계로 오인해 본문이 통째로 잘리는 버그가 있었다(실제 검증 중 발견 —
    송지오·김진유·백지은·손지헌 4명이 헤더만 남고 내용이 사라짐). 대신 각 이름이 처음 등장하는 줄을
    그 사람의 헤더로 보고, 등장 순서대로 다음 이름 헤더 직전까지를 한 사람의 블록으로 묶는다.
    """
    lines = full_text.split("\n")
    header_line_index: dict[str, int] = {}
    for name in names:
        # 실제 헤더 형식이 `(이름)`이라, 괄호로 감싸인 형태를 먼저 찾는다. 못 찾으면 단순 포함으로
        # 폴백한다 — 이름이 다른 사람 이름의 부분 문자열인 극단적인 경우를 줄이기 위함이다.
        for i, line in enumerate(lines):
            if f"({name})" in line:
                header_line_index[name] = i
                break
        else:
            for i, line in enumerate(lines):
                if name in line:
                    header_line_index[name] = i
                    break

    ordered = sorted(header_line_index.items(), key=lambda kv: kv[1])
    blocks: dict[str, str] = {}
    for idx, (name, start) in enumerate(ordered):
        end = ordered[idx + 1][1] if idx + 1 < len(ordered) else len(lines)
        blocks[name] = "\n".join(lines[start:end]).strip()
    return blocks


def _day_entries_to_dates(days: list[dict], year: int, month: int) -> list[AvailabilityEntry]:
    """일(day) 숫자만 담긴 파싱 결과를 실제 연/월과 조합해 date로 변환한다.

    날짜 조합 자체는 서버가 결정론적으로 계산한다 — 모델이 연/월을 잘못 짚는 위험을 원천 차단하려는
    Phase 6의 "날짜는 서버가 계산" 원칙과 동일하다. 존재하지 않는 날짜(예: 2월 30일)는 조용히 건너뛴다.
    """
    entries = []
    for day_item in days:
        day = day_item.get("day")
        status = day_item.get("status")
        if not isinstance(day, int) or status not in ("available", "unavailable"):
            continue
        try:
            entry_date = date(year, month, day)
        except ValueError:
            continue
        entries.append(AvailabilityEntry(date=entry_date, status=status, reason=day_item.get("reason")))
    return sorted(entries, key=lambda e: e.date)


def parse_availability_text(text: str, year: int, month: int, team: str) -> AvailabilityParseResult:
    if not text or not text.strip():
        return AvailabilityParseResult(people=[])

    raw = _call_openai(PROMPT, text)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail="AI 인식 결과를 해석할 수 없습니다. 다시 시도하거나 직접 입력해주세요.",
        )

    member_index, team_by_id = _build_member_index()
    all_names = [
        (item.get("name_raw") or "").strip() for item in data.get("people", []) if item.get("name_raw")
    ]
    person_blocks = split_person_blocks(text, all_names)

    people: list[ParsedPerson] = []
    for item in data.get("people", []):
        name_raw = (item.get("name_raw") or "").strip()
        if not name_raw:
            continue

        matched_member_id = member_index.get(_normalize_name(name_raw))
        matched_member_team = team_by_id.get(matched_member_id) if matched_member_id else None

        default = item.get("default")
        default_status = None
        if default == "all_available":
            default_status = "available"
        elif default == "all_unavailable":
            default_status = "unavailable"

        people.append(
            ParsedPerson(
                name_raw=name_raw,
                matched_member_id=matched_member_id,
                match_status="matched" if matched_member_id else "unmatched",
                matched_member_team=matched_member_team,
                default_status=default_status,
                default_reason=item.get("default_reason"),
                entries=_day_entries_to_dates(item.get("days", []), year, month),
                raw_text=person_blocks.get(name_raw, text.strip()),
            )
        )

    return AvailabilityParseResult(people=people)
