import { describe, it, expect } from "vitest"
import {
  firstCustomQuestion,
  advanceCustom,
  buildCustomRespondPrompt,
  type MockSession,
} from "@/lib/ai-mock"
import type { BankQuestion } from "@/lib/question-bank"

// ── 构造自定义会话（questions 只预置首题，随 advanceCustom 逐题 push） ──
function makeSession(bank: BankQuestion[]): MockSession {
  return {
    id: "custom_1",
    company: "某公司",
    position: "后端开发",
    roundType: "custom",
    questions: [firstCustomQuestion(bank)],
    customBank: bank,
    currentRound: 1,
    startedAt: "2026-09-01T00:00:00.000Z",
  }
}

describe("firstCustomQuestion", () => {
  it("首题含参考答案 → MockQA 带 referenceAnswer，answer 留空（A1 不污染用户作答）", () => {
    const qa = firstCustomQuestion([{ question: "请你介绍一下你自己", answer: "参考要点：STAR" }])
    expect(qa).toEqual({
      question: "请你介绍一下你自己",
      referenceAnswer: "参考要点：STAR",
      answer: undefined,
      category: "custom",
      round: 1,
    })
  })

  it("首题无参考答案 → 不含 referenceAnswer 字段", () => {
    const qa = firstCustomQuestion([{ question: "为什么离开上一家公司" }])
    expect(qa).toEqual({
      question: "为什么离开上一家公司",
      answer: undefined,
      category: "custom",
      round: 1,
    })
    expect("referenceAnswer" in qa).toBe(false)
  })
})

describe("advanceCustom", () => {
  const bank: BankQuestion[] = [
    { question: "第一题：请介绍你的项目", answer: "要点A" },
    { question: "第二题：为什么离开上一家公司" },
    { question: "第三题：你的职业规划是什么" },
  ]

  it("3 题走表：逐题推进，返回下一题并自增 currentRound", () => {
    const s = makeSession(bank)
    expect(s.currentRound).toBe(1)

    const r1 = advanceCustom(s)
    expect(r1.isComplete).toBe(false)
    expect(r1.next?.question).toBe("第二题：为什么离开上一家公司")
    expect(s.questions).toHaveLength(2)
    expect(s.currentRound).toBe(2)

    const r2 = advanceCustom(s)
    expect(r2.isComplete).toBe(false)
    expect(r2.next?.question).toBe("第三题：你的职业规划是什么")
    expect(s.questions).toHaveLength(3)
    expect(s.currentRound).toBe(3)
  })

  it("到底 → isComplete，不越界 push", () => {
    const s = makeSession(bank)
    advanceCustom(s)
    advanceCustom(s)
    const r3 = advanceCustom(s)
    expect(r3.isComplete).toBe(true)
    expect(r3.next).toBeUndefined()
    expect(s.questions).toHaveLength(3)
    expect(s.currentRound).toBe(3)
  })

  it("单题题库 → 首答后即到底", () => {
    const s = makeSession([{ question: "唯一一题：请自我介绍" }])
    const r = advanceCustom(s)
    expect(r.isComplete).toBe(true)
    expect(s.questions).toHaveLength(1)
  })
})

describe("buildCustomRespondPrompt", () => {
  it("包含题干 + 作答 + 只输出反馈指令（AI 不接续出题）", () => {
    const p = buildCustomRespondPrompt("第一题：请介绍你的项目", "我的回答内容")
    expect(p).toContain("第一题：请介绍你的项目")
    expect(p).toContain("我的回答内容")
    expect(p).toContain("不要提出下一个问题")
  })

  it("提供参考要点 → 反馈 prompt 注入对比要点", () => {
    const p = buildCustomRespondPrompt("第一题：请介绍你的项目", "我的回答内容", "参考要点：STAR 结构")
    expect(p).toContain("参考要点：STAR 结构")
  })

  it("未提供参考要点 → 不注入", () => {
    const p = buildCustomRespondPrompt("第一题：请介绍你的项目", "我的回答内容")
    expect(p).not.toContain("参考要点")
  })

  it("压力模式 → 追加压力面后缀", () => {
    const p = buildCustomRespondPrompt("第一题：请介绍你的项目", "我的回答内容", undefined, true)
    expect(p).toContain("压力面试")
  })
})
