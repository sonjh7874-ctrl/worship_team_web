// 조회 화면의 초기 로딩을 같은 높이와 문구로 보여주고 스크린리더에도 상태를 알린다.
function LoadingState({ label = "불러오는 중...", rows = 3, compact = false }) {
  return (
    <div className={`ui-loading-state${compact ? " ui-loading-state--compact" : ""}`} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="ui-loading-state__skeleton" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => <span key={index} />)}
      </div>
      <p aria-hidden="true">{label}</p>
    </div>
  );
}
export default LoadingState;
