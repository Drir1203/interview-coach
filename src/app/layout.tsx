import type { Metadata } from "next"
import "./globals.css"
import { AppFrame } from "@/components/layout/AppFrame"
import { Toaster } from "@/components/ui/toast"
import { Providers } from "./providers"

export const metadata: Metadata = {
  // basePath=/interview：metadata 里的绝对路径不会自动加前缀，需显式写 /interview/...（与全项目硬编码惯例一致）
  metadataBase: new URL("https://mianshi.pro/interview"),
  title: {
    default: "AI 面师 - 你的 AI 面试教练",
    template: "%s | AI 面师",
  },
  description: "AI 面试教练 — 记录面试 / AI 复盘 / 押题 / 模拟面试，一个平台管理求职全流程",
  icons: {
    icon: [{ url: "/interview/logo.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "AI 面师 - 你的 AI 面试教练",
    description: "记录真实面试 → AI 复盘 → 押题 → 模拟面试，一个平台管理求职全生命周期",
    type: "website",
    siteName: "AI 面师",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <Providers>
          <AppFrame>{children}</AppFrame>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
