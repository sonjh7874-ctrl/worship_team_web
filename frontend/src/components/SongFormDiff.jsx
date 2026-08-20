// 이번에 인식한 송폼과 지난번 콘티의 송폼을 나란히 놓고 달라진 부분만 표시한다.
// AI가 (8)을 빠뜨리거나 "호흡있는"을 "흐름있는"으로 잘못 읽는 오류는 눈으로 훑어서는 잘 안 보이는데,
// 대부분의 주는 지난주와 송폼이 같아서 "달라진 토큰"만 짚어주면 바로 눈에 띈다.
//
// 주의: 송폼은 매주 바뀔 수 있으므로 이 비교는 어디까지나 참고용이다. 다르다고 틀린 게 아니라,
// "여기 확인해보라"는 표시일 뿐이며 되돌릴지는 사람이 정한다.

// 공백 단위 토큰의 최장 공통 부분수열(LCS). 토큰이 몇십 개뿐이라 단순 DP로 충분하다.
function lcsTable(a, b) {
  const table = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
}

// 두 문장을 토큰 단위로 비교해 각 토큰이 공통인지(changed=false) 아닌지 표시한 배열을 돌려준다.
function diffTokens(previous, current) {
  const a = previous.split(/\s+/).filter(Boolean);
  const b = current.split(/\s+/).filter(Boolean);
  const table = lcsTable(a, b);

  const prevMarks = [];
  const currMarks = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      prevMarks.push({ text: a[i], changed: false });
      currMarks.push({ text: b[j], changed: false });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      prevMarks.push({ text: a[i], changed: true });
      i++;
    } else {
      currMarks.push({ text: b[j], changed: true });
      j++;
    }
  }
  while (i < a.length) prevMarks.push({ text: a[i++], changed: true });
  while (j < b.length) currMarks.push({ text: b[j++], changed: true });

  return { prevMarks, currMarks };
}

function Tokens({ marks, color }) {
  return (
    <span>
      {marks.map((mark, index) => (
        <span
          key={index}
          style={mark.changed ? { background: color, fontWeight: "bold" } : undefined}
        >
          {mark.text}{" "}
        </span>
      ))}
    </span>
  );
}

function SongFormDiff({ previous, current, onUsePrevious }) {
  if (!previous || !current || previous.trim() === current.trim()) return null;

  const { prevMarks, currMarks } = diffTokens(previous, current);

  return (
    <div style={{ fontSize: 12, border: "1px solid #e0c080", padding: 6, margin: "4px 0" }}>
      <div style={{ color: "#a06000" }}>지난번 콘티와 송폼이 다릅니다 — 잘못 읽은 것인지 확인해주세요.</div>
      <div>
        지난번: <Tokens marks={prevMarks} color="#ffe0a0" />
      </div>
      <div>
        이번: <Tokens marks={currMarks} color="#ffd0d0" />
      </div>
      <button type="button" onClick={onUsePrevious}>
        지난번 송폼으로 되돌리기
      </button>
    </div>
  );
}

export default SongFormDiff;
