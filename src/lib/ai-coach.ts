import prisma from "@/lib/db"
import { ROUND_TYPE_LABELS, INTERVIEW_RESULTS } from "@/types"

export interface CoachMessage {
  role: "user" | "assistant"
  content: string
}

// ────────── 系统提示词:定位为"认识你的私人面试教练" ──────────

const COACH_SYSTEM_PROMPT = `你是一位资深的个人 AI 面试教练,在互联网行业有 10 年以上招聘和求职辅导经验。
你了解用户的真实面试历史、能力画像和薄弱项,基于这些给出一对一、可操作、有针对性的辅导,而不是泛泛而谈。

## 你的工作方式
- 优先基于用户的实际面试数据(下方【用户数据】)给出建议
- 能回答面试相关问题:如何回答某类问题、如何准备某家公司/岗位、如何改进薄弱项
- 指出用户的薄弱维度,给出具体的练习方法和优先级
- 诚实评估,不吹捧;同时保持鼓励
- 建议要具体可执行(比如具体的答题结构、要准备哪些量化数据、今天练什么)

## 对话规则
- 用中文回答,简洁、结构化(可用小标题和要点)
- 如果用户问与面试/求职无关的问题,礼貌地引导回面试辅导
- 不知道的不要编造`

// ────────── 加载用户上下文 ──────────

const ROUND_LABEL: Record<string, string> = {
  ...ROUND_TYPE_LABELS,
}
const RESULT_LABEL: Record<string, string> = Object.fromEntries(
  INTERVIEW_RESULTS.map((r) => [r.value, r.label])
)

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return ""
  return s.length > max ? s.slice(0, max) + "…" : s
}

export async function buildUserContext(userId: string): Promise<string> {
  const [recent, profiles, stats] = await Promise.all([
    prisma.interview.findMany({
      where: { userId, status: "ai_reviewed" },
      include: { company: true },
      orderBy: { date: "desc" },
      take: 8,
    }),
    prisma.userSkillProfile.findMany({ where: { userId } }),
    prisma.interview.aggregate({
      where: { userId, status: "ai_reviewed" },
      _avg: { overallScore: true },
      _count: true,
    }),
  ])

  const lines: string[] = []
  const total = await prisma.interview.count({ where: { userId } })
  const avg = stats._avg.overallScore
  lines.push(`用户面试概况:共 ${total} 场,已复盘 ${recent.length} 场,平均分 ${avg ? avg.toFixed(1) : "暂无"}`)

  if (recent.length > 0) {
    lines.push("\n最近面试(按时间倒序):")
    for (const iv of recent) {
      const weak =
        iv.weaknessAreas && iv.weaknessAreas !== "[]"
          ? (() => {
              try {
                const areas = JSON.parse(iv.weaknessAreas) as { category?: string }[]
                return areas.map((a) => a.category ?? "").filter(Boolean).slice(0, 2).join("、")
              } catch {
                return ""
              }
            })()
          : ""
      lines.push(
        `- ${iv.company.name}/${iv.position}/${ROUND_LABEL[iv.roundType] || iv.roundType}/` +
          `${RESULT_LABEL[iv.result || ""] || "未知"}/` +
          `${iv.overallScore ? iv.overallScore.toFixed(1) + "分" : "未评分"}` +
          (weak ? `(薄弱:${weak})` : "")
      )
      if (iv.overallFeedback) lines.push(`  反馈:${truncate(iv.overallFeedback, 120)}`)
    }
  }

  if (profiles.length > 0) {
    lines.push("\n能力画像(按平均分从低到高):")
    const sorted = [...profiles].sort((a, b) => a.averageScore - b.averageScore)
    for (const p of sorted) {
      lines.push(
        `- ${p.category}: ${p.averageScore.toFixed(1)} (${p.interviewCount}场)${p.interviewCount > 0 ? "" : ""}`
      )
    }
  }

  if (lines.length === 0) {
    return "用户还没有已复盘的面试记录。请先引导用户完成第一场面试的复盘,或进行模拟面试练习。"
  }
  return lines.join("\n")
}

// ────────── 多模型链调用(OpenAI 兼容) ──────────

async function callOpenAICompatible(
  system: string,
  messages: CoachMessage[],
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<string> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      max_tokens: 1500,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`${model} 调用失败: ${error}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error("AI 返回内容为空")
  return content
}

async function callAnthropic(
  system: string,
  messages: CoachMessage[],
  apiKey: string
): Promise<string> {
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"
  const model = process.env.AI_MODEL || "claude-sonnet-4-20250514"

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      temperature: 0.7,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic 调用失败: ${error}`)
  }

  const data = await response.json()
  const content = data.content?.[0]?.text
  if (!content) throw new Error("AI 返回内容为空")
  return content
}

// ────────── Mock 兜底 ──────────

function mockCoachReply(messages: CoachMessage[]): string {
  const last = messages.filter((m) => m.role === "user").pop()?.content || ""
  const lines = [
    "（当前未配置 AI API Key,正在使用基础模式）",
    "",
    "根据你的情况,建议按以下方向准备:",
    "1. **结构化表达**:用 STAR 法则组织回答(情境-任务-行动-结果),避免流水账",
    "2. **项目深挖**:为每个项目准备 2-3 个量化数据(性能提升%、规模、收益),应对「为什么这么设计」的追问",
    "3. **薄弱项强化**:优先练习 Behavioral 类问题(自我介绍、最大挑战、团队冲突)",
    "",
    `你问的是:"${truncate(last, 80)}"`,
    "配置 AI Key 后(平台已接入 DeepSeek/DashScope/Claude),我可以基于你的真实面试记录给出针对性建议。",
  ]
  return lines.join("\n")
}

// ────────── 多模型链通用入口(供教练/押题/报告复用) ──────────

// 无 Key 时的兜底(由各功能提供自己的 mock 回复)
type MockFn = (messages: CoachMessage[]) => string

export async function chatWithFallback(
  system: string,
  messages: CoachMessage[],
  mockFn?: MockFn
): Promise<string> {
  // 1. DeepSeek(首选)
  const deepseekKey = process.env.DEEPSEEK_API_KEY
  if (deepseekKey) {
    try {
      return await callOpenAICompatible(system, messages, deepseekKey, "https://api.deepseek.com/v1", "deepseek-chat")
    } catch (err) {
      console.error("DeepSeek 调用失败,尝试备用:", err)
    }
  }

  // 2. DashScope(Qwen)
  const dashscopeKey = process.env.DASHSCOPE_API_KEY
  if (dashscopeKey) {
    try {
      return await callOpenAICompatible(
        system, messages, dashscopeKey, "https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-max"
      )
    } catch (err) {
      console.error("DashScope 调用失败,尝试备用:", err)
    }
  }

  // 3. Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey) {
    try {
      return await callAnthropic(system, messages, anthropicKey)
    } catch (err) {
      console.error("Anthropic 调用失败:", err)
    }
  }

  // 无可用 Key → Mock 兜底
  await new Promise((r) => setTimeout(r, 800))
  return mockFn ? mockFn(messages) : "（当前未配置 AI API Key,无法生成内容。）"
}

// ────────── 主入口:教练对话 ──────────

export async function coachChat(userId: string, messages: CoachMessage[]): Promise<string> {
  const userContext = await buildUserContext(userId)
  const system = `${COACH_SYSTEM_PROMPT}\n\n## 【用户数据】\n${userContext}`
  return chatWithFallback(system, messages, mockCoachReply)
}
