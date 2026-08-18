"use client"

import { useCallback, useEffect, useState } from "react"

export interface AuthUser {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  // 会员字段（/api/me 实时返回 getTier 结果）
  tier?: "free" | "pro"
  proExpiresAt?: string | null
  trialClaimedAt?: string | null
  trialActive?: boolean
  source?: string | null
  daysLeft?: number | null
}

// 从正确路径获取会话（避免 next-auth basePath 拼接 bug）
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading")

  const load = useCallback(() => {
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

  useEffect(() => {
    load()
  }, [load])

  // 购买/激活会员后刷新（Sidebar Pro 角标、设置页会员卡即时更新）
  const reload = useCallback(() => {
    load()
  }, [load])

  return { user, status, reload }
}
