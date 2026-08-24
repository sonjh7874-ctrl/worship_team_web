import { Link } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";

function NotFound() {
  return (
    <PageContainer className="not-found-page">
      <Card>
        <EmptyState
          title="페이지를 찾을 수 없습니다"
          titleAs="h1"
          description="주소가 잘못되었거나 삭제된 페이지입니다."
          action={
            <Button as={Link} to="/" variant="secondary">
              메인으로 돌아가기
            </Button>
          }
        />
      </Card>
    </PageContainer>
  );
}

export default NotFound;
