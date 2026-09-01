"use client"

// AI 面试官 SVG 虚拟形象。浏览器内绘制（无外部图片/无版权依赖）。
// 由 agentState 派生的视觉状态驱动四态动画：
//   讲话 → 口型开合 + 点头；思考 → 嘴边…点 + 思考气泡；聆听 → 呼吸 + 眨眼。
// 动画 keyframes 在 src/app/globals.css（.avatar-*）。

import { Loader2 } from "lucide-react"
import type { InterviewVisualState } from "@/lib/interview-visuals"
import { cn } from "@/lib/utils"

interface InterviewerAvatarProps {
  state: InterviewVisualState
  phase: "connecting" | "connected" | "error"
  size?: number
}

export function InterviewerAvatar({ state, phase, size = 180 }: InterviewerAvatarProps) {
  const { talking, thinking, listening } = state
  const error = phase === "error"
  const connecting = phase === "connecting"

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size * 1.12 }}
    >
      {connecting && (
        <Loader2 className="absolute z-10 size-14 animate-spin text-primary" aria-hidden />
      )}

      <svg
        viewBox="0 0 200 224"
        width={size}
        height={size * 1.12}
        className={cn(
          "transition-opacity duration-500",
          connecting && "opacity-40",
          error && "opacity-50 grayscale"
        )}
        aria-hidden
      >
        {/* 肩膀 + 西装 + 领带（聆听时呼吸） */}
        <g className={cn("avatar-breathe", !listening && "!animate-none")} style={{ transformBox: "fill-box", transformOrigin: "center bottom" }}>
          <path d="M55 224 C60 180 90 168 100 168 C110 168 140 180 145 224 Z" fill="#334155" />
          <path d="M91 168 L100 202 L109 168 Z" fill="#f1f5f9" />
          <path d="M98 168 L102 168 L104 208 L100 214 L96 208 Z" fill="#6366f1" />
        </g>

        {/* 脖子 */}
        <rect x="90" y="154" width="20" height="18" rx="6" fill="#e0a478" />

        {/* 头 + 耳朵 + 头发（讲话时轻点头） */}
        <g className={cn(talking && "avatar-nod")} style={{ transformBox: "fill-box", transformOrigin: "center top" }}>
          <ellipse cx="58" cy="126" rx="7" ry="9" fill="#e0a478" />
          <ellipse cx="142" cy="126" rx="7" ry="9" fill="#e0a478" />
          <ellipse cx="100" cy="118" rx="40" ry="46" fill="#f2c9a3" />
          <path
            d="M60 114 C60 68 78 56 100 56 C122 56 140 68 140 114 C140 100 132 92 124 90 C130 78 120 66 100 66 C80 66 70 78 76 90 C68 92 60 100 60 114 Z"
            fill="#1f2937"
          />
        </g>

        {/* 眉毛 + 眼睛（缓慢眨眼） */}
        <g className="avatar-blink" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
          <path d="M76 98 Q84 92 92 98" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M108 98 Q116 92 124 98" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
          <ellipse cx="84" cy="108" rx="4.5" ry="6" fill="#1f2937" />
          <ellipse cx="116" cy="108" rx="4.5" ry="6" fill="#1f2937" />
          <ellipse cx="85.5" cy="106" rx="1.6" ry="2" fill="#fff" />
          <ellipse cx="117.5" cy="106" rx="1.6" ry="2" fill="#fff" />
        </g>

        {/* 嘴：思考→…点；讲话→开合；否则→轻闭 */}
        {thinking ? (
          <g transform="translate(100,130)">
            <circle cx="-8" cy="0" r="2.2" fill="#7c2d12" className="avatar-think-dot" />
            <circle cx="0" cy="0" r="2.2" fill="#7c2d12" className="avatar-think-dot" style={{ animationDelay: "0.15s" }} />
            <circle cx="8" cy="0" r="2.2" fill="#7c2d12" className="avatar-think-dot" style={{ animationDelay: "0.3s" }} />
          </g>
        ) : (
          <ellipse
            cx="100"
            cy="130"
            rx="8"
            ry={talking ? 6 : 2.4}
            fill="#7c2d12"
            className={cn("avatar-mouth", talking && "avatar-mouth-talking")}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        )}

        {/* 思考气泡 */}
        {thinking && (
          <g transform="translate(142,64)">
            <circle cx="0" cy="0" r="17" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.5" />
            <circle cx="-23" cy="7" r="4.5" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.5" />
            <circle cx="-31" cy="14" r="2.8" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.5" />
            <circle cx="-6" cy="-4" r="2.4" fill="#64748b" className="avatar-think-dot" />
            <circle cx="1" cy="-4" r="2.4" fill="#64748b" className="avatar-think-dot" style={{ animationDelay: "0.15s" }} />
            <circle cx="8" cy="-4" r="2.4" fill="#64748b" className="avatar-think-dot" style={{ animationDelay: "0.3s" }} />
          </g>
        )}
      </svg>
    </div>
  )
}
