import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MicStageLayout from "../components/MicStageLayout";
import InstrumentPositionGrid from "../components/InstrumentPositionGrid";
import { fetchLatestConti } from "../api/contis";
import { fetchNoticeList } from "../api/notices";
import { fetchSchedule } from "../api/schedules";

// 이번 주 콘티 / 이번 달 스케줄 / 공지를 한 화면에서 요약해서 보여주는 사이트 루트 대시보드.
// 세 섹션은 서로 무관한 데이터라, 하나가 없거나 실패해도 나머지는 정상 표시돼야 한다
// (콘티는 있는데 이번 달 스케줄이 아직 없는 경우 등이 실제로 흔하다).
function Home() {
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
    <div>
      <h1>청년부 주일찬양팀</h1>
      <div>
        <Link to="/conti">콘티</Link>{" "}
        <Link to="/schedules">월간 스케줄</Link>{" "}
        <Link to="/notices">공지사항</Link>{" "}
        <Link to="/members">인명부</Link>
      </div>

      <section>
        <h2>이번 주 콘티</h2>
        {contiLoading && <p>불러오는 중...</p>}
        {!contiLoading && contiError && <p>등록된 콘티가 없습니다.</p>}
        {!contiLoading && !contiError && conti && (
          <div>
            <p>
              {conti.service_date} {conti.title}
            </p>
            {conti.songs.length === 0 ? (
              <p>등록된 곡이 없습니다.</p>
            ) : (
              <ol>
                {conti.songs.map((item) => (
                  <li key={item.order_no}>
                    {item.song.title}_{item.song.artist}({item.song_key})
                    <br />
                    {item.song_form}
                  </li>
                ))}
              </ol>
            )}
            <Link to="/conti">콘티 화면에서 보기</Link>
          </div>
        )}
      </section>

      <section>
        <h2>이번 달 스케줄</h2>
        {scheduleLoading && <p>불러오는 중...</p>}
        {!scheduleLoading && scheduleError && <p>등록된 스케줄이 없습니다.</p>}
        {!scheduleLoading && !scheduleError && weeks.length === 0 && (
          <p>등록된 주차가 없습니다.</p>
        )}
        {!scheduleLoading &&
          !scheduleError &&
          weeks.map((week) => (
            <div key={week.id}>
              <p>
                <strong>{week.week_label}</strong> {week.service_date}
              </p>
              <InstrumentPositionGrid instrument={week.instrument} />
              <MicStageLayout mic={week.singer.mic} choir={week.singer.choir} />
              {week.absence_note && <p>불참: {week.absence_note}</p>}
            </div>
          ))}
        <Link to="/schedules">전체 보기</Link>
      </section>

      <section>
        <h2>공지사항</h2>
        {noticesLoading && <p>불러오는 중...</p>}
        {!noticesLoading && noticesError && <p>공지사항을 불러오지 못했습니다.</p>}
        {!noticesLoading && !noticesError && notices.length === 0 && (
          <p>등록된 공지사항이 없습니다.</p>
        )}
        {!noticesLoading && !noticesError && notices.length > 0 && (
          <ul>
            {notices.map((notice) => (
              <li key={notice.id}>
                <Link to={`/notices/${notice.id}`}>
                  {notice.is_pinned && "📌 "}
                  {notice.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link to="/notices">전체 보기</Link>
      </section>
    </div>
  );
}

export default Home;
