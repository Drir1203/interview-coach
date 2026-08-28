// AI 输出统一 Markdown 渲染组件。
// 所有走 chatWithFallback 的 AI 结果（策略/押题/报告/教练）都用 Markdown 返回，
// 统一在此渲染，避免各处裸展示 `##`/`**` 原文。
// 样式：@tailwindcss/typography 的 prose（暗色模式带 prose-invert）。

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export function Markdown({
  content,
  className = "prose prose-sm max-w-none dark:prose-invert",
}: {
  content: string
  className?: string
}) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
