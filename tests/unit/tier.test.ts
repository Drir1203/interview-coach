import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// 在 import tier 前 mock @/lib/db，避免实例化真实 PrismaClient（无需数据库连接）
const mockDb = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  subscriptionOrder: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  interview: { count: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock("@/lib/db", () => ({ default: mockDb }))

import {
  getTier,
  requirePro,
  claimTrial,
  assertInterviewQuota,
  assertVideoQuota,
  ensureTrialOnRegister,
  FREE_INTERVIEW_LIMIT,
  VOICE_MONTHLY_PRO_QUOTA,
  VOICE_TRIAL_QUOTA,
  VOICE_NEEDS_CREDITS,
  ANON_USER_IDS,
} from "@/lib/tier"

const NOW = new Date("2026-08-17T00:00:00.000Z")
const DAY = 24 * 3600 * 1000

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  vi.clearAllMocks()
  // claimTrial 的 $transaction：用 mockDb 自身作为事务客户端
  mockDb.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(mockDb))
})

afterEach(() => {
  vi.useRealTimers()
})

describe("getTier", () => {
  it("无会员记录 → free", async () => {
    mockDb.user.findUnique.mockResolvedValue({ proExpiresAt: null, trialClaimedAt: null })
    mockDb.subscriptionOrder.findFirst.mockResolvedValue(null)

    const info = await getTier("u1")
    expect(info.tier).toBe("free")
    expect(info.trialActive).toBe(false)
    expect(info.source).toBeNull()
    expect(info.daysLeft).toBeNull()
  })

  it("试用中（proExpiresAt 未来 + source trial）→ pro + trialActive + 剩余天数", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      proExpiresAt: new Date(NOW.getTime() + 7 * DAY),
      trialClaimedAt: NOW,
    })
    mockDb.subscriptionOrder.findFirst.mockResolvedValue({ source: "trial" })

    const info = await getTier("u1")
    expect(info.tier).toBe("pro")
    expect(info.trialActive).toBe(true)
    expect(info.source).toBe("trial")
    expect(info.daysLeft).toBe(7)
  })

  it("已过期（proExpiresAt 过去）→ free（自动降级）", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      proExpiresAt: new Date(NOW.getTime() - DAY),
      trialClaimedAt: NOW,
    })
    mockDb.subscriptionOrder.findFirst.mockResolvedValue({ source: "trial" })

    const info = await getTier("u1")
    expect(info.tier).toBe("free")
    expect(info.proExpiresAt).not.toBeNull()
  })

  it("用户不存在（防御）→ 安全返回 free，不抛错", async () => {
    mockDb.user.findUnique.mockResolvedValue(null)
    mockDb.subscriptionOrder.findFirst.mockResolvedValue(null)

    const info = await getTier("ghost")
    expect(info.tier).toBe("free")
    expect(info.trialActive).toBe(false)
  })
})

describe("requirePro", () => {
  it("pro → ok:true", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      proExpiresAt: new Date(NOW.getTime() + DAY),
      trialClaimedAt: null,
    })
    mockDb.subscriptionOrder.findFirst.mockResolvedValue({ source: "mock" })

    await expect(requirePro("u1")).resolves.toEqual({ ok: true })
  })

  it("free → ok:false + 升级提示", async () => {
    mockDb.user.findUnique.mockResolvedValue({ proExpiresAt: null, trialClaimedAt: null })
    mockDb.subscriptionOrder.findFirst.mockResolvedValue(null)

    const res = await requirePro("u1")
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toContain("Pro")
      expect(res.code).toBe("PAYMENT_REQUIRED")
    }
  })

  it("未登录豁免桶（__anon__/default）→ 恒 ok:true，不查库", async () => {
    for (const uid of [...ANON_USER_IDS]) {
      mockDb.user.findUnique.mockClear()
      await expect(requirePro(uid)).resolves.toEqual({ ok: true })
      expect(mockDb.user.findUnique).not.toHaveBeenCalled()
    }
  })
})

describe("claimTrial", () => {
  it("首次领取 → 写 proExpiresAt=now+7d + trialClaimedAt + source=trial 金额 0 订单", async () => {
    mockDb.user.findUnique.mockResolvedValue({ trialClaimedAt: null })

    const res = await claimTrial("u1")
    expect(res.ok).toBe(true)

    const updateArgs = mockDb.user.update.mock.calls[0][0]
    expect(updateArgs.where).toEqual({ id: "u1" })
    expect(updateArgs.data.proExpiresAt.getTime()).toBe(NOW.getTime() + 7 * DAY)
    expect(updateArgs.data.trialClaimedAt.getTime()).toBe(NOW.getTime())

    const createArgs = mockDb.subscriptionOrder.create.mock.calls[0][0]
    expect(createArgs.data).toMatchObject({
      userId: "u1",
      plan: "month",
      amount: 0,
      status: "paid",
      source: "trial",
    })
  })

  it("已领取（即使已过期）→ 拒绝，不重复发放", async () => {
    mockDb.user.findUnique.mockResolvedValue({ trialClaimedAt: new Date("2026-08-01") })

    const res = await claimTrial("u1")
    expect(res.ok).toBe(false)
    expect(mockDb.user.update).not.toHaveBeenCalled()
    expect(mockDb.subscriptionOrder.create).not.toHaveBeenCalled()
  })

  it("匿名桶不能领取试用", async () => {
    const res = await claimTrial("__anon__")
    expect(res.ok).toBe(false)
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })
})

describe("assertInterviewQuota", () => {
  it(`count 未达上限（${FREE_INTERVIEW_LIMIT - 1} 场）→ 放行 + remaining`, async () => {
    mockDb.user.findUnique.mockResolvedValue({ proExpiresAt: null, trialClaimedAt: null })
    mockDb.subscriptionOrder.findFirst.mockResolvedValue(null)
    mockDb.interview.count.mockResolvedValue(FREE_INTERVIEW_LIMIT - 1)

    const res = await assertInterviewQuota("u1")
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.remaining).toBe(1)
  })

  it(`count 达上限（${FREE_INTERVIEW_LIMIT} 场）→ 拒绝 402`, async () => {
    mockDb.user.findUnique.mockResolvedValue({ proExpiresAt: null, trialClaimedAt: null })
    mockDb.subscriptionOrder.findFirst.mockResolvedValue(null)
    mockDb.interview.count.mockResolvedValue(FREE_INTERVIEW_LIMIT)

    const res = await assertInterviewQuota("u1")
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.code).toBe("PAYMENT_REQUIRED")
      expect(res.error).toContain("5 场")
    }
  })

  it("pro → 不限量", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      proExpiresAt: new Date(NOW.getTime() + DAY),
      trialClaimedAt: null,
    })
    mockDb.subscriptionOrder.findFirst.mockResolvedValue({ source: "mock" })

    const res = await assertInterviewQuota("u1")
    expect(res.ok).toBe(true)
    expect(mockDb.interview.count).not.toHaveBeenCalled()
  })
})

describe("assertVideoQuota", () => {
  function paidProUser(voiceCredits = 0) {
    return { proExpiresAt: new Date(NOW.getTime() + DAY), trialClaimedAt: null, voiceCredits }
  }
  function trialProUser(voiceCredits = 0) {
    return { proExpiresAt: new Date(NOW.getTime() + DAY), trialClaimedAt: NOW, voiceCredits }
  }

  it(`付费 Pro + 当月视频 < ${VOICE_MONTHLY_PRO_QUOTA} 场 → pro_monthly + remaining`, async () => {
    mockDb.user.findUnique.mockResolvedValue(paidProUser())
    mockDb.subscriptionOrder.findFirst.mockResolvedValue({ source: "mock" })
    mockDb.interview.count.mockResolvedValue(VOICE_MONTHLY_PRO_QUOTA - 2)

    const res = await assertVideoQuota("u1")
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.channel).toBe("pro_monthly")
      expect(res.remaining).toBe(2)
    }
    // 只统计当月（本地当月 1 日 0 点）type=video 的场次
    const where = mockDb.interview.count.mock.calls[0][0].where
    expect(where.type).toBe("video")
    expect(where.createdAt.gte).toBeInstanceOf(Date)
    const expectedMonthStart = new Date()
    expectedMonthStart.setDate(1)
    expectedMonthStart.setHours(0, 0, 0, 0)
    expect(where.createdAt.gte.toISOString()).toBe(expectedMonthStart.toISOString())
  })

  it(`付费 Pro 当月视频达 ${VOICE_MONTHLY_PRO_QUOTA} 场 + 有语音点数 → 走 credit 通道`, async () => {
    mockDb.user.findUnique.mockResolvedValue(paidProUser(5))
    mockDb.subscriptionOrder.findFirst.mockResolvedValue({ source: "mock" })
    mockDb.interview.count.mockResolvedValue(VOICE_MONTHLY_PRO_QUOTA)

    const res = await assertVideoQuota("u1")
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.channel).toBe("credit")
      expect(res.remaining).toBe(5)
    }
  })

  it(`付费 Pro 当月视频达 ${VOICE_MONTHLY_PRO_QUOTA} 场且无点数 → 拦截 VOICE_NEEDS_CREDITS`, async () => {
    mockDb.user.findUnique.mockResolvedValue(paidProUser(0))
    mockDb.subscriptionOrder.findFirst.mockResolvedValue({ source: "mock" })
    mockDb.interview.count.mockResolvedValue(VOICE_MONTHLY_PRO_QUOTA)

    const res = await assertVideoQuota("u1")
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.code).toBe(VOICE_NEEDS_CREDITS)
      expect(res.error).toContain(`${VOICE_MONTHLY_PRO_QUOTA} 场 AI 语音面试已用完`)
    }
  })

  it(`试用 Pro：试用额度 ${VOICE_TRIAL_QUOTA} 场（非月额度），用满后无点数 → 拦截`, async () => {
    mockDb.user.findUnique.mockResolvedValue(trialProUser(0))
    mockDb.subscriptionOrder.findFirst.mockResolvedValue({ source: "trial" })
    mockDb.interview.count.mockResolvedValue(VOICE_TRIAL_QUOTA)

    const res = await assertVideoQuota("u1")
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.code).toBe(VOICE_NEEDS_CREDITS)
      expect(res.error).toContain(`试用期含 ${VOICE_TRIAL_QUOTA} 场`)
    }
  })

  it(`试用 Pro：当月视频未达试用额度 1 场 → 放行 pro_monthly（remaining=1）`, async () => {
    mockDb.user.findUnique.mockResolvedValue(trialProUser(0))
    mockDb.subscriptionOrder.findFirst.mockResolvedValue({ source: "trial" })
    mockDb.interview.count.mockResolvedValue(0)

    const res = await assertVideoQuota("u1")
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.channel).toBe("pro_monthly")
      expect(res.remaining).toBe(VOICE_TRIAL_QUOTA)
    }
  })

  it("免费用户（无 pro）+ 有语音点数 → 放行 credit（不再走 5 场总限额）", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      proExpiresAt: null,
      trialClaimedAt: null,
      voiceCredits: 3,
    })
    mockDb.subscriptionOrder.findFirst.mockResolvedValue(null)

    const res = await assertVideoQuota("u1")
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.channel).toBe("credit")
      expect(res.remaining).toBe(3)
    }
    // free 不查 interview.count（点数通道直接放行）
    expect(mockDb.interview.count).not.toHaveBeenCalled()
  })

  it("免费用户无点数 → 拦截 VOICE_NEEDS_CREDITS，提示需 Pro 或点数包", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      proExpiresAt: null,
      trialClaimedAt: null,
      voiceCredits: 0,
    })
    mockDb.subscriptionOrder.findFirst.mockResolvedValue(null)

    const res = await assertVideoQuota("u1")
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.code).toBe(VOICE_NEEDS_CREDITS)
      expect(res.error).toContain("Pro 会员或语音点数包")
    }
  })

  it("匿名桶 → 豁免，不查库", async () => {
    const res = await assertVideoQuota("__anon__")
    expect(res.ok).toBe(true)
    expect(mockDb.user.findUnique).not.toHaveBeenCalled()
    expect(mockDb.interview.count).not.toHaveBeenCalled()
  })
})

describe("ensureTrialOnRegister", () => {
  it("claimTrial 内部抛错 → 吞掉，不抛给注册流程", async () => {
    mockDb.$transaction.mockRejectedValue(new Error("db down"))
    await expect(ensureTrialOnRegister("u1")).resolves.toBeUndefined()
  })
})

describe("所有者白名单豁免（OWNER_EMAILS）", () => {
  const OWNER_EMAIL = "felix@test.com"

  function ownerUser() {
    return { proExpiresAt: null, trialClaimedAt: null, email: OWNER_EMAIL }
  }

  it("getTier：白名单 email（即使 free）→ isOwner true", async () => {
    mockDb.user.findUnique.mockResolvedValue(ownerUser())
    mockDb.subscriptionOrder.findFirst.mockResolvedValue(null)

    const info = await getTier("u1")
    expect(info.isOwner).toBe(true)
    expect(info.tier).toBe("free")
  })

  it("getTier：普通邮箱 → isOwner false", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      proExpiresAt: null,
      trialClaimedAt: null,
      email: "other@test.com",
    })
    mockDb.subscriptionOrder.findFirst.mockResolvedValue(null)

    const info = await getTier("u1")
    expect(info.isOwner).toBe(false)
  })

  it("getTier：用户无 email / 不存在 → isOwner false（防御）", async () => {
    mockDb.user.findUnique.mockResolvedValue({ proExpiresAt: null, trialClaimedAt: null })
    mockDb.subscriptionOrder.findFirst.mockResolvedValue(null)

    const info = await getTier("u1")
    expect(info.isOwner).toBe(false)
  })

  it("requirePro：owner（非 pro）→ 放行 ok:true", async () => {
    mockDb.user.findUnique.mockResolvedValue(ownerUser())
    mockDb.subscriptionOrder.findFirst.mockResolvedValue(null)

    await expect(requirePro("u1")).resolves.toEqual({ ok: true })
  })

  it("assertInterviewQuota：owner 即使超过免费 5 场上限 → 放行且不查 interview.count", async () => {
    mockDb.user.findUnique.mockResolvedValue(ownerUser())
    mockDb.subscriptionOrder.findFirst.mockResolvedValue(null)

    const res = await assertInterviewQuota("u1")
    expect(res).toEqual({ ok: true })
    expect(mockDb.interview.count).not.toHaveBeenCalled()
  })

  it("assertVideoQuota：owner 不设语音上限 → 放行 channel=owner 且不查 count", async () => {
    mockDb.user.findUnique.mockResolvedValue(ownerUser())
    mockDb.subscriptionOrder.findFirst.mockResolvedValue(null)

    const res = await assertVideoQuota("u1")
    expect(res).toEqual({ ok: true, channel: "owner" })
    expect(mockDb.interview.count).not.toHaveBeenCalled()
  })
})
