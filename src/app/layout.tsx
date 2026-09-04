import type { Metadata, Viewport } from "next"
import "./globals.css"
import { AppFrame } from "@/components/layout/AppFrame"
import { PwaRegister } from "@/components/PwaRegister"
import { Toaster } from "@/components/ui/toast"
import { Providers } from "./providers"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 移动端浏览器地址栏/状态栏着品牌靛蓝
  themeColor: "#6366f1",
}

export const metadata: Metadata = {
  // basePath=/interview：metadata 里的绝对路径不会自动加前缀，需显式写 /interview/...（与全项目硬编码惯例一致）
  metadataBase: new URL("https://mianshi.pro/interview"),
  title: {
    default: "AI 面师 - 你的 AI 面试教练",
    template: "%s | AI 面师",
  },
  description: "AI Agent 逐题复盘真实面试 · AI 面试官随时模拟 · 考前智能押题备战 —— 把每一场面试，沉淀为下一次的从容",
  manifest: "/interview/manifest.webmanifest",
  icons: {
    icon: [{ url: "/interview/logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/interview/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "AI 面师 - 你的 AI 面试教练",
    description: "AI Agent 逐题复盘真实面试 · AI 面试官随时模拟 · 考前智能押题备战，把每一场面试沉淀为下一次的从容",
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
          <PwaRegister />
        </Providers>
      </body>
    </html>
  )
}
