// button과 React Router Link가 같은 시각 규격을 공유하도록 렌더링 요소만 주입받는다.
function Button({ as: Component = "button", variant = "primary", className = "", children, ...props }) {
  const classes = ["ui-button", `ui-button--${variant}`, className].filter(Boolean).join(" ");
  // 폼 안의 일반 버튼이 의도치 않게 submit되지 않도록 실제 button일 때만 기본 type을 지정한다.
  const componentProps = Component === "button" ? { type: "button", ...props } : props;

  return (
    <Component className={classes} {...componentProps}>
      {children}
    </Component>
  );
}

export default Button;
