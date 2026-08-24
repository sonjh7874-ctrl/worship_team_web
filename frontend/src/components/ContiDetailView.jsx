import { Link } from "react-router-dom";
import Badge from "./Badge";
import Button from "./Button";
import Card from "./Card";
import EmptyState from "./EmptyState";

// 콘티 메인/상세 화면에서 공용으로 쓰는 콘티 표시 컴포넌트.
function ContiDetailView({ conti }) {
  return (
    <Card className="conti-detail-card">
      <header className="detail-heading">
        <div>
          <div className="detail-heading__meta">
            <Badge tone={conti.status === "draft" ? "warm" : "success"}>
              {conti.status === "draft" ? "검수 필요" : "게시됨"}
            </Badge>
            <span>{conti.service_date}</span>
          </div>
          <h1>{conti.title}</h1>
        </div>
        {conti.songs.length > 0 && (
          <Button as={Link} to={`/conti/${conti.id}/lyrics`} variant="secondary">
            자막용 가사 보기
          </Button>
        )}
      </header>

      {conti.songs.length === 0 ? (
        <EmptyState title="등록된 곡이 없습니다" titleAs="h2" />
      ) : (
        <ol className="conti-song-list">
          {conti.songs.map((item) => (
            <li key={item.order_no}>
              <span className="conti-song-list__number">{item.order_no}</span>
              <div>
                <div className="conti-song-list__title-row">
                  <strong>{item.song.title}</strong>
                  {item.song_key && <Badge tone="primary">{item.song_key}</Badge>}
                </div>
                {item.song.artist && <p className="conti-song-list__artist">{item.song.artist}</p>}
                {item.song_form && <p className="conti-song-list__form">{item.song_form}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}

      {conti.sheet_files.length > 0 && (
        <section className="detail-subsection">
          <h2>악보</h2>
          <ul className="file-list">
            {conti.sheet_files.map((file) => (
              <li key={file.id}>
                <a href={file.url} target="_blank" rel="noreferrer">
                  <span>{file.file_name || file.file_type}</span>
                  <span aria-hidden="true">새 창에서 열기</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  );
}

export default ContiDetailView;
