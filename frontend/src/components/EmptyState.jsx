// 데이터 없음과 잘못된 경로처럼 다음 행동이 필요한 상태를 일관된 안내 카드로 보여준다.
function EmptyState({ title, description, action, titleAs: Title = "h2", className = "" }) {
  const classes = ["ui-empty-state", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <Title className="ui-empty-state__title">{title}</Title>
      {description && <p className="ui-empty-state__description">{description}</p>}
      {action && <div className="ui-empty-state__action">{action}</div>}
    </div>
  );
}

export default EmptyState;
