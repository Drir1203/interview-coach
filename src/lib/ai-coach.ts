import prisma from "@/lib/db"
import { ROUND_TYPE_LABELS, INTERVIEW_RESULTS } from "@/types"
import { ANON_USER_IDS, getTier } from "@/lib/tier"
import {
  AiQuotaError,
  AI_DAILY_TOKEN_LIMIT,
  AI_SINGLE_REQUEST_TOKEN_LIMIT,
  AI_RATE_LIMIT,
  FixedWindowRateLimiter,
  checkDailyQuota,
  checkSingleQuota,
  estimateMessagesTokens,
  estimateTokens,
  normalizeUsage,
} from "@/lib/payment/ai-quota"
import { buildProviderChain, type AiProvider } from "@/lib/payment/ai-model-tier"

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

// ────────── 多模型链调用(OpenAI 兼容 / Anthropic) ──────────

// 链上每次调用的结构化结果：真实 usage 优先，缺失时用估算兜底（供计量写入）
interface ChainResult {
  content: string
  model: string // deepseek | qwen | anthropic | mock
  inputTokens: number
  outputTokens: number
}

async function callOpenAICompatible(
  system: string,
  messages: CoachMessage[],
  apiKey: string,
  baseUrl: string,
  model: string,
  provider: "deepseek" | "qwen"
): Promise<ChainResult> {
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
  const usage = normalizeUsage("openai", data.usage)
  return {
    content,
    model: provider,
    inputTokens: usage?.inputTokens ?? estimateMessagesTokens(messages, system),
    outputTokens: usage?.outputTokens ?? estimateTokens(content),
  }
}

async function callAnthropic(
  system: string,
  messages: CoachMessage[],
  apiKey: string
): Promise<ChainResult> {
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
  const usage = normalizeUsage("anthropic", data.usage)
  return {
    content,
    model: "anthropic",
    inputTokens: usage?.inputTokens ?? estimateMessagesTokens(messages, system),
    outputTokens: usage?.outputTokens ?? estimateTokens(content),
  }
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

// 按序尝试 provider 链，全部失败则 mock 兜底。chain 为 null 时用全链（匿名豁免路径）。
async function runChain(
  system: string,
  messages: CoachMessage[],
  mockFn: MockFn | undefined,
  chain: AiProvider[] | null
): Promise<ChainResult> {
  const order: AiProvider[] = chain ?? ["deepseek", "qwen", "anthropic"]
  for (const provider of order) {
    try {
      if (provider === "deepseek") {
        const key = process.env.DEEPSEEK_API_KEY
        if (!key) continue
        return await callOpenAICompatible(system, messages, key, "https://api.deepseek.com/v1", "deepseek-chat", "deepseek")
      }
      if (provider === "qwen") {
        const key = process.env.DASHSCOPE_API_KEY
        if (!key) continue
        return await callOpenAICompatible(system, messages, key, "https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-max", "qwen")
      }
      if (provider === "anthropic") {
        const key = process.env.ANTHROPIC_API_KEY
        if (!key) continue
        return await callAnthropic(system, messages, key)
      }
    } catch (err) {
      console.error(`${provider} 调用失败,尝试备用:`, err)
    }
  }

  // 无可用 Key → Mock 兜底
  await new Promise((r) => setTimeout(r, 800))
  const content = mockFn ? mockFn(messages) : "（当前未配置 AI API Key,无法生成内容。）"
  return { content, model: "mock", inputTokens: 0, outputTokens: 0 }
}

// 限流器：单实例进程内固定窗口（同 admin/login 模式）
const aiRateLimiter = new FixedWindowRateLimiter(AI_RATE_LIMIT.perMinute, AI_RATE_LIMIT.windowMs)

export interface ChatOptions {
  userId?: string
  feature?: string // coach | report | prep | experience | application
}

// 计量 + 限流 + 模型分层（CP2/CP3/CP4/D4）：
// 先限流 → 再查当日累计限额 → 再单次预估限额 → 按分层链调用 → 写入真实/估算用量。
async function meterAndCall(
  system: string,
  messages: CoachMessage[],
  mockFn: MockFn | undefined,
  opts: ChatOptions
): Promise<string> {
  const userId = opts.userId as string
  const feature = opts.feature || "coach"

  // CP4 分钟限流（统一档位）
  if (!aiRateLimiter.tryAcquire(userId, Date.now())) {
    throw new AiQuotaError("RATE_LIMITED", "操作太频繁，请稍后再试")
  }

  // 分层（D4）：Pro/所有者 = Claude 优先链；免费 = 仅廉价链，永不触 Claude
  const { tier, isOwner } = await getTier(userId)
  const effectiveTier = isOwner ? "pro" : tier
  const chain = buildProviderChain(effectiveTier, {
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    qwen: !!process.env.DASHSCOPE_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
  })

  // CP2 当日累计限额 + CP3 单次预估限额（所有者豁免 —— 自担成本，不设配额上限）
  if (!isOwner) {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const agg = await prisma.aiUsage.aggregate({
      where: { userId, createdAt: { gte: todayStart } },
      _sum: { inputTokens: true, outputTokens: true },
    })
    const usedToday = (agg._sum.inputTokens ?? 0) + (agg._sum.outputTokens ?? 0)
    const daily = checkDailyQuota(usedToday, AI_DAILY_TOKEN_LIMIT[tier])
    if (!daily.ok) throw new AiQuotaError(daily.code, daily.error)

    const estimated = estimateMessagesTokens(messages, system)
    const single = checkSingleQuota(estimated, AI_SINGLE_REQUEST_TOKEN_LIMIT[tier])
    if (!single.ok) throw new AiQuotaError(single.code, single.error)
  }

  // 调用分层链 + 写入计量（best-effort：计量是旁路副作用，失败不阻断已成功的回复）
  const result = await runChain(system, messages, mockFn, chain)
  try {
    await prisma.aiUsage.create({
      data: {
        userId,
        feature,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    })
  } catch (err) {
    console.error("AI 计量写入失败（不影响回复）:", err)
  }
  return result.content
}

export async function chatWithFallback(
  system: string,
  messages: CoachMessage[],
  mockFn?: MockFn,
  opts?: ChatOptions
): Promise<string> {
  const userId = opts?.userId
  // 匿名桶（__anon__/default）豁免计量与配额（D2），但限流 + 免费链仍生效（安全评审 C1）：
  // 匿名永不触 Claude，堵「退出登录即可白嫖最贵模型」的成本倒挂。
  if (userId && !ANON_USER_IDS.has(userId)) {
    return meterAndCall(system, messages, mockFn, { userId, feature: opts?.feature })
  }
  const anonKey = userId || "__anon__"
  if (!aiRateLimiter.tryAcquire(anonKey, Date.now())) {
    throw new AiQuotaError("RATE_LIMITED", "操作太频繁，请稍后再试")
  }
  const chain = buildProviderChain("free", {
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    qwen: !!process.env.DASHSCOPE_API_KEY,
    anthropic: false, // free 链永不含 anthropic；显式 false 双保险
  })
  const result = await runChain(system, messages, mockFn, chain)
  return result.content
}

// ────────── 主入口:教练对话 ──────────

export async function coachChat(userId: string, messages: CoachMessage[]): Promise<string> {
  const userContext = await buildUserContext(userId)
  const system = `${COACH_SYSTEM_PROMPT}\n\n## 【用户数据】\n${userContext}`
  return chatWithFallback(system, messages, mockCoachReply, { userId, feature: "coach" })
}
