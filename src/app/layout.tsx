import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/layout/Sidebar"
import { Toaster } from "@/components/ui/toast"
import { Providers } from "./providers"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "AI 面师 - 你的 AI 面试教练",
  description: "AI 面试复盘工具 — 记录面试 → AI 复盘 → 提升自己",
  icons: {
    icon: "/logo.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <Providers>
          <Sidebar />
          <main className="min-h-screen p-4 pt-16 md:ml-64 md:pt-8 md:p-8">{children}</main>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
