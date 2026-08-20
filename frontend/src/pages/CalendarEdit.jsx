import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvent,
  updateCalendarEvent,
} from "../api/calendar";
import { fetchMembers } from "../api/members";

const CATEGORY_OPTIONS = ["수련회", "엠티", "특순", "기타"];

// 백엔드 PRESET_COLORS(backend/app/schemas/calendar.py)와 순서·값을 맞춰 둔다.
const PRESET_COLORS = [
  "#fecaca",
  "#fed7aa",
  "#fef08a",
  "#bbf7d0",
  "#99f6e4",
  "#bfdbfe",
  "#ddd6fe",
  "#fbcfe8",
];

function ColorSwatchPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
      <button
        type="button"
        onClick={() => onChange(null)}
        title="기본(카테고리 색)"
        style={{
          width: "1.5rem",
          height: "1.5rem",
          borderRadius: "999px",
          border: value === null ? "2px solid #111" : "1px solid #ccc",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        ⨯
      </button>
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          title={c}
          style={{
            width: "1.5rem",
            height: "1.5rem",
            borderRadius: "999px",
            border: value === c ? "2px solid #111" : "1px solid #ccc",
            background: c,
            cursor: "pointer",
          }}
        />
      ))}
    </div>
  );
}

function MultiMemberSelect({ values, onChange, members }) {
  function handleChange(e) {
    const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
    onChange(selected);
  }
  return (
    <select multiple value={values} onChange={handleChange} size={Math.min(members.length, 8) || 1}>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

function CalendarEdit() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 라우트 파라미터 유무로 작성 화면(/calendar/new)과 편집 화면(/calendar/:id/edit)을 겸용한다.
  const isNew = !eventId;

  const [title, setTitle] = useState("");
  // 캘린더 그리드의 빈 날짜 칸을 클릭해 들어온 경우 ?date=YYYY-MM-DD로 시작일을
  // 미리 채운다 — 작성 모드에서만 의미가 있고, 편집 모드는 아래 useEffect가
  // 기존 이벤트 값으로 덮어쓴다.
  const [startDate, setStartDate] = useState(() => (isNew ? searchParams.get("date") || "" : ""));
  const [endDate, setEndDate] = useState("");
  const [category, setCategory] = useState("수련회");
  const [categoryCustom, setCategoryCustom] = useState("");
  // null이면 카테고리 기본색을 그대로 쓴다.
  const [color, setColor] = useState(null);
  const [memo, setMemo] = useState("");

  const [members, setMembers] = useState([]);
  // 참여 인원은 인명부 다중 선택(memberIds) + 인명부 밖 인물을 위한 자유 텍스트 목록을 함께 쓴다
  // (Phase 2 콰이어/싱어악보 다중 선택 UI와 동일한 접근, SDD 확정 사항).
  const [memberIds, setMemberIds] = useState([]);
  const [freeTextParticipants, setFreeTextParticipants] = useState([]);
  const [freeTextInput, setFreeTextInput] = useState("");

  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState(null);
  const [isAuto, setIsAuto] = useState(false);
  // 저장 실패는 loadError와 분리한다 — loadError를 재사용하면 화면 전체가 에러로
  // 뒤덮이며 입력 중이던 폼이 사라진다 (ScheduleEdit에서 겪은 문제와 동일한 이유).
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    // 팀 구분 없이 활동 중인 팀원 전체를 보여준다 — 캘린더 이벤트(수련회/엠티 등)는
    // 스케줄 포지션과 달리 특정 팀에 국한되지 않는다.
    fetchMembers(undefined, true)
      .then((list) => setMembers([...list].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setMembers([]));
  }, []);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    setLoadError(null);
    fetchCalendarEvent(eventId)
      .then((event) => {
        if (event.source_type === "auto_from_schedule") {
          // 자동 동기화 이벤트는 여기서 직접 수정할 수 없다 — 폼 대신 안내만 표시한다.
          setIsAuto(true);
          return;
        }
        setTitle(event.title);
        setStartDate(event.start_date);
        setEndDate(event.end_date || "");
        setCategory(event.category);
        setCategoryCustom(event.category_custom || "");
        setColor(event.color || null);
        setMemo(event.memo || "");
        setMemberIds(
          event.participants.filter((p) => p.member_id != null).map((p) => String(p.member_id))
        );
        setFreeTextParticipants(
          event.participants.filter((p) => p.member_id == null).map((p) => p.name)
        );
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [eventId, isNew]);

  function addFreeTextParticipant() {
    const name = freeTextInput.trim();
    if (!name) return;
    setFreeTextParticipants((prev) => [...prev, name]);
    setFreeTextInput("");
  }

  function removeFreeTextParticipant(index) {
    setFreeTextParticipants((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    const participants = [
      ...memberIds.map((id) => ({ member_id: Number(id), name_snapshot: null })),
      ...freeTextParticipants.map((name) => ({ member_id: null, name_snapshot: name })),
    ];
    const payload = {
      title,
      start_date: startDate,
      end_date: endDate || null,
      category,
      category_custom: category === "기타" ? categoryCustom : null,
      color,
      memo: memo || null,
      participants,
    };

    try {
      if (isNew) {
        const created = await createCalendarEvent(payload);
        navigate(`/calendar/${created.id}`);
      } else {
        await updateCalendarEvent(eventId, payload);
        navigate(`/calendar/${eventId}`);
      }
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`"${title}" 이벤트를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setFormError(null);
    try {
      await deleteCalendarEvent(eventId);
      navigate("/calendar");
    } catch (err) {
      setFormError(err.message);
    }
  }

  if (loading) return <p>불러오는 중...</p>;
  if (loadError) {
    return (
      <div>
        <Link to="/calendar">← 캘린더로</Link>
        <p style={{ color: "red" }}>{loadError}</p>
      </div>
    );
  }
  if (isAuto) {
    return (
      <div>
        <Link to={`/calendar/${eventId}`}>← 상세로</Link>
        <p>
          이 이벤트는 공지사항(월간 스케줄)의 특순 정보에서 자동으로 생성돼 여기서 직접 수정할 수
          없습니다. <Link to="/schedules">월간 스케줄</Link>에서 특순 정보를 수정해주세요.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Link to={isNew ? "/calendar" : `/calendar/${eventId}`}>
        {isNew ? "← 캘린더로" : "← 상세로"}
      </Link>

      <h1>{isNew ? "이벤트 작성" : "이벤트 편집"}</h1>

      {formError && <p style={{ color: "red" }}>{formError}</p>}

      <form onSubmit={handleSubmit}>
        <div>
          <label>
            제목 <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
        </div>
        <div>
          <label>
            시작일{" "}
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>
        </div>
        <div>
          <label>
            종료일(선택){" "}
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>
        <div>
          <label>
            카테고리{" "}
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>{" "}
          {category === "기타" && (
            <input
              placeholder="카테고리 직접 입력"
              value={categoryCustom}
              onChange={(e) => setCategoryCustom(e.target.value)}
              required
            />
          )}
        </div>
        <div>
          <label>막대 색상</label>{" "}
          <ColorSwatchPicker value={color} onChange={setColor} />
        </div>
        <div>
          <label>
            메모{" "}
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={4} />
          </label>
        </div>

        <fieldset>
          <legend>참여 인원</legend>
          <p style={{ color: "#666" }}>인명부 목록(Ctrl/Cmd + 클릭으로 다중 선택)</p>
          <MultiMemberSelect values={memberIds} onChange={setMemberIds} members={members} />

          <p style={{ color: "#666" }}>인명부 밖 인물은 이름을 입력해 추가</p>
          <input
            value={freeTextInput}
            onChange={(e) => setFreeTextInput(e.target.value)}
            placeholder="이름"
          />{" "}
          <button type="button" onClick={addFreeTextParticipant}>
            추가
          </button>
          {freeTextParticipants.length > 0 && (
            <ul>
              {freeTextParticipants.map((name, index) => (
                <li key={`${name}-${index}`}>
                  {name}{" "}
                  <button type="button" onClick={() => removeFreeTextParticipant(index)}>
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <button type="submit">{isNew ? "작성" : "저장"}</button>
      </form>

      {!isNew && (
        <button type="button" onClick={handleDelete} style={{ color: "red" }}>
          이벤트 삭제
        </button>
      )}
    </div>
  );
}

export default CalendarEdit;
