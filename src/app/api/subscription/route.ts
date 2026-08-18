import { auth } from "@/auth"
import prisma from "@/lib/db"
import { getTier, FREE_INTERVIEW_LIMIT } from "@/lib/tier"

// 查会员状态：登录用户返回完整 tier 信息；未登录返回免费档（pricing 页公开可用）
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({
      user: null,
      tier: "free",
      trialActive: false,
      interviewCount: 0,
      freeLimit: FREE_INTERVIEW_LIMIT,
    })
  }

  const [info, interviewCount] = await Promise.all([
    getTier(session.user.id),
    prisma.interview.count({ where: { userId: session.user.id } }),
  ])

  return Response.json({
    user: session.user,
    ...info,
    interviewCount,
    freeLimit: FREE_INTERVIEW_LIMIT,
  })
}
