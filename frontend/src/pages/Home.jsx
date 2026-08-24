import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MicStageLayout from "../components/MicStageLayout";
import InstrumentPositionGrid from "../components/InstrumentPositionGrid";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Card from "../components/Card";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import { fetchLatestConti } from "../api/contis";
import { fetchNoticeList } from "../api/notices";
import { fetchSchedule } from "../api/schedules";
import { useAuth } from "../contexts/AuthContext";

// 이번 주 콘티 / 이번 달 스케줄 / 공지를 한 화면에서 요약해서 보여주는 사이트 루트 대시보드.
// 세 섹션은 서로 무관한 데이터라, 하나가 없거나 실패해도 나머지는 정상 표시돼야 한다
// (콘티는 있는데 이번 달 스케줄이 아직 없는 경우 등이 실제로 흔하다).
function Home() {
  const { user } = useAuth();
  const [conti, setConti] = useState(null);
  const [contiLoading, setContiLoading] = useState(true);
  const [contiError, setContiError] = useState(false);

  const [weeks, setWeeks] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState(false);

  const [notices, setNotices] = useState([]);
  const [noticesLoading, setNoticesLoading] = useState(true);
  const [noticesError, setNoticesError] = useState(false);

  useEffect(() => {
    fetchLatestConti()
      .then(setConti)
      .catch(() => setContiError(true))
      .finally(() => setContiLoading(false));

    const now = new Date();
    fetchSchedule(now.getFullYear(), now.getMonth() + 1)
      .then((schedule) => {
        // 오늘 이후(날짜 미정 주차 제외) 가장 가까운 주차 1개만 요약으로 보여준다.
        const today = now.toISOString().slice(0, 10);
        const upcoming = schedule.weeks
          .filter((w) => w.service_date && w.service_date >= today)
          .sort((a, b) => a.service_date.localeCompare(b.service_date));
        setWeeks(upcoming.length > 0 ? upcoming.slice(0, 1) : schedule.weeks.slice(0, 1));
      })
      .catch(() => setScheduleError(true))
      .finally(() => setScheduleLoading(false));

    // 목록은 이미 고정글 우선으로 정렬돼서 오므로 앞에서 3개만 잘라 쓴다.
    fetchNoticeList()
      .then((list) => setNotices(list.slice(0, 3)))
      .catch(() => setNoticesError(true))
      .finally(() => setNoticesLoading(false));
  }, []);

  return (
    <PageContainer className="home-page">
      <header className="home-page__intro">
        <div>
          <p className="home-page__eyebrow">EVERYDAY WORSHIP</p>
          <h1>청년부 주일찬양팀</h1>
          <p>이번 주 콘티와 섬김 일정, 중요한 공지를 한곳에서 확인하세요.</p>
        </div>
        {user && (
          <Button as={Link} to="/members" variant="secondary">
            인명부 보기
          </Button>
        )}
      </header>

      <section className="home-section" aria-labelledby="home-conti-title">
        <div className="home-section__header">
          <h2 id="home-conti-title">이번 주 콘티</h2>
          <Button as={Link} to="/conti" variant="secondary">
            전체 보기
          </Button>
        </div>
        <Card as="div" className="home-section__card">
          {contiLoading && <p className="home-status">콘티를 불러오는 중...</p>}
          {!contiLoading && contiError && (
            <EmptyState
              title="등록된 콘티가 없습니다"
              titleAs="h3"
              description="새 콘티가 게시되면 이곳에서 바로 확인할 수 있어요."
            />
          )}
        {!contiLoading && !contiError && conti && (
          <div className="home-conti">
            <div className="home-conti__meta">
              <Badge tone="success">게시됨</Badge>
              <span>{conti.service_date}</span>
            </div>
            <h3>{conti.title}</h3>
            {conti.songs.length === 0 ? (
              <p className="home-status">등록된 곡이 없습니다.</p>
            ) : (
              <ol className="home-song-list">
                {conti.songs.map((item) => (
                  <li key={item.order_no}>
                    <span className="home-song-list__number">{item.order_no}</span>
                    <div>
                      <strong>{item.song.title}</strong>
                      <p>
                        {item.song.artist} · {item.song_key}
                      </p>
                      <p className="home-song-list__form">{item.song_form}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
        </Card>
      </section>

      <section className="home-section" aria-labelledby="home-schedule-title">
        <div className="home-section__header">
          <h2 id="home-schedule-title">이번 달 스케줄</h2>
          <Button as={Link} to="/schedules" variant="secondary">
            전체 보기
          </Button>
        </div>
        <Card as="div" className="home-section__card">
          {scheduleLoading && <p className="home-status">스케줄을 불러오는 중...</p>}
          {!scheduleLoading && scheduleError && (
            <EmptyState
              title="등록된 스케줄이 없습니다"
              titleAs="h3"
              description="월간 스케줄이 등록되면 가장 가까운 주차를 보여드려요."
            />
          )}
        {!scheduleLoading && !scheduleError && weeks.length === 0 && (
            <EmptyState
              title="등록된 주차가 없습니다"
              titleAs="h3"
              description="이 달의 주차가 추가되면 배정 정보를 확인할 수 있어요."
            />
        )}
        {!scheduleLoading &&
          !scheduleError &&
          weeks.map((week) => (
            <div className="home-week" key={week.id}>
              <div className="home-week__meta">
                <Badge tone="primary">{week.week_label}</Badge>
                <span>{week.service_date}</span>
              </div>
              <InstrumentPositionGrid instrument={week.instrument} />
              <MicStageLayout mic={week.singer.mic} choir={week.singer.choir} />
              {week.absence_note && (
                <p className="home-week__absence">
                  <strong>불참</strong> {week.absence_note}
                </p>
              )}
            </div>
          ))}
        </Card>
      </section>

      <section className="home-section" aria-labelledby="home-notices-title">
        <div className="home-section__header">
          <h2 id="home-notices-title">공지사항</h2>
          <Button as={Link} to="/notices" variant="secondary">
            전체 보기
          </Button>
        </div>
        <Card as="div" className="home-section__card">
          {noticesLoading && <p className="home-status">공지사항을 불러오는 중...</p>}
          {!noticesLoading && noticesError && (
            <EmptyState
              title="공지사항을 불러오지 못했습니다"
              titleAs="h3"
              description="잠시 후 공지사항 화면에서 다시 확인해주세요."
            />
          )}
        {!noticesLoading && !noticesError && notices.length === 0 && (
            <EmptyState
              title="등록된 공지사항이 없습니다"
              titleAs="h3"
              description="새 공지가 등록되면 이곳에 표시됩니다."
            />
        )}
        {!noticesLoading && !noticesError && notices.length > 0 && (
          <ul className="home-notice-list">
            {notices.map((notice) => (
              <li key={notice.id}>
                <Link to={`/notices/${notice.id}`}>
                    <span>{notice.title}</span>
                    {notice.is_pinned && <Badge tone="warm">고정</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        </Card>
      </section>
    </PageContainer>
  );
}

export default Home;
