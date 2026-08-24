import { Link } from "react-router-dom";

// 상세·작성·편집 같은 2차 화면에서 현재 맥락과 안전한 상위 경로를 함께 보여준다.
function TopBar({ title, backTo, backLabel = "이전 화면" }) {
  return (
    <div className="app-topbar" aria-label="현재 화면">
      {backTo && (
        <Link className="app-topbar__back" to={backTo} aria-label={`${backLabel}으로 돌아가기`}>
          <span aria-hidden="true">←</span>
          <span>{backLabel}</span>
        </Link>
      )}
      <span className="app-topbar__title">{title}</span>
    </div>
  );
}

export default TopBar;
