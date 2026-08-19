// 악기팀 포지션(Key1/Key2/드럼/베이스/일렉/싱도·자막/악보)을 마이크 슬롯과 톤을 맞춘
// 카드 그리드로 보여준다. README 빈 값 숨김 원칙대로, 배정 없는 포지션은 카드 자체를 만들지 않는다
// (마이크 슬롯과 달리 악기팀은 고정된 무대 좌표가 없어 빈 칸을 유지할 이유가 없다).
const INSTRUMENT_LABELS = {
  key1: "Key1",
  key2: "Key2",
  drum: "드럼",
  bass: "베이스",
  electric: "일렉",
  singer_helper: "싱도/자막",
  score: "악보",
};

function InstrumentPositionGrid({ instrument }) {
  const entries = Object.entries(instrument).filter(([, person]) => person);
  if (entries.length === 0) return null;

  return (
    <div
      className="instrument-grid"
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))", gap: "0.25rem" }}
    >
      {entries.map(([code, person]) => (
        <div
          key={code}
          className="instrument-slot"
          style={{ border: "1px solid #ccc", padding: "0.25rem", textAlign: "center" }}
        >
          <div className="instrument-slot__label" style={{ fontSize: "0.75rem", color: "#666" }}>
            {INSTRUMENT_LABELS[code]}
          </div>
          <div className="instrument-slot__name">{person.name}</div>
        </div>
      ))}
    </div>
  );
}

export default InstrumentPositionGrid;
