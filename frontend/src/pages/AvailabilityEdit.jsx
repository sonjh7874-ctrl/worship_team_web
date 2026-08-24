import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAvailability, parseAvailability, putAvailability } from "../api/availability";
import { fetchMembers } from "../api/members";

// AI 파싱 결과 또는 저장된 데이터를 화면 편집용 카드 상태로 변환한다.
// entries의 date는 <input type="date">가 다루는 문자열 그대로 유지한다.
function toCard(person) {
  return {
    name_raw: person.name_raw ?? person.name,
    member_id: person.matched_member_id ?? person.member_id ?? null,
    match_status: person.match_status ?? (person.member_id ? "matched" : "unmatched"),
    default_status: person.default_status || "",
    default_reason: person.default_reason || "",
    raw_text: person.raw_text || "",
    entries: (person.entries || []).map((e) => ({ ...e, reason: e.reason || "" })),
  };
}

function EntryRow({ entry, onChange, onRemove }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
      <input
        type="date"
        value={entry.date}
        onChange={(e) => onChange({ ...entry, date: e.target.value })}
      />
      <select value={entry.status} onChange={(e) => onChange({ ...entry, status: e.target.value })}>
        <option value="available">참</option>
        <option value="unavailable">불참</option>
      </select>
      <input
        placeholder="사유(선택)"
        value={entry.reason}
        onChange={(e) => onChange({ ...entry, reason: e.target.value })}
        style={{ flex: 1 }}
      />
      <button type="button" onClick={onRemove}>
        삭제
      </button>
    </div>
  );
}

function PersonCard({ card, index, members, onChange, onRemove }) {
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

  const team = findTeam(card.member_id, members);

  return (
    <div style={{ border: "1px solid #ccc", padding: "0.75rem", marginBottom: "0.75rem" }}>
      <strong>{card.name_raw}</strong>{" "}
      {team && <span style={{ color: "#555" }}>[{TEAM_LABELS[team]}]</span>}{" "}
      {/* member_id 기준으로 판정한다 — match_status는 최초 파싱/조회 시점 값이라, 아래 드롭다운으로
          수동 연결한 뒤에도 갱신되지 않아 "미매칭"으로 잘못 남아있는 문제가 있었다. */}
      {card.member_id != null ? (
        <span style={{ color: "green" }}>인명부 매칭됨</span>
      ) : (
        <span style={{ color: "#b36b00" }}>미매칭 — 아래에서 인명부 선택 또는 미등록으로 저장</span>
      )}{" "}
      <button type="button" onClick={onRemove} style={{ color: "red" }}>
        이 사람 제외
      </button>
      <div>
        <label>
          인명부 연결{" "}
          <select
            value={card.member_id ?? ""}
            onChange={(e) => update({ member_id: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">(미등록 인물로 저장)</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>
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

      <div style={{ marginTop: 8 }}>
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
        <details style={{ marginTop: 8 }}>
          <summary>원문 보기</summary>
          <pre style={{ whiteSpace: "pre-wrap" }}>{card.raw_text}</pre>
        </details>
      )}
    </div>
  );
}

// member_id로 인명부에서 팀(singer/instrument)을 찾는다. 미매칭 카드(member_id가 null)는
// 팀을 알 수 없으므로 null을 돌려준다 — 이런 카드는 탭 필터와 무관하게 항상 보여줘야 한다.
function findTeam(memberId, members) {
  if (memberId == null) return null;
  const member = members.find((m) => m.id === memberId);
  return member ? member.team : null;
}

const TEAM_LABELS = { singer: "싱어팀", instrument: "악기팀" };

function AvailabilityEdit() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [members, setMembers] = useState([]);
  const [bulkText, setBulkText] = useState("");
  const [cards, setCards] = useState([]);
  const [savedCount, setSavedCount] = useState(null);
  // "all" | "singer" | "instrument" — 인명부와 매칭된 카드만 이 필터의 영향을 받는다.
  const [teamFilter, setTeamFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  function load(y, m) {
    setLoading(true);
    setError(null);
    Promise.all([fetchAvailability(y, m), fetchMembers()])
      .then(([availability, memberList]) => {
        setMembers(memberList);
        setCards(availability.submissions.map(toCard));
        setSavedCount(availability.submissions.length);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    load(year, month);
  }

  async function handleParse() {
    setError(null);
    setMessage(null);
    setParsing(true);
    try {
      const result = await parseAvailability(bulkText, Number(year), Number(month));
      const parsedCards = result.people.map(toCard);
      // 기존 카드를 통째로 교체하지 않고 이름 기준으로 병합한다 — 같은 사람이 다시 붙여넣어지면
      // 그 사람만 최신 내용으로 갱신하고, 새 사람은 추가하고, 언급되지 않은 기존 사람은 그대로 둔다.
      // (늦게 제출한 몇 명만 다시 붙여넣었는데 이미 저장돼 있던 나머지 사람들이 저장 시 사라지는
      // 문제가 있어 수정했다.)
      setCards((prev) => {
        const merged = [...prev];
        parsedCards.forEach((newCard) => {
          const idx = merged.findIndex((c) => c.name_raw === newCard.name_raw);
          if (idx >= 0) merged[idx] = newCard;
          else merged.push(newCard);
        });
        return merged;
      });
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
    setCards((prev) => prev.map((c, i) => (i === index ? card : c)));
  }

  function removeCard(index) {
    setCards((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const submissions = cards.map((card) => ({
        member_id: card.member_id,
        name_snapshot: card.name_raw,
        default_status: card.default_status || null,
        default_reason: card.default_reason || null,
        raw_text: card.raw_text,
        entries: card.entries
          .filter((e) => e.date)
          .map((e) => ({ date: e.date, status: e.status, reason: e.reason || null })),
      }));
      const result = await putAvailability(Number(year), Number(month), { submissions });
      setCards(result.submissions.map(toCard));
      setSavedCount(result.submissions.length);
      setMessage("저장되었습니다. 이 달의 참/불참 제출 전체가 지금 입력된 내용으로 교체됐습니다.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link to="/schedules">← 스케줄로</Link>
      <h1>참/불참 현황</h1>
      <p style={{ color: "#666" }}>
        카톡에서 받은 여러 명의 참/불참 텍스트를 한 번에 붙여넣고 분석한 뒤, 확인·수정해서 저장하세요.
        저장하면 이 달의 참/불참 제출 전체가 지금 화면 내용으로 교체됩니다. 이 화면은 배정 화면과
        아직 연동되지 않으며, 참고용으로만 쓰입니다.
      </p>

      <form onSubmit={handleSearch}>
        <label>
          연도{" "}
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            style={{ width: "5em" }}
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
            style={{ width: "3em" }}
          />
        </label>{" "}
        <button type="submit">조회</button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      {loading ? (
        <p>불러오는 중...</p>
      ) : (
        <>
          {savedCount !== null && (
            <p style={{ color: "#666" }}>현재 저장된 제출: {savedCount}건</p>
          )}
          {members.length > 0 &&
            (() => {
              const submittedIds = new Set(cards.map((c) => c.member_id).filter((id) => id != null));
              const missing = members.filter((m) => !submittedIds.has(m.id));
              if (missing.length === 0) return null;
              const missingSinger = missing.filter((m) => m.team === "singer");
              const missingInstrument = missing.filter((m) => m.team === "instrument");
              return (
                <div style={{ color: "#b36b00" }}>
                  {missingSinger.length > 0 && (
                    <p>미제출 · 싱어팀({missingSinger.length}명): {missingSinger.map((m) => m.name).join(", ")}</p>
                  )}
                  {missingInstrument.length > 0 && (
                    <p>미제출 · 악기팀({missingInstrument.length}명): {missingInstrument.map((m) => m.name).join(", ")}</p>
                  )}
                </div>
              );
            })()}

          <h2>텍스트 붙여넣기</h2>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={12}
            style={{ width: "100%" }}
            placeholder={"카톡에서 받은 여러 명의 참/불참 메시지를 그대로 붙여넣으세요.\n\n예:\n8월 섬김 일정 (홍길동)\n1,2일 참\n8,9일 참\n..."}
          />
          <div>
            <button type="button" onClick={handleParse} disabled={parsing || !bulkText.trim()}>
              {parsing ? "분석 중..." : "AI로 분석"}
            </button>
          </div>

          {cards.length > 0 &&
            (() => {
              // 원래 인덱스를 유지한 채로 미매칭/매칭 카드를 나눈다 — updateCard/removeCard가
              // cards 배열의 실제 인덱스를 참조하므로 필터링 후에도 인덱스가 어긋나면 안 된다.
              const indexed = cards.map((card, i) => ({ card, i, team: findTeam(card.member_id, members) }));
              const unmatched = indexed.filter((x) => x.card.member_id == null);
              const matched = indexed.filter((x) => x.card.member_id != null);
              const visibleMatched =
                teamFilter === "all" ? matched : matched.filter((x) => x.team === teamFilter);

              return (
                <>
                  <h2>검토 · 확정 ({cards.length}명)</h2>

                  <div style={{ marginBottom: 12 }}>
                    {["all", "singer", "instrument"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTeamFilter(t)}
                        style={{
                          marginRight: 6,
                          fontWeight: teamFilter === t ? "bold" : "normal",
                          textDecoration: teamFilter === t ? "underline" : "none",
                        }}
                      >
                        {t === "all" ? "전체" : TEAM_LABELS[t]}
                      </button>
                    ))}
                  </div>

                  {unmatched.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <strong>미매칭 — 팀을 알 수 없어 탭과 무관하게 항상 표시됩니다 ({unmatched.length}명)</strong>
                      {unmatched.map(({ card, i }) => (
                        <PersonCard
                          key={i}
                          card={card}
                          index={i}
                          members={members}
                          onChange={updateCard}
                          onRemove={() => removeCard(i)}
                        />
                      ))}
                    </div>
                  )}

                  {visibleMatched.length === 0 ? (
                    <p style={{ color: "#666" }}>이 팀에 해당하는 매칭된 제출이 없습니다.</p>
                  ) : (
                    visibleMatched.map(({ card, i }) => (
                      <PersonCard
                        key={i}
                        card={card}
                        index={i}
                        members={members}
                        onChange={updateCard}
                        onRemove={() => removeCard(i)}
                      />
                    ))
                  )}

                  <button type="button" onClick={handleSave} disabled={saving}>
                    {saving ? "저장 중..." : "이 달 전체 저장"}
                  </button>
                </>
              );
            })()}
        </>
      )}
    </div>
  );
}

export default AvailabilityEdit;
