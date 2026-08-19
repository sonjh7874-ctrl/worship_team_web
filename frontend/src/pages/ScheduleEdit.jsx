import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { fetchMembers } from "../api/members";
import { fetchSchedule, putAssignments, updateWeek } from "../api/schedules";

const INSTRUMENT_POSITIONS = [
  { code: "key1", label: "Key1" },
  { code: "key2", label: "Key2" },
  { code: "drum", label: "드럼" },
  { code: "bass", label: "베이스" },
  { code: "electric", label: "일렉" },
  { code: "singer_helper", label: "싱도/자막" },
  { code: "inst_score", label: "악보" },
];

const MIC_POSITIONS = Array.from({ length: 8 }, (_, i) => ({
  code: `mic${i + 1}`,
  label: `마이크 ${i + 1}`,
}));

function MemberSelect({ value, onChange, members }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">(미배정)</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
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

function ScheduleEdit() {
  const { scheduleId, weekId } = useParams();
  const [searchParams] = useSearchParams();
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [password, setPassword] = useState("");

  const [weekLabel, setWeekLabel] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [remark, setRemark] = useState("");
  const [absenceNote, setAbsenceNote] = useState("");
  const [specialTitle, setSpecialTitle] = useState("");
  const [specialDate, setSpecialDate] = useState("");
  const [specialMemo, setSpecialMemo] = useState("");

  const [instrumentMembers, setInstrumentMembers] = useState([]);
  const [singerMembers, setSingerMembers] = useState([]);

  // 배정 폼 상태. 조회 응답(GET /schedules)은 이름만 피벗해서 내려주고 member_id를
  // 되돌려주지 않으므로, 기존 배정을 드롭다운에 미리 채워 넣을 수 없다 — 편집 시 매번
  // 이번 주 배정을 새로 입력해서 저장하는 방식(PUT 전체 교체와 동일한 흐름)으로 둔다.
  const [singleAssignments, setSingleAssignments] = useState({});
  const [choirIds, setChoirIds] = useState([]);
  const [singerScoreIds, setSingerScoreIds] = useState([]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchSchedule(year, month),
      fetchMembers("instrument", true),
      fetchMembers("singer", true),
    ])
      .then(([schedule, instMembers, singMembers]) => {
        const week = schedule.weeks.find((w) => String(w.id) === String(weekId));
        if (!week) {
          setError("주차를 찾을 수 없습니다.");
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
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [year, month, weekId]);

  function setSingleValue(code, value) {
    setSingleAssignments((prev) => ({ ...prev, [code]: value }));
  }

  async function handleSaveMeta(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await updateWeek(
        scheduleId,
        weekId,
        {
          week_label: weekLabel,
          service_date: serviceDate || null,
          remark: remark || null,
          absence_note: absenceNote || null,
          special_title: specialTitle || null,
          special_date: specialDate || null,
          special_memo: specialMemo || null,
        },
        password
      );
      setMessage("주차 정보가 저장되었습니다.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveAssignments(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const assignments = [];
    for (const { code } of [...INSTRUMENT_POSITIONS, ...MIC_POSITIONS]) {
      if (singleAssignments[code]) {
        assignments.push({ position_code: code, member_id: Number(singleAssignments[code]) });
      }
    }
    if (singleAssignments.singer_caption) {
      assignments.push({
        position_code: "singer_caption",
        member_id: Number(singleAssignments.singer_caption),
      });
    }
    choirIds.forEach((id, index) => {
      assignments.push({ position_code: "choir", member_id: Number(id), slot_order: index + 1 });
    });
    singerScoreIds.forEach((id, index) => {
      assignments.push({
        position_code: "singer_score",
        member_id: Number(id),
        slot_order: index + 1,
      });
    });

    try {
      await putAssignments(scheduleId, weekId, { assignments }, password);
      setMessage("배정이 저장되었습니다.");
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p>불러오는 중...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div>
      <Link to="/schedules">← 스케줄로</Link>
      <h1>주차 편집: {weekLabel}</h1>

      <div>
        <label>
          편집 비밀번호{" "}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      </div>

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
          기존 배정 내역은 자동으로 채워지지 않습니다 — 이번 주 배정을 새로 선택해 저장하면
          전체를 교체합니다.
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
              />
            </label>
          </div>
        ))}

        <h3>싱어팀</h3>
        {MIC_POSITIONS.map(({ code, label }) => (
          <div key={code}>
            <label>
              {label}{" "}
              <MemberSelect
                value={singleAssignments[code] || ""}
                onChange={(v) => setSingleValue(code, v)}
                members={singerMembers}
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
            />
          </label>
        </div>
        <div>
          <label>
            콰이어 (Ctrl/Cmd + 클릭으로 다중 선택){" "}
          </label>
          <br />
          <MultiMemberSelect values={choirIds} onChange={setChoirIds} members={singerMembers} />
        </div>
        <div>
          <label>악보(보통 2명, 다중 선택)</label>
          <br />
          <MultiMemberSelect
            values={singerScoreIds}
            onChange={setSingerScoreIds}
            members={singerMembers}
          />
        </div>

        <button type="submit">배정 저장</button>
      </form>
    </div>
  );
}

export default ScheduleEdit;
