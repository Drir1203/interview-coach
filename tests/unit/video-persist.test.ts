import { describe, it, expect, vi, beforeEach } from "vitest"

// 在 import video-persist 前 mock @/lib/db，避免实例化真实 PrismaClient
const mockDb = vi.hoisted(() => ({
  company: { findFirst: vi.fn(), create: vi.fn() },
  interview: { create: vi.fn() },
}))

vi.mock("@/lib/db", () => ({ default: mockDb }))

import { parseVideoTranscript, persistVideoInterview } from "@/lib/video-persist"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("parseVideoTranscript", () => {
  it("面试官/候选人 交替 → 配对成逐题问答", () => {
    const transcript = [
      "面试官：你好，请先做个自我介绍。",
      "候选人：我是张三，有5年后端开发经验。",
      "面试官：你最有成就感的一个项目是？",
      "候选人：是XX支付网关项目。",
    ].join("\n")
    expect(parseVideoTranscript(transcript)).toEqual([
      { question: "你好，请先做个自我介绍。", answer: "我是张三，有5年后端开发经验。" },
      { question: "你最有成就感的一个项目是？", answer: "是XX支付网关项目。" },
    ])
  })

  it("候选人多轮回答 → 合并为一个 answer", () => {
    const transcript = [
      "面试官：说说这个项目的难点。",
      "候选人：第一点是并发。",
      "候选人：第二点是数据一致性。",
    ].join("\n")
    expect(parseVideoTranscript(transcript)).toEqual([
      { question: "说说这个项目的难点。", answer: "第一点是并发。\n第二点是数据一致性。" },
    ])
  })

  it("无面试官行（只有候选人）→ 空数组", () => {
    expect(parseVideoTranscript("候选人：自言自语……")).toEqual([])
  })

  it("空/空白转写 → 空数组", () => {
    expect(parseVideoTranscript("")).toEqual([])
    expect(parseVideoTranscript("   \n  ")).toEqual([])
  })

  it("非面试官/候选人 行（ASR 噪声）→ 丢弃", () => {
    const transcript = ["[杂音]", "面试官：Q1", "候选人：A1"].join("\n")
    expect(parseVideoTranscript(transcript)).toEqual([{ question: "Q1", answer: "A1" }])
  })

  it("半角冒号也识别", () => {
    expect(parseVideoTranscript("面试官:Q1\n候选人:A1")).toEqual([
      { question: "Q1", answer: "A1" },
    ])
  })
})

describe("persistVideoInterview", () => {
  const meta = {
    company: "字节跳动",
    position: "后端开发",
    roundType: "first",
    transcript: "面试官：Q1\n候选人：A1",
    durationSec: 245,
  }

  it("company 不存在 → find-or-create + 落库 type=video/draft/transcript/durationSec + 逐题", async () => {
    mockDb.company.findFirst.mockResolvedValue(null)
    mockDb.company.create.mockResolvedValue({ id: "c1" })
    mockDb.interview.create.mockResolvedValue({ id: "iv1" })

    const id = await persistVideoInterview("u1", meta, mockDb as never)

    expect(id).toBe("iv1")
    expect(mockDb.company.create).toHaveBeenCalledWith({ data: { name: "字节跳动" } })
    const args = mockDb.interview.create.mock.calls[0][0]
    expect(args.data.type).toBe("video")
    expect(args.data.status).toBe("draft")
    expect(args.data.userId).toBe("u1")
    expect(args.data.companyId).toBe("c1")
    expect(args.data.position).toBe("后端开发")
    expect(args.data.roundType).toBe("first")
    expect(args.data.transcript).toBe(meta.transcript)
    expect(args.data.durationSec).toBe(245)
    expect(args.data.questions.create).toEqual([
      { order: 1, questionText: "Q1", userAnswer: "A1" },
    ])
  })

  it("company 已存在 → 复用不重建", async () => {
    mockDb.company.findFirst.mockResolvedValue({ id: "c_exist" })
    mockDb.interview.create.mockResolvedValue({ id: "iv2" })

    await persistVideoInterview("u1", meta, mockDb as never)
    expect(mockDb.company.create).not.toHaveBeenCalled()
    expect(mockDb.interview.create.mock.calls[0][0].data.companyId).toBe("c_exist")
  })

  it("空转写 → 返回 null 不落库", async () => {
    const id = await persistVideoInterview("u1", { ...meta, transcript: "  " }, mockDb as never)
    expect(id).toBeNull()
    expect(mockDb.interview.create).not.toHaveBeenCalled()
  })

  it("无题目（只候选人说话）→ 仍落库转写，无 questions 键", async () => {
    mockDb.company.findFirst.mockResolvedValue({ id: "c1" })
    mockDb.interview.create.mockResolvedValue({ id: "iv3" })

    await persistVideoInterview("u1", { ...meta, transcript: "候选人：只有我说话" }, mockDb as never)
    const args = mockDb.interview.create.mock.calls[0][0]
    expect(args.data.transcript).toBe("候选人：只有我说话")
    expect(args.data.questions).toBeUndefined()
  })

  it("draft 落库不含评估字段（画像由后续 AI 复盘驱动）", async () => {
    mockDb.company.findFirst.mockResolvedValue({ id: "c1" })
    mockDb.interview.create.mockResolvedValue({ id: "iv4" })

    await persistVideoInterview("u1", meta, mockDb as never)
    const args = mockDb.interview.create.mock.calls[0][0]
    expect(args.data).not.toHaveProperty("aiScore")
    expect(args.data).not.toHaveProperty("overallScore")
    expect(args.data).not.toHaveProperty("overallFeedback")
  })
})
