import Button from "./Button";
import Card from "./Card";

// 페이지·섹션 조회 실패 시 사용자를 탓하지 않는 설명과 가능한 재시도 행동을 제공한다.
function ErrorState({ title = "정보를 불러오지 못했습니다", description = "잠시 후 다시 시도해주세요.", onRetry, compact = false }) {
  return (
    <Card as="div" variant="list" className={`ui-error-state${compact ? " ui-error-state--compact" : ""}`} role="alert">
      <div><strong>{title}</strong>{description && <p>{description}</p>}</div>
      {onRetry && <Button variant="secondary" onClick={onRetry}>다시 시도</Button>}
    </Card>
  );
}
export default ErrorState;
