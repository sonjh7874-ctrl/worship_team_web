import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { fetchMembers } from "../api/members";
import {
  fetchAssignmentCounts,
  fetchSchedule,
  fetchWeekSuggestions,
  putAssignments,
  updateWeek,
} from "../api/schedules";

// position_code(배정 저장 시 쓰는 값)와 field(GET 응답의 instrument.* 키)가 다른 경우가 있다
// (inst_score → score) — 응답에서 기존 배정을 읽어올 때 이 매핑으로 되짚는다.
const INSTRUMENT_POSITIONS = [
  { code: "key1", field: "key1", label: "Key1" },
  { code: "key2", field: "key2", label: "Key2" },
  { code: "drum", field: "drum", label: "드럼" },
  { code: "bass", field: "bass", label: "베이스" },
  { code: "electric", field: "electric", label: "일렉" },
  { code: "singer_helper", field: "singer_helper", label: "싱도/자막" },
  { code: "inst_score", field: "score", label: "악보" },
];

// 무대 배치가 성별 고정이라(README 4절, Phase 12 후속) 마이크 1·4·5·8은 남자, 2·3·6·7은
// 여자 자리다. 라벨에 표시해 리더가 드롭다운에서 바로 참고할 수 있게 한다.
const MALE_MIC_SLOTS = new Set(["1", "4", "5", "8"]);
const GENDER_LABELS = { male: "남", female: "여" };

const MIC_POSITIONS = Array.from({ length: 8 }, (_, i) => {
  const slot = String(i + 1);
  return {
    code: `mic${i + 1}`,
    slot,
    label: `마이크 ${i + 1} (${MALE_MIC_SLOTS.has(slot) ? "남" : "여"} 자리)`,
  };
});

// counts가 있으면(마이크 슬롯 전용, Phase 11-A) 옵션 라벨에 "이번 달 N · 올해 M" 배정 횟수를
// 함께 보여준다. 숫자는 저장된 DB 기준이라 아직 저장하지 않은 화면상의 변경은 반영되지 않는다.
function MemberSelect({ value, onChange, members, unlinkedName, counts }) {
  function optionLabel(m) {
    const genderTag = m.gender ? GENDER_LABELS[m.gender] : null;
    const c = counts?.[m.id];
    if (!c) return genderTag ? `${m.name} (${genderTag})` : m.name;
    const genderPrefix = genderTag ? `${genderTag} · ` : "";
    return `${m.name} (${genderPrefix}이번 달 ${c.month_count}회 · 올해 ${c.year_count}회)`;
  }
  return (
    <>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">(미배정)</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {optionLabel(m)}
          </option>
        ))}
      </select>
      {/* 인명부에 없는 인물(name_snapshot만 저장됨)은 드롭다운에 선택지가 없어 미리 채우지 못하므로,
          누가 배정돼 있었는지만 텍스트로 알려준다. */}
      {unlinkedName && (
        <span style={{ color: "#666" }}> (현재: {unlinkedName} — 인명부 미등록)</span>
      )}
    </>
  );
}

function MultiMemberSelect({ values, onChange, members }) {
  function handleChange(e) {
    const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
    onChange(selected);
  }
  return (
    <select multiple value={values} onChange={handleChange} size={Math.min(members.length, 6) || 1}>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

// 인명부에 없는 인물은 다중 선택 목록에 넣을 수 없어, 저장 시 자동으로 유지되긴 하지만
// 화면에서는 이름만 참고용으로 보여준다.
function UnlinkedList({ label, people }) {
  if (people.length === 0) return null;
  return (
    <p style={{ color: "#666" }}>
      {label} (인명부 미등록, 저장 시 유지됨): {people.join(", ")}
    </p>
  );
}

function ScheduleEdit() {
  const { scheduleId, weekId } = useParams();
  const [searchParams] = useSearchParams();
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  // 저장 실패(예: 비밀번호 오류로 인한 401)는 loadError와 분리한다.
  // loadError는 화면 전체를 에러 메시지로 대체하는 용도라, 저장 실패에 재사용하면
  // 입력 중이던 폼 전체가 사라져 무엇이 실패했는지 알기 어려워진다.
  const [formError, setFormError] = useState(null);
  const [message, setMessage] = useState(null);

  const [weekLabel, setWeekLabel] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [remark, setRemark] = useState("");
  const [absenceNote, setAbsenceNote] = useState("");
  const [specialTitle, setSpecialTitle] = useState("");
  const [specialDate, setSpecialDate] = useState("");
  const [specialMemo, setSpecialMemo] = useState("");

  const [instrumentMembers, setInstrumentMembers] = useState([]);
  const [singerMembers, setSingerMembers] = useState([]);
  // 콰이어는 싱어팀 전용 포지션이 아니라, 그 주에 악기 담당이 없는 악기팀원도 설 수 있다.
  // 그래서 콰이어 드롭다운만 두 팀을 합친 목록을 쓴다 (다른 마이크/포지션은 팀별 유지).
  const [choirEligibleMembers, setChoirEligibleMembers] = useState([]);

  // 배정 폼 상태. GET /schedules 응답의 각 슬롯은 {member_id, name} 객체로 오므로,
  // member_id가 있으면 드롭다운을 그 값으로 미리 채우고(singleAssignments/choirIds/singerScoreIds),
  // member_id가 없는(인명부 밖 인물) 경우는 이름만 별도로 기억해 힌트 텍스트로 보여준다(unlinkedNames).
  const [singleAssignments, setSingleAssignments] = useState({});
  const [unlinkedNames, setUnlinkedNames] = useState({});
  const [choirIds, setChoirIds] = useState([]);
  const [singerScoreIds, setSingerScoreIds] = useState([]);
  const [unlinkedChoir, setUnlinkedChoir] = useState([]);
  const [unlinkedSingerScore, setUnlinkedSingerScore] = useState([]);

  // 마이크 1~8 배정 횟수(Phase 11-A). member_id -> {month_count, year_count} 맵으로 들고 있다가
  // MemberSelect에 넘긴다. 조회 실패는 흡수하고 조용히 숫자만 안 보이게 한다 —
  // 배정 편집 자체는 이 집계 없이도 동작해야 한다(Phase 3 Home.jsx와 같은 원칙).
  const [micCounts, setMicCounts] = useState({});

  // 싱어팀 마이크/콰이어 자동 배정 제안(Phase 12). null이면 "아직 안 불러왔거나 조회 실패" —
  // 두 경우 모두 추천 버튼을 비활성화하는 것으로 동일하게 처리한다(배정 편집 자체는 영향 없음).
  const [suggestions, setSuggestions] = useState(null);
  // "추천으로 채우기" 누르기 직전 상태 스냅샷. 저장 전까지는 언제든 이 값으로 되돌릴 수 있다.
  const [preSuggestionSnapshot, setPreSuggestionSnapshot] = useState(null);

  const loadMicCounts = useCallback(() => {
    fetchAssignmentCounts(year, month)
      .then((res) => {
        const map = {};
        res.counts.forEach((c) => {
          map[c.member_id] = c;
        });
        setMicCounts(map);
      })
      .catch(() => {
        // 실패해도 배정 편집 폼은 그대로 동작해야 하므로 조용히 무시한다.
      });
  }, [year, month]);

  const loadSuggestions = useCallback(() => {
    fetchWeekSuggestions(scheduleId, weekId)
      .then(setSuggestions)
      .catch(() => setSuggestions(null));
  }, [scheduleId, weekId]);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    loadMicCounts();
    loadSuggestions();
    Promise.all([
      fetchSchedule(year, month),
      fetchMembers("instrument", true),
      fetchMembers("singer", true),
    ])
      .then(([schedule, instMembers, singMembers]) => {
        const week = schedule.weeks.find((w) => String(w.id) === String(weekId));
        if (!week) {
          setLoadError("주차를 찾을 수 없습니다.");
          return;
        }
        setWeekLabel(week.week_label);
        setServiceDate(week.service_date || "");
        setRemark(week.remark || "");
        setAbsenceNote(week.absence_note || "");
        setSpecialTitle(week.special?.title || "");
        setSpecialDate(week.special?.date || "");
        setSpecialMemo(week.special?.memo || "");
        setInstrumentMembers(instMembers);
        setSingerMembers(singMembers);
        setChoirEligibleMembers(
          [...singMembers, ...instMembers].sort((a, b) => a.name.localeCompare(b.name))
        );

        const singles = {};
        const unlinked = {};
        function readSingle(key, person) {
          if (!person) return;
          if (person.member_id != null) {
            singles[key] = String(person.member_id);
          } else {
            unlinked[key] = person.name;
          }
        }
        INSTRUMENT_POSITIONS.forEach(({ code, field }) => readSingle(code, week.instrument[field]));
        MIC_POSITIONS.forEach(({ code, slot }) => readSingle(code, week.singer.mic[slot]));
        readSingle("singer_caption", week.singer.caption);
        setSingleAssignments(singles);
        setUnlinkedNames(unlinked);

        setChoirIds(
          week.singer.choir.filter((p) => p.member_id != null).map((p) => String(p.member_id))
        );
        setUnlinkedChoir(week.singer.choir.filter((p) => p.member_id == null).map((p) => p.name));
        setSingerScoreIds(
          week.singer.score.filter((p) => p.member_id != null).map((p) => String(p.member_id))
        );
        setUnlinkedSingerScore(
          week.singer.score.filter((p) => p.member_id == null).map((p) => p.name)
        );
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [year, month, weekId, loadMicCounts, loadSuggestions]);

  function setSingleValue(code, value) {
    setSingleAssignments((prev) => ({ ...prev, [code]: value }));
  }

  // 추천은 빈 마이크 슬롯과 콰이어만 채운다 — 백엔드는 조회 시점의 DB 저장값을 기준으로
  // 빈 슬롯을 판단하므로, 화면에서 방금 수동 선택했지만 아직 저장하지 않은 슬롯은 서버 입장에서
  // 여전히 "비어 있다"고 보고 추천값을 내려줄 수 있다. 그래서 여기서도 현재 화면 값이 실제로
  // 비어 있는 슬롯에만 추천을 대입해, 저장 전 수동 선택을 덮어쓰지 않게 한다
  // (전체_구현_점검_보고서.md 2-1절).
  function handleApplySuggestions() {
    if (!suggestions || !suggestions.has_availability) return;
    setPreSuggestionSnapshot({
      singleAssignments: { ...singleAssignments },
      choirIds: [...choirIds],
    });
    setSingleAssignments((prev) => {
      const next = { ...prev };
      suggestions.mic.forEach((m) => {
        const key = `mic${m.slot}`;
        if (!next[key]) {
          next[key] = String(m.member_id);
        }
      });
      return next;
    });
    setChoirIds((prev) => {
      const existing = new Set(prev);
      const added = suggestions.choir
        .map((c) => String(c.member_id))
        .filter((id) => !existing.has(id));
      return [...prev, ...added];
    });
    setFormError(null);
    setMessage(null);
  }

  function handleUndoSuggestions() {
    if (!preSuggestionSnapshot) return;
    setSingleAssignments(preSuggestionSnapshot.singleAssignments);
    setChoirIds(preSuggestionSnapshot.choirIds);
    setPreSuggestionSnapshot(null);
  }

  async function handleSaveMeta(e) {
    e.preventDefault();
    setFormError(null);
    setMessage(null);
    try {
      await updateWeek(scheduleId, weekId, {
        week_label: weekLabel,
        service_date: serviceDate || null,
        remark: remark || null,
        absence_note: absenceNote || null,
        special_title: specialTitle || null,
        special_date: specialDate || null,
        special_memo: specialMemo || null,
      });
      setMessage("주차 정보가 저장되었습니다.");
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function handleSaveAssignments(e) {
    e.preventDefault();
    setFormError(null);
    setMessage(null);

    const assignments = [];
    // 드롭다운에서 새로 고른 값이 있으면 그걸 쓰고, 없는데 인명부 밖 인물이 배정돼 있었다면
    // (unlinkedNames) 화면에서 재선택할 방법이 없으니 그 이름을 그대로 name_snapshot으로 넘겨
    // 저장할 때 조용히 사라지지 않게 한다.
    for (const { code } of [...INSTRUMENT_POSITIONS, ...MIC_POSITIONS, { code: "singer_caption" }]) {
      if (singleAssignments[code]) {
        assignments.push({ position_code: code, member_id: Number(singleAssignments[code]) });
      } else if (unlinkedNames[code]) {
        assignments.push({ position_code: code, name_snapshot: unlinkedNames[code] });
      }
    }
    choirIds.forEach((id, index) => {
      assignments.push({ position_code: "choir", member_id: Number(id), slot_order: index + 1 });
    });
    // 콰이어의 인명부 밖 인물도 마찬가지로 재선택 UI가 없으니 그대로 이어붙여 보존한다.
    unlinkedChoir.forEach((name, index) => {
      assignments.push({
        position_code: "choir",
        name_snapshot: name,
        slot_order: choirIds.length + index + 1,
      });
    });
    singerScoreIds.forEach((id, index) => {
      assignments.push({
        position_code: "singer_score",
        member_id: Number(id),
        slot_order: index + 1,
      });
    });
    unlinkedSingerScore.forEach((name, index) => {
      assignments.push({
        position_code: "singer_score",
        name_snapshot: name,
        slot_order: singerScoreIds.length + index + 1,
      });
    });

    try {
      await putAssignments(scheduleId, weekId, { assignments });
      setMessage("배정이 저장되었습니다.");
      // 방금 저장한 배정이 숫자·추천에 반영되지 않으면 연달아 편집할 때 옛 값을 보게 되므로 재조회한다.
      loadMicCounts();
      loadSuggestions();
      // 저장된 이후의 "이전 상태"는 더 이상 의미가 없으므로 되돌리기 스냅샷을 비운다.
      setPreSuggestionSnapshot(null);
    } catch (err) {
      setFormError(err.message);
    }
  }

  if (loading) return <p>불러오는 중...</p>;
  if (loadError) return (
    <div>
      <Link to="/schedules">← 스케줄로</Link>
      <p style={{ color: "red" }}>{loadError}</p>
    </div>
  );

  return (
    <div>
      <Link to="/schedules">← 스케줄로</Link>
      <h1>주차 편집: {weekLabel}</h1>


      {formError && <p style={{ color: "red" }}>{formError}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      <form onSubmit={handleSaveMeta}>
        <h2>주차 정보</h2>
        <div>
          <label>
            라벨{" "}
            <input value={weekLabel} onChange={(e) => setWeekLabel(e.target.value)} required />
          </label>
        </div>
        <div>
          <label>
            날짜{" "}
            <input
              type="date"
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
            />
          </label>
        </div>
        <div>
          <label>
            비고(수련회주간 등){" "}
            <input value={remark} onChange={(e) => setRemark(e.target.value)} />
          </label>
        </div>
        <div>
          <label>
            불참사항{" "}
            <input value={absenceNote} onChange={(e) => setAbsenceNote(e.target.value)} />
          </label>
        </div>
        <fieldset>
          <legend>특순</legend>
          <div>
            <label>
              제목{" "}
              <input value={specialTitle} onChange={(e) => setSpecialTitle(e.target.value)} />
            </label>
          </div>
          <div>
            <label>
              날짜{" "}
              <input
                type="date"
                value={specialDate}
                onChange={(e) => setSpecialDate(e.target.value)}
              />
            </label>
          </div>
          <div>
            <label>
              메모{" "}
              <input value={specialMemo} onChange={(e) => setSpecialMemo(e.target.value)} />
            </label>
          </div>
        </fieldset>
        <button type="submit">주차 정보 저장</button>
      </form>

      <form onSubmit={handleSaveAssignments}>
        <h2>배정</h2>
        <p style={{ color: "#666" }}>
          기존 배정은 인명부에 등록된 사람이면 자동으로 채워집니다. 저장하면 이번 주
          배정 전체가 화면에 입력된 내용으로 교체됩니다.
        </p>

        <h3>악기팀</h3>
        {INSTRUMENT_POSITIONS.map(({ code, label }) => (
          <div key={code}>
            <label>
              {label}{" "}
              <MemberSelect
                value={singleAssignments[code] || ""}
                onChange={(v) => setSingleValue(code, v)}
                members={instrumentMembers}
                unlinkedName={unlinkedNames[code]}
              />
            </label>
          </div>
        ))}

        <h3>싱어팀</h3>
        <p style={{ color: "#666" }}>
          마이크 옆 괄호는 마이크 배정 횟수입니다(이번 달 · 올해 누적, 콰이어·악보 등은 세지 않습니다).
        </p>

        <div style={{ margin: "8px 0", padding: "8px", border: "1px solid #ddd" }}>
          {suggestions && suggestions.has_availability ? (
            <>
              <button type="button" onClick={handleApplySuggestions}>
                추천으로 채우기
              </button>{" "}
              {preSuggestionSnapshot && (
                <button type="button" onClick={handleUndoSuggestions}>
                  되돌리기
                </button>
              )}
              <p style={{ color: "#666", margin: "4px 0 0" }}>
                참석 가능 {suggestions.mic.length + suggestions.choir.length}명 · 미제출/불명확{" "}
                {suggestions.skipped.unknown.length}명 · 불참 {suggestions.skipped.unavailable.length}명
                {" · "}빈 마이크 슬롯과 콰이어만 채우며, 이미 배정된 자리는 바뀌지 않습니다.
              </p>
            </>
          ) : (
            <p style={{ color: "#666", margin: 0 }}>
              추천으로 채우기는 이 달 참/불참 데이터가 있어야 사용할 수 있습니다.{" "}
              <Link to="/schedules/availability">참/불참 검토 화면으로 이동</Link>
            </p>
          )}
        </div>

        {MIC_POSITIONS.map(({ code, label }) => (
          <div key={code}>
            <label>
              {label}{" "}
              <MemberSelect
                value={singleAssignments[code] || ""}
                onChange={(v) => setSingleValue(code, v)}
                members={singerMembers}
                unlinkedName={unlinkedNames[code]}
                counts={micCounts}
              />
            </label>
          </div>
        ))}
        <div>
          <label>
            자막{" "}
            <MemberSelect
              value={singleAssignments.singer_caption || ""}
              onChange={(v) => setSingleValue("singer_caption", v)}
              members={singerMembers}
              unlinkedName={unlinkedNames.singer_caption}
            />
          </label>
        </div>
        <div>
          <label>
            콰이어 (싱어·악기 모두 가능, Ctrl/Cmd + 클릭으로 다중 선택){" "}
          </label>
          <br />
          <MultiMemberSelect
            values={choirIds}
            onChange={setChoirIds}
            members={choirEligibleMembers}
          />
          <UnlinkedList label="콰이어" people={unlinkedChoir} />
        </div>
        <div>
          <label>악보(보통 2명, 다중 선택)</label>
          <br />
          <MultiMemberSelect
            values={singerScoreIds}
            onChange={setSingerScoreIds}
            members={singerMembers}
          />
          <UnlinkedList label="악보" people={unlinkedSingerScore} />
        </div>

        <button type="submit">배정 저장</button>
      </form>
    </div>
  );
}

export default ScheduleEdit;
