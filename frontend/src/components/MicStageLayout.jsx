// 싱어팀 무대 마이크 배치도. 좌표(앞줄 4·3·[목사님 자리]·2·1, 뒷줄 8·7·[여백]·6·5)는
// 무대 구조 자체가 고정이라 프론트 상수로 하드코딩하고, 매주 바뀌는 배정 데이터만 채워 넣는다.
// (docs/ERD.md "마이크 무대 좌표" 절 참고)
const FRONT_ROW = [4, 3, null, 2, 1];
const BACK_ROW = [8, 7, null, 6, 5];

function MicSlot({ slot, mic }) {
  if (slot === null) {
    // 앞줄 가운데 강대상 자리는 배정 슬롯과 구분하되 실제 무대 좌표를 이해할 수 있게 라벨을 남긴다.
    return <div className="mic-slot mic-slot--empty" aria-label="강대상"><span>강대상</span></div>;
  }
  const person = mic[String(slot)];
  return (
    <div className={`mic-slot${person ? " mic-slot--assigned" : ""}`} aria-label={`${slot}번 마이크${person ? ` ${person.name}` : " 미배정"}`}>
      <div className="mic-slot__number">{slot}</div>
      {/* 배정된 이름이 없어도 칸 자체는 유지한다 — 무대 구조가 매주 동일하게 보여야 알아보기 쉽다 */}
      <div className="mic-slot__name">{person ? person.name : ""}</div>
    </div>
  );
}

function MicStageLayout({ mic, choir }) {
  return (
    <section className="stage-group mic-stage" aria-labelledby="singer-stage-title">
      <div className="mic-stage__direction"><span>무대</span><span aria-hidden="true">↑</span><span>회중석</span></div>
      <h3 id="singer-stage-title" className="stage-group__title">싱어팀 마이크 배치</h3>
      <div className="mic-stage__row">
        {FRONT_ROW.map((slot, i) => (
          <MicSlot key={`front-${i}`} slot={slot} mic={mic} />
        ))}
      </div>
      <div className="mic-stage__row">
        {BACK_ROW.map((slot, i) => (
          <MicSlot key={`back-${i}`} slot={slot} mic={mic} />
        ))}
      </div>
      {choir.length > 0 && (
        <div className="mic-stage__choir">
          <div className="mic-stage__choir-label">콰이어</div>
          <div className="mic-stage__choir-list">
            {choir.map((p) => (
              <span key={p.member_id ?? p.name} className="mic-stage__choir-pill">
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default MicStageLayout;
