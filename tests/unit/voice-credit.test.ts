import { describe, it, expect, vi, beforeEach } from "vitest"

// 在 import 前 mock @/lib/db，避免实例化真实 PrismaClient
const mockDb = vi.hoisted(() => ({
  user: {
    updateMany: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  voiceCreditLog: {
    count: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock("@/lib/db", () => ({ default: mockDb }))

import {
  consumeVoiceCredit,
  isVideoNoShow,
  refundNoShowCredit,
} from "@/lib/voice-credit"

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.voiceCreditLog.create.mockResolvedValue({ id: "log1" })
  mockDb.user.update.mockResolvedValue({ id: "u1", voiceCredits: 1 })
  // $transaction(array)：逐条执行 PrismaPromise
  mockDb.$transaction.mockImplementation((ops: unknown[]) =>
    Array.isArray(ops) ? Promise.all(ops) : Promise.resolve()
  )
})

describe("consumeVoiceCredit", () => {
  it("余额充足 → 原子扣 1 点（where 带 gte:1）+ 写 consume 流水 + 返回剩余", async () => {
    mockDb.user.updateMany.mockResolvedValue({ count: 1 })
    mockDb.user.findUnique.mockResolvedValue({ voiceCredits: 4 })

    const res = await consumeVoiceCredit("u1", "ims-abc")

    expect(res.ok).toBe(true)
    expect(res.remaining).toBe(4)
    expect(mockDb.user.updateMany).toHaveBeenCalledWith({
      where: { id: "u1", voiceCredits: { gte: 1 } },
      data: { voiceCredits: { decrement: 1 } },
    })
    expect(mockDb.voiceCreditLog.create).toHaveBeenCalledWith({
      data: { userId: "u1", delta: -1, reason: "consume", refId: "ims-abc" },
    })
  })

  it("余额为 0（并发抢光）→ 失败且不写流水", async () => {
    mockDb.user.updateMany.mockResolvedValue({ count: 0 })

    const res = await consumeVoiceCredit("u1", "ims-abc")

    expect(res.ok).toBe(false)
    expect(res.error).toContain("点数不足")
    expect(mockDb.voiceCreditLog.create).not.toHaveBeenCalled()
  })
})

describe("isVideoNoShow", () => {
  it("空转写 → true", () => {
    expect(isVideoNoShow("")).toBe(true)
    expect(isVideoNoShow("   ")).toBe(true)
  })

  it("短通话（<60s）且无候选人发言 → true", () => {
    const t = "面试官：请自我介绍"
    expect(isVideoNoShow(t, 30)).toBe(true)
  })

  it("短通话但有候选人发言 → false", () => {
    const t = "面试官：请自我介绍\n候选人：我是张伟"
    expect(isVideoNoShow(t, 30)).toBe(false)
  })

  it("通话 >60s（即使转写只有面试官）→ false（视为正常场次）", () => {
    const t = "面试官：请自我介绍"
    expect(isVideoNoShow(t, 120)).toBe(false)
  })
})

describe("refundNoShowCredit", () => {
  it("确有 consume 且未退过 → 退 1 点 + 写 refund 流水", async () => {
    mockDb.voiceCreditLog.count.mockResolvedValueOnce(1) // consume 存在
      .mockResolvedValueOnce(0) // refund 不存在

    await refundNoShowCredit("u1", "ims-abc")

    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { voiceCredits: { increment: 1 } },
    })
    expect(mockDb.voiceCreditLog.create).toHaveBeenCalledWith({
      data: { userId: "u1", delta: 1, reason: "refund", refId: "ims-abc" },
    })
  })

  it("已退过一次（同 imsSessionId）→ 幂等，不再退", async () => {
    mockDb.voiceCreditLog.count.mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)

    await refundNoShowCredit("u1", "ims-abc")

    expect(mockDb.user.update).not.toHaveBeenCalled()
    expect(mockDb.voiceCreditLog.create).not.toHaveBeenCalled()
  })

  it("无 consume 流水（pro_monthly/未扣点）→ 不退，防虚构退点", async () => {
    mockDb.voiceCreditLog.count.mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)

    await refundNoShowCredit("u1", "ims-abc")

    expect(mockDb.user.update).not.toHaveBeenCalled()
    expect(mockDb.voiceCreditLog.create).not.toHaveBeenCalled()
  })
})
