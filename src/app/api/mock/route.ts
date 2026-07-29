import { NextRequest } from "next/server"
import {
  createMockSession,
  mockRespond,
  generateMockSummary,
  buildMockStartPrompt,
  buildMockRespondPrompt,
  buildMockSummaryPrompt,
} from "@/lib/ai-mock"

// 内存会话存储
const sessions = new Map<string, any>()

// POST /api/mock - 开始或继续模拟面试
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, sessionId, company, position, roundType, answer } = body

  const apiKey = process.env.ANTHROPIC_API_KEY || ""

  if (action === "start") {
    return handleStart(company, position, roundType, apiKey)
  }

  if (action === "respond") {
    return handleRespond(sessionId, answer, apiKey)
  }

  if (action === "end") {
    return handleEnd(sessionId, apiKey)
  }

  return Response.json({ error: "未知操作" }, { status: 400 })
}

async function handleStart(
  company: string,
  position: string,
  roundType: string,
  apiKey: string
) {
  // Mock 模式
  if (!apiKey) {
    const session = createMockSession(company, position, roundType)
    sessions.set(session.id, session)
    return Response.json({
      sessionId: session.id,
      question: session.questions[0].question,
      round: 1,
      totalRounds: 0,
      isComplete: false,
    })
  }

  // 真实 AI 模式
  try {
    const prompt = buildMockStartPrompt(company, position, roundType)
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!response.ok) throw new Error("AI 调用失败")

    const data = await response.json()
    const question = data.content?.[0]?.text || "请介绍一下你自己。"

    const sessionId = `real_${Date.now()}`
    sessions.set(sessionId, {
      id: sessionId,
      company,
      position,
      roundType,
      history: [
        { role: "assistant", content: question },
      ],
      startedAt: new Date().toISOString(),
    })

    return Response.json({
      sessionId,
      question,
      round: 1,
      isComplete: false,
    })
  } catch (err: any) {
    // 降级到 Mock
    const session = createMockSession(company, position, roundType)
    sessions.set(session.id, session)
    return Response.json({
      sessionId: session.id,
      question: session.questions[0].question,
      round: 1,
      isComplete: false,
    })
  }
}

async function handleRespond(sessionId: string, answer: string, apiKey: string) {
  const session = sessions.get(sessionId)
  if (!session) {
    return Response.json({ error: "面试会话不存在或已过期" }, { status: 404 })
  }

  // Mock 模式
  if (!apiKey || sessionId.startsWith("mock_")) {
    const result = mockRespond(session, answer)

    if (result.isComplete) {
      const summary = generateMockSummary(session)
      session.summary = summary
      session.endedAt = new Date().toISOString()
      return Response.json({
        feedback: result.feedback,
        isComplete: true,
        summary,
      })
    }

    // 返回下一个问题（如果有的话）
    const lastQA = session.questions[session.questions.length - 1]
    return Response.json({
      feedback: result.feedback,
      question: lastQA?.question,
      round: session.currentRound,
      isComplete: false,
      isFollowUp: result.isFollowUp,
    })
  }

  // 真实 AI 模式
  try {
    session.history.push({ role: "user", content: answer })

    const prompt = buildMockRespondPrompt(session.history, answer)
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!response.ok) throw new Error("AI 调用失败")

    const data = await response.json()
    const content = data.content?.[0]?.text || ""

    if (content.includes("[END]")) {
      const summaryPrompt = buildMockSummaryPrompt(session.history)
      const summaryRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          messages: [{ role: "user", content: summaryPrompt }],
        }),
      })
      const summaryData = await summaryRes.json()
      const summaryText = summaryData.content?.[0]?.text || ""

      let summary
      try {
        const jsonMatch = summaryText.match(/\{[\s\S]*\}/)
        if (jsonMatch) summary = JSON.parse(jsonMatch[0])
      } catch {}

      session.endedAt = new Date().toISOString()
      return Response.json({
        feedback: content.replace("[END]", "").trim(),
        isComplete: true,
        summary,
      })
    }

    session.history.push({ role: "assistant", content })
    return Response.json({
      feedback: "",
      question: content,
      isComplete: false,
    })
  } catch (err: any) {
    // 降级到 Mock
    const result = mockRespond(session, answer)
    if (result.isComplete) {
      const summary = generateMockSummary(session)
      return Response.json({ feedback: result.feedback, isComplete: true, summary })
    }
    const lastQA = session.questions[session.questions.length - 1]
    return Response.json({
      feedback: result.feedback,
      question: lastQA?.question,
      isComplete: false,
    })
  }
}

async function handleEnd(sessionId: string, apiKey: string) {
  const session = sessions.get(sessionId)
  if (!session) {
    return Response.json({ error: "面试会话不存在" }, { status: 404 })
  }

  if (!apiKey || sessionId.startsWith("mock_")) {
    const summary = generateMockSummary(session)
    session.summary = summary
    session.endedAt = new Date().toISOString()
    return Response.json({ summary })
  }

  try {
    const summaryPrompt = buildMockSummaryPrompt(session.history)
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [{ role: "user", content: summaryPrompt }],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || ""

    let summary
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) summary = JSON.parse(jsonMatch[0])
    } catch {}

    session.endedAt = new Date().toISOString()
    return Response.json({ summary })
  } catch {
    return Response.json({ summary: generateMockSummary(session) })
  }
}
