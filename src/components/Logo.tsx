import type { CSSProperties } from "react"

interface LogoMarkProps {
  className?: string
  style?: CSSProperties
}

// 品牌图标（仅图形，A 方向「逐级对话」）：靛蓝圆角底 + 两个白对话泡错落上升。
// 大主泡在下左（你/当前场，带尾），次级泡在上右（AI/下一级）——双泡成斜向阶梯，
// 既表对话又表逐级进阶。坐标与 public/logo.svg、scripts/gen-pwa-icons.js 保持一致
// （同一 100 网格，可在三处直接换算）。
export function LogoMark({ className = "", style }: LogoMarkProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={`block ${className}`} style={style} aria-hidden>
      {/* 靛蓝圆角底 */}
      <rect x="0" y="0" width="100" height="100" rx="23" className="fill-primary" />
      {/* 次级泡（上右） */}
      <rect x="54" y="10" width="36" height="28" rx="13" className="fill-primary-foreground" />
      {/* 主泡（下左） */}
      <rect x="10" y="47" width="62" height="41" rx="16" className="fill-primary-foreground" />
      {/* 主泡尾 */}
      <path d="M30 88 46 88 24 97Z" className="fill-primary-foreground" />
    </svg>
  )
}

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
      <LogoMark className="h-auto shrink-0" style={{ width: s.icon, height: s.icon }} />

      {/* 文字 */}
      <div className="flex flex-col">
        <span className={`${s.text} font-bold tracking-tight`}>
          <span className="text-foreground">AI</span>
          <span className="text-foreground">面师</span>
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
