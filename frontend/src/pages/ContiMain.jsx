import { useEffect, useState } from "react";
import { fetchLatestConti } from "../api/contis";

function ContiMain() {
  const [conti, setConti] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestConti()
      .then(setConti)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>불러오는 중...</p>;
  if (error) return <p>등록된 콘티가 없습니다.</p>;

  return (
    <div>
      <h1>{conti.title}</h1>
      <p>{conti.service_date}</p>
      {conti.songs.length === 0 ? (
        <p>등록된 곡이 없습니다.</p>
      ) : (
        <ol>
          {conti.songs.map((item) => (
            <li key={item.order_no}>
              {item.song.title} ({item.song.artist}) - {item.song_key}
              <br />
              {item.song_form}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default ContiMain;
