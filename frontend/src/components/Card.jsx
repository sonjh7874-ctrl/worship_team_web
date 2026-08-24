// 목록과 상세 섹션이 같은 여백 체계를 쓰되 배경·테두리 깊이는 variant로 구분한다.
function Card({ as: Component = "section", variant = "detail", className = "", children, ...props }) {
  const classes = ["ui-card", `ui-card--${variant}`, className].filter(Boolean).join(" ");

  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}

export default Card;
