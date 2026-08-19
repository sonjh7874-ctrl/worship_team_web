function ContiDetailView({ conti }) {
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
      {conti.sheet_files.length > 0 && (
        <div>
          <h2>악보</h2>
          <ul>
            {conti.sheet_files.map((file) => (
              <li key={file.id}>
                <a href={file.url} target="_blank" rel="noreferrer">
                  {file.file_name || file.file_type}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ContiDetailView;
