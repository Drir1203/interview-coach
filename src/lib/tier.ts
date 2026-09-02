import prisma from "@/lib/db"
import type { PrismaClient } from "../generated/prisma"

// 会员判定唯一真源：User.proExpiresAt（now < proExpiresAt → pro）。
// requirePro 每次实时查 DB，不缓存 JWT——会员状态会变（购买/过期），缓存会不一致。

export const FREE_INTERVIEW_LIMIT = 5
export const TRIAL_DAYS = 7
// AI 语音面试成本护栏：阿里云按分钟计费（纯语音 ≈¥1.5-2/场），Pro 会员也不放开，每日上限场次。
export const VIDEO_DAILY_LIMIT = 3

// 未登录用户桶（匿名写走 __anon__；历史 default）。付费墙豁免，保持门禁匿名链路可用。
export const ANON_USER_IDS = new Set(["__anon__", "default"])

// 所有者白名单：owner 自用账号（felix@test.com）全功能免配额（AI 语音面试/场次/AI 用量，成本自担）。
export const OWNER_EMAILS = new Set(["felix@test.com"])

export type Tier = "free" | "pro"

export interface TierInfo {
  tier: Tier
  proExpiresAt: Date | null
  trialClaimedAt: Date | null
  trialActive: boolean // trialClaimedAt 存在（与是否过期无关）
  source: string | null // 最近一条 paid/trial 订单来源
  daysLeft: number | null // pro 剩余天数（非 pro 为 null）
  isOwner: boolean // 是否所有者白名单账号（免配额门禁，见 OWNER_EMAILS）
}

export type QuotaResult =
  | { ok: true; remaining?: number }
  | { ok: false; error: string; code: string }

// 会员状态：单次查询 user 会员字段 + 最近一条 paid/trial 订单的 source
export async function getTier(userId: string, db: PrismaClient = prisma): Promise<TierInfo> {
  const [user, lastOrder] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { proExpiresAt: true, trialClaimedAt: true, email: true },
    }),
    db.subscriptionOrder.findFirst({
      where: { userId, status: { in: ["paid", "trial"] } },
      orderBy: { createdAt: "desc" },
      select: { source: true },
    }),
  ])

  const now = new Date()
  const proExpiresAt = user?.proExpiresAt ?? null
  const trialClaimedAt = user?.trialClaimedAt ?? null
  const isPro = !!proExpiresAt && proExpiresAt > now
  const isOwner = !!user?.email && OWNER_EMAILS.has(user.email.toLowerCase())

  return {
    tier: isPro ? "pro" : "free",
    proExpiresAt,
    trialClaimedAt,
    trialActive: !!trialClaimedAt,
    source: lastOrder?.source ?? null,
    daysLeft: isPro && proExpiresAt ? Math.ceil((proExpiresAt.getTime() - now.getTime()) / 86400000) : null,
    isOwner,
  }
}

// Pro 功能拦截（AI 深度复盘等）。未登录桶豁免。
export async function requirePro(
  userId: string,
  db: PrismaClient = prisma
): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  if (ANON_USER_IDS.has(userId)) return { ok: true }
  const info = await getTier(userId, db)
  if (info.tier === "pro" || info.isOwner) return { ok: true }
  return { ok: false, error: "该功能仅 Pro 会员可用，请升级", code: "PAYMENT_REQUIRED" }
}

// 领取 7 天试用：事务内防并发重复（每账号一次，trialClaimedAt 记录）
export async function claimTrial(
  userId: string,
  db: PrismaClient = prisma
): Promise<{ ok: boolean; error?: string }> {
  if (ANON_USER_IDS.has(userId)) return { ok: false, error: "未登录用户不能领取试用" }

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { trialClaimedAt: true },
    })
    if (!user) return { ok: false, error: "用户不存在" }
    if (user.trialClaimedAt) return { ok: false, error: "试用已领取" }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + TRIAL_DAYS * 86400000)
    await tx.user.update({
      where: { id: userId },
      data: { proExpiresAt: expiresAt, trialClaimedAt: now },
    })
    // 试用也记一条金额 0 订单，便于审计/对账
    await tx.subscriptionOrder.create({
      data: {
        userId,
        plan: "month",
        amount: 0,
        status: "paid",
        source: "trial",
        expiresAt,
      },
    })
    return { ok: true }
  })
}

// 注册成功后的试用钩子：试用发放失败不阻断注册（仅记日志）
export async function ensureTrialOnRegister(userId: string): Promise<void> {
  try {
    await claimTrial(userId)
  } catch (err) {
    console.error("试用发放失败:", err)
  }
}

// 面试场次限额（免费用户最多 5 场）。pro 不限；未登录桶豁免。
export async function assertInterviewQuota(
  userId: string,
  db: PrismaClient = prisma
): Promise<QuotaResult> {
  if (ANON_USER_IDS.has(userId)) return { ok: true }
  const info = await getTier(userId, db)
  if (info.tier === "pro" || info.isOwner) return { ok: true }

  const count = await db.interview.count({ where: { userId } })
  if (count >= FREE_INTERVIEW_LIMIT) {
    return {
      ok: false,
      error: `免费用户最多 ${FREE_INTERVIEW_LIMIT} 场面试，升级 Pro 解锁无限`,
      code: "PAYMENT_REQUIRED",
    }
  }
  return { ok: true, remaining: FREE_INTERVIEW_LIMIT - count }
}

// AI 语音面试配额（阿里云按分钟计费，免费/Pro 都要成本护栏）：
// - 免费用户沿用 5 场总限额（assertInterviewQuota，视频计入同一计数）
// - Pro 会员「不限场次」只对文字 mock 成立；视频面试每日最多 VIDEO_DAILY_LIMIT 场
export async function assertVideoQuota(
  userId: string,
  db: PrismaClient = prisma
): Promise<QuotaResult> {
  if (ANON_USER_IDS.has(userId)) return { ok: true }
  const info = await getTier(userId, db)
  if (info.isOwner) return { ok: true } // 所有者自用不设每日语音上限（成本自担）
  if (info.tier !== "pro") return assertInterviewQuota(userId, db)

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const count = await db.interview.count({
    where: { userId, type: "video", createdAt: { gte: todayStart } },
  })
  if (count >= VIDEO_DAILY_LIMIT) {
    return {
      ok: false,
      error: `今日 AI 语音面试已达上限（${VIDEO_DAILY_LIMIT} 场），明日再来`,
      code: "VIDEO_DAILY_LIMIT",
    }
  }
  return { ok: true, remaining: VIDEO_DAILY_LIMIT - count }
}
