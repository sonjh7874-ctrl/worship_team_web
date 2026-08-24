import { useEffect, useState } from "react";
import { fetchAvailability, parseAvailability, putAvailability } from "../api/availability";
import { fetchMembers } from "../api/members";
import LoadingState from "../components/LoadingState";
import PageContainer from "../components/PageContainer";
import Badge from "../components/Badge";
import Button from "../components/Button";

const TEAM_LABELS = { singer: "싱어팀", instrument: "악기팀" };

// AI 파싱 결과 또는 저장된 데이터를 화면 편집용 카드 상태로 변환한다.
// entries의 date는 <input type="date">가 다루는 문자열 그대로 유지한다.
function toCard(person) {
  return {
    name_raw: person.name_raw ?? person.name,
    member_id: person.matched_member_id ?? person.member_id ?? null,
    // 매칭된 인명부 사람의 실제 팀(파싱 응답에만 있음, 저장된 데이터를 불러올 때는 없다) —
    // 지금 작업 중인 팀과 다르면 화면에서 경고 배지를 보여주는 데 쓰인다.
    matched_member_team: person.matched_member_team ?? null,
    default_status: person.default_status || "",
    default_reason: person.default_reason || "",
    raw_text: person.raw_text || "",
    entries: (person.entries || []).map((e) => ({ ...e, reason: e.reason || "" })),
  };
}

// 날짜를 "M/D" 형태로 짧게 표시한다(연도는 화면 상단에 이미 선택돼 있어 생략).
function shortDate(dateStr) {
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}/${Number(d)}`;
}

// 카드를 접었을 때 보여줄 한 줄 요약. 날짜별 항목이 많은 사람도 이 한 줄만 차지하므로
// 화면이 세로로 길어지는 문제를 줄인다.
function summarizeCard(card) {
  if (card.default_status === "available") return "전체 참석";
  if (card.default_status === "unavailable") {
    return `전체 불참${card.default_reason ? `(${card.default_reason})` : ""}`;
  }
  if (card.entries.length === 0) return "입력된 항목 없음";
  return card.entries
    .map((e) => {
      const label = e.status === "available" ? "참" : "불참";
      return `${shortDate(e.date)} ${label}${e.reason ? `(${e.reason})` : ""}`;
    })
    .join(", ");
}

function EntryRow({ entry, onChange, onRemove }) {
  return (
    <div className="availability-entry-row">
      <input
        type="date"
        aria-label="날짜"
        value={entry.date}
        onChange={(e) => onChange({ ...entry, date: e.target.value })}
      />
      <select aria-label="참석 여부" value={entry.status} onChange={(e) => onChange({ ...entry, status: e.target.value })}>
        <option value="available">참</option>
        <option value="unavailable">불참</option>
      </select>
      <input
        placeholder="사유(선택)"
        aria-label="사유"
        value={entry.reason}
        onChange={(e) => onChange({ ...entry, reason: e.target.value })}
      />
      <button type="button" onClick={onRemove}>
        삭제
      </button>
    </div>
  );
}

function PersonCard({ card, index, members, team, expanded, onToggleExpand, onChange, onRemove }) {
  function update(patch) {
    onChange(index, { ...card, ...patch });
  }
  function updateEntry(entryIndex, entry) {
    const entries = [...card.entries];
    entries[entryIndex] = entry;
    update({ entries });
  }
  function removeEntry(entryIndex) {
    update({ entries: card.entries.filter((_, i) => i !== entryIndex) });
  }
  function addEntry() {
    update({ entries: [...card.entries, { date: "", status: "available", reason: "" }] });
  }

  const mismatched = card.matched_member_team && card.matched_member_team !== team;

  return (
    <article className="availability-person-card">
      <div className="availability-person-card__header">
        <button type="button" className="availability-person-card__toggle" onClick={onToggleExpand} aria-expanded={expanded}>
        <span aria-hidden="true">{expanded ? "▼" : "▶"}</span>
        <strong>{card.name_raw}</strong>
        {card.member_id == null && <Badge tone="warm">미매칭</Badge>}
        {mismatched && (
          <Badge tone="danger">인명부상 {TEAM_LABELS[card.matched_member_team]} · 현재 {TEAM_LABELS[team]}</Badge>
        )}
        <span className="availability-person-card__summary">{summarizeCard(card)}</span>
        </button>
        <Button variant="danger" onClick={onRemove}>제외</Button>
      </div>

      {expanded && (
        <div className="availability-person-card__body">
          {card.member_id == null && (
            <div>
              <label>
                인명부 연결{" "}
                <select
                  value={card.member_id ?? ""}
                  onChange={(e) =>
                    update({ member_id: e.target.value ? Number(e.target.value) : null })
                  }
                >
                  <option value="">(미등록 인물로 저장)</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({TEAM_LABELS[m.team]})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div>
            <label>
              이번 달 기본값{" "}
              <select
                value={card.default_status}
                onChange={(e) => update({ default_status: e.target.value })}
              >
                <option value="">(없음, 날짜별로만 판단)</option>
                <option value="available">전체 참석</option>
                <option value="unavailable">전체 불참</option>
              </select>
            </label>{" "}
            {card.default_status && (
              <input
                placeholder="사유(선택)"
                value={card.default_reason}
                onChange={(e) => update({ default_reason: e.target.value })}
              />
            )}
          </div>

          <div className="availability-person-card__entries">
            <strong>날짜별 항목</strong>
            {card.entries.map((entry, i) => (
              <EntryRow
                key={i}
                entry={entry}
                onChange={(e) => updateEntry(i, e)}
                onRemove={() => removeEntry(i)}
              />
            ))}
            <button type="button" onClick={addEntry}>
              날짜 추가
            </button>
          </div>

          {card.raw_text && (
            <details className="availability-person-card__raw">
              <summary>원문 보기</summary>
              <pre>{card.raw_text}</pre>
            </details>
          )}
        </div>
      )}
    </article>
  );
}

function emptyTeamState() {
  return { bulkText: "", cards: [], savedCount: null, loaded: false };
}

function AvailabilityEdit() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // 싱어팀장/악기팀장이 각자 자기 팀만 다루므로, 두 팀의 작업 상태를 독립적으로 들고 있다가
  // 탭을 전환해도 서로의 입력 중인 내용을 잃지 않게 한다.
  const [team, setTeam] = useState("singer");
  const [teamState, setTeamState] = useState({ singer: emptyTeamState(), instrument: emptyTeamState() });
  const current = teamState[team];

  const [members, setMembers] = useState([]);
  const [expandedNames, setExpandedNames] = useState(new Set());

  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  function patchCurrent(patch) {
    setTeamState((prev) => ({ ...prev, [team]: { ...prev[team], ...patch } }));
  }

  function loadTeam(y, m, t) {
    setLoading(true);
    setError(null);
    Promise.all([fetchAvailability(y, m, t), members.length ? Promise.resolve(members) : fetchMembers()])
      .then(([availability, memberList]) => {
        if (!members.length) setMembers(memberList);
        setTeamState((prev) => ({
          ...prev,
          [t]: { bulkText: "", cards: availability.submissions.map(toCard), savedCount: availability.submissions.length, loaded: true },
        }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTeam(year, month, team);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!teamState[team].loaded) {
      loadTeam(year, month, team);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team]);

  function handleSearch(e) {
    e.preventDefault();
    // 연/월이 바뀌면 두 팀 모두 다시 불러와야 하므로 로드 상태를 초기화하고, 지금 보고 있는
    // 팀만 즉시 새로 불러온다(다른 팀은 그쪽 탭을 눌렀을 때 불러온다).
    setTeamState({ singer: emptyTeamState(), instrument: emptyTeamState() });
    loadTeam(year, month, team);
  }

  async function handleParse() {
    setError(null);
    setMessage(null);
    setParsing(true);
    try {
      const result = await parseAvailability(current.bulkText, Number(year), Number(month), team);
      const parsedCards = result.people.map(toCard);
      // 기존 카드를 통째로 교체하지 않고 이름 기준으로 병합한다 — 같은 사람이 다시 붙여넣어지면
      // 그 사람만 최신 내용으로 갱신하고, 새 사람은 추가하고, 언급되지 않은 기존 사람은 그대로 둔다.
      const merged = [...current.cards];
      parsedCards.forEach((newCard) => {
        const idx = merged.findIndex((c) => c.name_raw === newCard.name_raw);
        if (idx >= 0) merged[idx] = newCard;
        else merged.push(newCard);
      });
      patchCurrent({ cards: merged });
      setMessage(
        `${result.people.length}명 분석 완료(기존 목록에 병합됨). 아래 내용을 확인·수정한 뒤 저장하세요.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  }

  function updateCard(index, card) {
    patchCurrent({ cards: current.cards.map((c, i) => (i === index ? card : c)) });
  }

  function removeCard(index) {
    patchCurrent({ cards: current.cards.filter((_, i) => i !== index) });
  }

  function toggleExpand(name) {
    setExpandedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function expandAll() {
    setExpandedNames(new Set(current.cards.map((c) => c.name_raw)));
  }

  function collapseAll() {
    setExpandedNames(new Set());
  }

  async function handleSave() {
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const submissions = current.cards.map((card) => ({
        member_id: card.member_id,
        name_snapshot: card.name_raw,
        default_status: card.default_status || null,
        default_reason: card.default_reason || null,
        raw_text: card.raw_text,
        entries: card.entries
          .filter((e) => e.date)
          .map((e) => ({ date: e.date, status: e.status, reason: e.reason || null })),
      }));
      const result = await putAvailability(Number(year), Number(month), team, { submissions });
      patchCurrent({ cards: result.submissions.map(toCard), savedCount: result.submissions.length });
      setMessage(
        `저장되었습니다. 이 달 ${TEAM_LABELS[team]} 제출 전체가 지금 입력된 내용으로 교체됐습니다(다른 팀 데이터는 영향 없음).`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const teamMembers = members.filter((m) => m.team === team);
  const submittedIds = new Set(current.cards.map((c) => c.member_id).filter((id) => id != null));
  const missing = teamMembers.filter((m) => !submittedIds.has(m.id));

  return (
    <PageContainer size="editor" className="editor-page availability-editor-page">
      <h1>참/불참 현황</h1>
      <p>
        카톡에서 받은 여러 명의 참/불참 텍스트를 한 번에 붙여넣고 분석한 뒤, 확인·수정해서 저장하세요.
        저장은 지금 선택한 팀 데이터만 교체합니다(다른 팀 데이터는 그대로 유지). 이 화면은 배정
        화면과 아직 연동되지 않으며, 참고용으로만 쓰입니다.
      </p>

      <div className="availability-team-tabs" role="group" aria-label="팀 선택">
        {["singer", "instrument"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTeam(t)}
            className={team === t ? "availability-team-tabs__button availability-team-tabs__button--active" : "availability-team-tabs__button"}
            aria-pressed={team === t}
          >
            {TEAM_LABELS[t]}
          </button>
        ))}
      </div>

      <form onSubmit={handleSearch}>
        <label>
          연도{" "}
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="month-input month-input--year"
          />
        </label>{" "}
        <label>
          월{" "}
          <input
            type="number"
            min="1"
            max="12"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="month-input month-input--month"
          />
        </label>{" "}
        <button type="submit">조회</button>
      </form>

      {error && <p className="inline-notice inline-notice--danger" role="alert">{error}</p>}
      {message && <p className="inline-notice inline-notice--success">{message}</p>}

      {loading ? (
        <LoadingState label="참·불참 현황을 불러오는 중..." rows={4} />
      ) : (
        <>
          {current.savedCount !== null && (
            <p className="availability-status-copy">
              현재 저장된 {TEAM_LABELS[team]} 제출: {current.savedCount}건
            </p>
          )}
          {missing.length > 0 && (
            <p className="inline-notice inline-notice--warm">
              미제출({missing.length}명): {missing.map((m) => m.name).join(", ")}
            </p>
          )}

          <h2>텍스트 붙여넣기</h2>
          <textarea
            value={current.bulkText}
            onChange={(e) => patchCurrent({ bulkText: e.target.value })}
            rows={12}
            placeholder={`${TEAM_LABELS[team]} 카톡에서 받은 여러 명의 참/불참 메시지를 그대로 붙여넣으세요.\n\n예:\n8월 섬김 일정 (홍길동)\n1,2일 참\n8,9일 참\n...`}
          />
          <div>
            <button type="button" onClick={handleParse} disabled={parsing || !current.bulkText.trim()}>
              {parsing ? "분석 중..." : "AI로 분석"}
            </button>
          </div>

          {current.cards.length > 0 && (
            <>
              <h2>검토 · 확정 ({current.cards.length}명)</h2>
              <div className="inline-actions">
                <button type="button" onClick={expandAll}>
                  전체 펼치기
                </button>{" "}
                <button type="button" onClick={collapseAll}>
                  전체 접기
                </button>
              </div>
              {current.cards.map((card, i) => (
                <PersonCard
                  key={card.name_raw}
                  card={card}
                  index={i}
                  members={members}
                  team={team}
                  expanded={expandedNames.has(card.name_raw)}
                  onToggleExpand={() => toggleExpand(card.name_raw)}
                  onChange={updateCard}
                  onRemove={() => removeCard(i)}
                />
              ))}
              <button type="button" onClick={handleSave} disabled={saving}>
                {saving ? "저장 중..." : `${TEAM_LABELS[team]} 전체 저장`}
              </button>
            </>
          )}
        </>
      )}
    </PageContainer>
  );
}

export default AvailabilityEdit;
