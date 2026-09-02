import { auth } from "@/auth"
import prisma from "@/lib/db"
import { getTier, FREE_INTERVIEW_LIMIT, VOICE_MONTHLY_PRO_QUOTA, VOICE_TRIAL_QUOTA } from "@/lib/tier"

// 查会员状态：登录用户返回完整 tier 信息（含语音点数/本月已用/月度额度）；未登录返回免费档（pricing 页公开可用）
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({
      user: null,
      tier: "free",
      trialActive: false,
      interviewCount: 0,
      freeLimit: FREE_INTERVIEW_LIMIT,
      voiceCredits: 0,
      voiceUsedThisMonth: 0,
      voiceMonthlyQuota: 0,
    })
  }

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const [info, interviewCount, voiceUsedThisMonth] = await Promise.all([
    getTier(session.user.id),
    prisma.interview.count({ where: { userId: session.user.id } }),
    prisma.interview.count({
      where: { userId: session.user.id, type: "video", createdAt: { gte: monthStart } },
    }),
  ])

  // Pro 试用中 → 额度 1 场；付费 Pro → 15 场/月；free → 0（仅点数包可用）
  const voiceMonthlyQuota =
    info.tier === "pro" && info.source === "trial" ? VOICE_TRIAL_QUOTA : info.tier === "pro" ? VOICE_MONTHLY_PRO_QUOTA : 0

  return Response.json({
    user: session.user,
    ...info,
    interviewCount,
    freeLimit: FREE_INTERVIEW_LIMIT,
    voiceUsedThisMonth,
    voiceMonthlyQuota,
  })
}
