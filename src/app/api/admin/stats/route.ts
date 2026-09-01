import { NextRequest } from "next/server"
import prisma from "@/lib/db"
import { requireAdmin } from "@/lib/payment/admin-session"
import { estimateAiCost } from "@/lib/payment/ai-quota"

// AI 语音面试成本常量：纯语音 VoiceAgent 按分钟计费 ¥0.014/分钟（docs/video-interview-spec.md §6）。
// 看板为估算值；真实账单以阿里云控制台为准。
const VIDEO_COST_PER_MIN = 0.014

// 管理端运营看板：核心指标聚合（一次性并行查询，无分页）
// 鉴权：admin_session cookie；未登录或失效 → 401
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin.ok) {
    return Response.json({ error: "未授权" }, { status: 401 })
  }

  const now = new Date()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [
    totalUsers,
    proUsers,
    trialClaimed,
    paidAgg,
    paidOrders,
    pendingOrders,
    notifiedPendingOrders,
    aiUsageToday,
    videoInterviewsToday,
    videoInterviewsTotal,
    videoSecondsAgg,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { proExpiresAt: { gt: now } } }),
    prisma.user.count({ where: { trialClaimedAt: { not: null } } }),
    prisma.subscriptionOrder.aggregate({
      where: { status: "paid" },
      _sum: { amount: true },
    }),
    prisma.subscriptionOrder.count({ where: { status: "paid" } }),
    prisma.subscriptionOrder.count({ where: { status: "pending" } }),
    prisma.subscriptionOrder.count({
      where: { status: "pending", userNotifiedAt: { not: null } },
    }),
    prisma.aiUsage.groupBy({
      by: ["model"],
      where: { createdAt: { gte: todayStart } },
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true },
    }),
    prisma.interview.count({ where: { type: "video", createdAt: { gte: todayStart } } }),
    prisma.interview.count({ where: { type: "video" } }),
    prisma.interview.aggregate({
      where: { type: "video" },
      _sum: { durationSec: true },
    }),
  ])

  const aiByModel = aiUsageToday.map((g) => ({
    model: g.model,
    calls: g._count._all,
    inputTokens: g._sum.inputTokens ?? 0,
    outputTokens: g._sum.outputTokens ?? 0,
  }))
  const aiCost = estimateAiCost(aiByModel)

  return Response.json({
    stats: {
      totalUsers,
      proUsers,
      trialClaimed,
      totalRevenueCents: paidAgg._sum.amount ?? 0,
      paidOrders,
      pendingOrders,
      notifiedPendingOrders,
      aiCost: {
        callsToday: aiByModel.reduce((s, r) => s + r.calls, 0),
        tokensToday: aiCost.tokens,
        costYuan: aiCost.costYuan,
        byModel: aiByModel,
      },
      // AI 语音面试（阿里云按分钟计费）：场次/时长/估算成本
      videoInterview: {
        today: videoInterviewsToday,
        total: videoInterviewsTotal,
        minutesTotal: Math.round((videoSecondsAgg._sum.durationSec ?? 0) / 60),
        costYuan:
          Math.round(((videoSecondsAgg._sum.durationSec ?? 0) / 60) * VIDEO_COST_PER_MIN * 100) / 100,
      },
    },
  })
}
