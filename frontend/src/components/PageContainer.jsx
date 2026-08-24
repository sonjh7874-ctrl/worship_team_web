// 조회 화면과 편집 화면의 최대 폭·좌우 여백을 한곳에서 통일한다.
function PageContainer({ as: Component = "main", size = "reading", className = "", children, ...props }) {
  const classes = ["ui-page-container", `ui-page-container--${size}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}

export default PageContainer;
