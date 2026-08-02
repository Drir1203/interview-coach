"use client"

import { useEffect, useState } from "react"

export interface AuthUser {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
}

// 从正确路径获取会话（避免 next-auth basePath 拼接 bug）
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading")

  useEffect(() => {
    // 走服务端 auth() 的 /api/me，复用已验证可靠的会话解析路径
    fetch("/interview/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user) {
          setUser(data.user)
          setStatus("authenticated")
        } else {
          setUser(null)
          setStatus("unauthenticated")
        }
      })
      .catch(() => {
        setUser(null)
        setStatus("unauthenticated")
      })
  }, [])

  return { user, status }
}
