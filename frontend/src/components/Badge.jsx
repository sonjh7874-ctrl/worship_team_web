// 색만으로 상태를 구분하지 않도록 항상 짧은 텍스트를 담는 상태 뱃지다.
function Badge({ tone = "neutral", className = "", children, ...props }) {
  const classes = ["ui-badge", `ui-badge--${tone}`, className].filter(Boolean).join(" ");

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}

export default Badge;
