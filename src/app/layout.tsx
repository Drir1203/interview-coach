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
  description: "真实面试自动 AI 复盘 · AI 面试官随时模拟 · 考前智能押题备战 —— 一个平台，让每一次面试都成为你更强的理由",
  icons: {
    icon: [{ url: "/interview/logo.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "AI 面师 - 你的 AI 面试教练",
    description: "真实面试自动 AI 复盘 · AI 面试官随时模拟 · 考前智能押题备战，让每一次面试都成为你更强的理由",
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
