import { describe, it, expect, vi, beforeEach } from "vitest"

// 在 import mock-persist 前 mock @/lib/db，避免实例化真实 PrismaClient
const mockDb = vi.hoisted(() => ({
  company: { findFirst: vi.fn(), create: vi.fn() },
  interview: { create: vi.fn() },
}))

vi.mock("@/lib/db", () => ({ default: mockDb }))

// 被 persistMockInterview 调用的 updateSkillProfile 用 spy 隔离（不真正查库）
import * as skillProfile from "@/lib/skill-profile"
import {
  pairHistoryForMock,
  buildMockInterviewInput,
  persistMockInterview,
} from "@/lib/mock-persist"
import type { MockSession } from "@/lib/ai-mock"

const updateSpy = vi.spyOn(skillProfile, "updateSkillProfile")
updateSpy.mockResolvedValue()

beforeEach(() => {
  vi.clearAllMocks()
})

// ── 构造一个"已结束"的 mock 会话（模拟模式：questions 全量含追问） ──
const summary = {
  overallScore: 7.5,
  totalQuestions: 2,
  strengths: ["回答问题有结构", "技术基础扎实"],
  improvementAreas: ["用 STAR 法则组织回答", "增加量化数据"],
  questionScores: [
    { question: "自我介绍", score: 8, feedback: "结构清晰" },
    { question: "为什么离开上一家公司", score: 6, feedback: "可以更具体" },
  ],
}

const mockSession: MockSession = {
  id: "mock_1",
  company: "字节跳动",
  position: "后端开发",
  roundType: "first",
  currentRound: 2,
  startedAt: "2026-08-28T00:00:00.000Z",
  summary,
  questions: [
    {
      question: "自我介绍",
      answer: "我有5年后端开发经验，精通Java和Go",
      feedback: "结构清晰",
      category: "behavioral",
      round: 1,
    },
    {
      question: "为什么离开上一家公司",
      answer: "寻求更大的挑战和成长空间",
      feedback: "可以更具体",
      category: "hr",
      round: 2,
    },
  ],
}

describe("pairHistoryForMock", () => {
  it("assistant/user 交替 → 配对成 question/answer", () => {
    const history = [
      { role: "assistant" as const, content: "Q1" },
      { role: "user" as const, content: "A1" },
      { role: "assistant" as const, content: "反馈Q2" },
      { role: "user" as const, content: "A2" },
    ]
    expect(pairHistoryForMock(history)).toEqual([
      { question: "Q1", answer: "A1" },
      { question: "反馈Q2", answer: "A2" },
    ])
  })

  it("开头 user / 结尾 assistant 悬挂 → 丢弃不成对", () => {
    const history = [
      { role: "user" as const, content: "A0" },
      { role: "assistant" as const, content: "Q1" },
      { role: "user" as const, content: "A1" },
      { role: "assistant" as const, content: "Q2" },
    ]
    expect(pairHistoryForMock(history)).toEqual([{ question: "Q1", answer: "A1" }])
  })

  it("空 history → 空数组", () => {
    expect(pairHistoryForMock([])).toEqual([])
  })
})

describe("buildMockInterviewInput", () => {
  it("mock 会话 → Interview create 数据（type/status/总分/优缺/逐题）", () => {
    const input = buildMockInterviewInput(mockSession)!
    expect(input).not.toBeNull()
    expect(input.type).toBe("mock")
    expect(input.status).toBe("ai_reviewed")
    expect(input.companyName).toBe("字节跳动")
    expect(input.position).toBe("后端开发")
    expect(input.roundType).toBe("first")
    expect(input.overallScore).toBe(7.5)
    expect(input.strengths).toBe(JSON.stringify(summary.strengths))
    expect(input.improvementAreas).toBe(JSON.stringify(summary.improvementAreas))
    expect(input.weaknessAreas).toBeNull()
    expect(input.questions).toHaveLength(2)
    expect(input.questions[0]).toMatchObject({
      order: 1,
      questionText: "自我介绍",
      userAnswer: "我有5年后端开发经验，精通Java和Go",
      aiScore: 8,
      aiFeedback: "结构清晰",
      aiCategory: "behavioral",
    })
    expect(input.questions[1]).toMatchObject({
      order: 2,
      aiScore: 6,
      aiCategory: "hr",
    })
  })

  it("questionScores 未覆盖的题 → aiScore/aiFeedback 为 null（不入画像统计）", () => {
    const s: MockSession = {
      ...mockSession,
      questions: [
        ...mockSession.questions,
        { question: "追问问你具体怎么权衡", category: "system_design", round: 2 },
      ],
    }
    const input = buildMockInterviewInput(s)!
    const last = input.questions[input.questions.length - 1]
    expect(last.aiScore).toBeNull()
    expect(last.aiFeedback).toBeNull()
    expect(last.aiCategory).toBe("system_design")
  })

  it("real-AI 会话（只有 history）→ 按配对生成题目", () => {
    const s: MockSession = {
      ...mockSession,
      questions: undefined as unknown as MockSession["questions"],
      history: [
        { role: "assistant", content: "Q1" },
        { role: "user", content: "A1" },
      ],
    }
    const input = buildMockInterviewInput(s)!
    expect(input.questions).toHaveLength(1)
    expect(input.questions[0]).toMatchObject({
      questionText: "Q1",
      userAnswer: "A1",
      aiCategory: "other",
    })
  })

  it("无题目 → 返回 null（不入库）", () => {
    expect(buildMockInterviewInput({ ...mockSession, questions: [] })).toBeNull()
  })

  it("无 summary → 返回 null（不入库）", () => {
    const s: MockSession = { ...mockSession, summary: undefined }
    expect(buildMockInterviewInput(s)).toBeNull()
  })
})

describe("persistMockInterview", () => {
  it("company 不存在 → find-or-create + 创建 Interview+questions + 调 updateSkillProfile", async () => {
    mockDb.company.findFirst.mockResolvedValue(null)
    mockDb.company.create.mockResolvedValue({ id: "c1" })
    mockDb.interview.create.mockResolvedValue({ id: "iv1" })

    const id = await persistMockInterview("u1", mockSession, mockDb as never)

    expect(id).toBe("iv1")
    expect(mockDb.company.create).toHaveBeenCalledWith({ data: { name: "字节跳动" } })
    const createArgs = mockDb.interview.create.mock.calls[0][0]
    expect(createArgs.data.type).toBe("mock")
    expect(createArgs.data.status).toBe("ai_reviewed")
    expect(createArgs.data.userId).toBe("u1")
    expect(createArgs.data.companyId).toBe("c1")
    expect(createArgs.data.questions.create).toHaveLength(2)
    expect(createArgs.data.questions.create[0]).toMatchObject({
      order: 1,
      questionText: "自我介绍",
      aiCategory: "behavioral",
      aiScore: 8,
    })
    // updateSkillProfile 以注入的 db 调用（画像闭环）
    expect(updateSpy).toHaveBeenCalledWith("u1", mockDb)
  })

  it("company 已存在 → 复用，不重复创建", async () => {
    mockDb.company.findFirst.mockResolvedValue({ id: "c_exist" })
    mockDb.interview.create.mockResolvedValue({ id: "iv2" })

    await persistMockInterview("u1", mockSession, mockDb as never)
    expect(mockDb.company.create).not.toHaveBeenCalled()
    expect(mockDb.interview.create.mock.calls[0][0].data.companyId).toBe("c_exist")
  })

  it("无题会话 → 不创建 interview，返回 null", async () => {
    const id = await persistMockInterview("u1", { ...mockSession, questions: [] }, mockDb as never)
    expect(id).toBeNull()
    expect(mockDb.interview.create).not.toHaveBeenCalled()
    expect(updateSpy).not.toHaveBeenCalled()
  })
})
