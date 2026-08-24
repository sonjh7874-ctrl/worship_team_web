import { Component } from "react";
import { Link } from "react-router-dom";

// 렌더링 중 예기치 못한 JS 오류가 나면 흰 화면 대신 안내 화면을 보여준다.
// React 오류 경계(error boundary)는 클래스 컴포넌트로만 구현할 수 있다(훅으로 대체 불가).
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem" }}>
          <h1>문제가 발생했습니다</h1>
          <p>페이지를 표시하는 중 오류가 발생했습니다. 새로고침하거나 메인으로 돌아가주세요.</p>
          <Link to="/">← 메인으로</Link>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
