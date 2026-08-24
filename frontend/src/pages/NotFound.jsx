import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>주소가 잘못되었거나 삭제된 페이지입니다.</p>
      <Link to="/">← 메인으로</Link>
    </div>
  );
}

export default NotFound;
