"use client"

import { useCallback, useEffect, useState } from "react"

export interface SubscriptionInfo {
  tier: "free" | "pro"
  proExpiresAt: string | null
  trialClaimedAt: string | null
  trialActive: boolean
  source: string | null
  daysLeft: number | null
  interviewCount: number
  freeLimit: number
  voiceCredits: number
  voiceUsedThisMonth: number
  voiceMonthlyQuota: number
}

// 会员状态 hook：读 /api/subscription（服务端 getTier 实时查 DB，付费判定权威仍在服务端）
// reload 供购买/激活后刷新
export function useSubscription() {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/interview/api/subscription")
      const data = await res.json()
      setInfo(data)
    } catch {
      setInfo(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { info, loading, reload }
}
