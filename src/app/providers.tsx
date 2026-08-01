"use client"

import { SessionProvider } from "next-auth/react"

// basePath 用 /interview/api/auth，让 next-auth 拼接 session/signin/signout 路径正确
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider basePath="/interview/api/auth">{children}</SessionProvider>
}
