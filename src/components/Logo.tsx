interface LogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
  showSlogan?: boolean
}

const sizes = {
  sm: { icon: 20, text: "text-base", slogan: "text-[10px]" },
  md: { icon: 28, text: "text-xl", slogan: "text-xs" },
  lg: { icon: 36, text: "text-2xl", slogan: "text-sm" },
}

export function Logo({ className = "", size = "md", showSlogan = false }: LogoProps) {
  const s = sizes[size]

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Logo 图标 */}
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* 背景圆 */}
        <circle cx="16" cy="16" r="16" className="fill-primary" />
        {/* 对话框 */}
        <path
          d="M8 20V12C8 10.8954 8.89543 10 10 10H22C23.1046 10 24 10.8954 24 12V18C24 19.1046 23.1046 20 22 20H14L10 23V20H8Z"
          className="fill-primary-foreground"
          opacity="0.9"
        />
        {/* 对勾 */}
        <path
          d="M13 16L15 18L19 13"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-primary"
        />
        {/* i 字母的点 */}
        <circle cx="16" cy="9" r="1.5" className="fill-primary-foreground" />
      </svg>

      {/* 文字 */}
      <div className="flex flex-col">
        <span className={`${s.text} font-bold tracking-tight`}>
          <span className="text-foreground">i</span>
          <span className="text-foreground">面试</span>
        </span>
        {showSlogan && (
          <span className={`${s.slogan} text-muted-foreground -mt-0.5`}>
            你的 AI 面试教练
          </span>
        )}
      </div>
    </div>
  )
}
