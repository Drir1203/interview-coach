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
  ensureTrialOnRegister,
  FREE_INTERVIEW_LIMIT,
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

describe("ensureTrialOnRegister", () => {
  it("claimTrial 内部抛错 → 吞掉，不抛给注册流程", async () => {
    mockDb.$transaction.mockRejectedValue(new Error("db down"))
    await expect(ensureTrialOnRegister("u1")).resolves.toBeUndefined()
  })
})
