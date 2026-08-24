import { Component } from "react";
import { Link } from "react-router-dom";
import Button from "./Button";
import EmptyState from "./EmptyState";
import PageContainer from "./PageContainer";

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

  // 오류 화면에서 메인으로 이동할 때 경계 상태도 함께 초기화해야 fallback 화면에 계속 머물지 않는다.
  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <PageContainer className="error-boundary-page">
          <EmptyState
            title="문제가 발생했습니다"
            description="페이지를 표시하는 중 오류가 발생했습니다. 다시 시도하거나 메인으로 돌아가주세요."
            action={
              <div className="inline-actions">
                <Button variant="secondary" onClick={() => window.location.reload()}>다시 시도</Button>
                <Button as={Link} to="/" onClick={this.handleReset}>메인으로</Button>
              </div>
            }
          />
        </PageContainer>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
