// 싱어팀 무대 마이크 배치도. 좌표(앞줄 4·3·[목사님 자리]·2·1, 뒷줄 8·7·[여백]·6·5)는
// 무대 구조 자체가 고정이라 프론트 상수로 하드코딩하고, 매주 바뀌는 배정 데이터만 채워 넣는다.
// (docs/ERD.md "마이크 무대 좌표" 절 참고)
const FRONT_ROW = [4, 3, null, 2, 1];
const BACK_ROW = [8, 7, null, 6, 5];

function MicSlot({ slot, mic }) {
  if (slot === null) {
    // 목사님 자리(앞줄 가운데) — 라벨 없이 빈 칸만 유지
    return <div className="mic-slot mic-slot--empty" />;
  }
  const person = mic[String(slot)];
  return (
    <div className="mic-slot" style={{ border: "1px solid #ccc", padding: "0.25rem", textAlign: "center" }}>
      <div className="mic-slot__number">{slot}</div>
      {/* 배정된 이름이 없어도 칸 자체는 유지한다 — 무대 구조가 매주 동일하게 보여야 알아보기 쉽다 */}
      <div className="mic-slot__name">{person ? person.name : ""}</div>
    </div>
  );
}

function MicStageLayout({ mic, choir }) {
  return (
    <div className="mic-stage">
      <p style={{ textAlign: "center", margin: "0.25rem 0" }}>회중석</p>
      <div className="mic-stage__row" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.25rem" }}>
        {FRONT_ROW.map((slot, i) => (
          <MicSlot key={`front-${i}`} slot={slot} mic={mic} />
        ))}
      </div>
      <div className="mic-stage__row" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.25rem", marginTop: "0.25rem" }}>
        {BACK_ROW.map((slot, i) => (
          <MicSlot key={`back-${i}`} slot={slot} mic={mic} />
        ))}
      </div>
      {choir.length > 0 && (
        <div
          className="mic-stage__choir"
          style={{ border: "1px solid #ccc", padding: "0.25rem", marginTop: "0.25rem" }}
        >
          <div style={{ fontSize: "0.75rem", color: "#666", textAlign: "center" }}>콰이어</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", justifyContent: "center" }}>
            {choir.map((p) => (
              <span
                key={p.member_id ?? p.name}
                className="mic-stage__choir-pill"
                style={{ border: "1px solid #ccc", borderRadius: "999px", padding: "0.1rem 0.5rem" }}
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MicStageLayout;
