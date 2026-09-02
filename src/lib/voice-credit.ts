import prisma from "@/lib/db"
import type { PrismaClient } from "@/generated/prisma"

// AI 语音点数（voiceCredits）消费/退款原语。
// 扣点只对 assertVideoQuota 的 credit 通道生效：start 路由在阿里云实例创建成功后原子扣 1 点；
// no-show（空转写/极短且候选人未开口）在 end 路由退 1 点——退款以「确有 consume 流水」为前提，
// 且每 imsSessionId 至多退一次，杜绝 Pro 用户虚构退点刷点数。

export type VoiceCreditResult = { ok: boolean; error?: string; remaining?: number }

// 原子扣 1 点（并发安全：updateMany 的 where 要求 voiceCredits >= 1）。
// 成功写一条 consume 流水（refId = IMS 会话标识，供 no-show 退款对账）。
export async function consumeVoiceCredit(
  userId: string,
  refId: string,
  db: PrismaClient = prisma
): Promise<VoiceCreditResult> {
  const res = await db.user.updateMany({
    where: { id: userId, voiceCredits: { gte: 1 } },
    data: { voiceCredits: { decrement: 1 } },
  })
  if (res.count === 0) return { ok: false, error: "语音点数不足，请购买点数包" }

  const user = await db.user.findUnique({ where: { id: userId }, select: { voiceCredits: true } })
  await db.voiceCreditLog.create({
    data: { userId, delta: -1, reason: "consume", refId },
  })
  return { ok: true, remaining: user?.voiceCredits ?? 0 }
}

// 判定是否 no-show（空跑一场，白扣点应退）：
// - 转写为空（通话失败/异常）→ 是
// - 通话 <60s 且转写里没有任何候选人发言（用户可能进会即挂/全程未开口）→ 是
export function isVideoNoShow(transcript: string, durationSec?: number | null): boolean {
  const t = (transcript || "").trim()
  if (!t) return true
  if (durationSec != null && durationSec < 60) {
    return !/候选人[：:]/.test(t)
  }
  return false
}

// no-show 退 1 点：仅当本次确实扣过点（存在 consume 流水）且未退过 → 幂等退一次。
// 退点事务内：user +1 && 写 refund 流水（refId 同 consume，供审计与去重）。
export async function refundNoShowCredit(
  userId: string,
  imsSessionId: string,
  db: PrismaClient = prisma
): Promise<void> {
  const consumed = await db.voiceCreditLog.count({
    where: { userId, reason: "consume", refId: imsSessionId },
  })
  const alreadyRefunded = await db.voiceCreditLog.count({
    where: { userId, reason: "refund", refId: imsSessionId },
  })
  if (consumed === 0 || alreadyRefunded > 0) return

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { voiceCredits: { increment: 1 } },
    }),
    db.voiceCreditLog.create({
      data: { userId, delta: 1, reason: "refund", refId: imsSessionId },
    }),
  ])
}
