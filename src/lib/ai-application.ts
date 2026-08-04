import { chatWithFallback, buildUserContext, type CoachMessage } from "@/lib/ai-coach"

const STRATEGY_SYSTEM_PROMPT = `你是一位资深求职军师,有 10 年招聘与求职辅导经验。
你了解候选人的真实面试数据与能力画像(下方【用户数据】),请基于这些,为候选人当前在面的这家公司生成下一步行动策略。

## 输出要求(用 Markdown 输出,简洁可操作)
# {公司}·{岗位} 下一步行动

## 一、当前形势判断
- 用 1-2 句话点评:候选人在这家公司的进度、结合其真实能力画像的优势与风险

## 二、下一步该做什么(最优先 3 件事)
- 按优先级列出 3 条具体行动(如:准备哪类问题、复盘哪场面试、如何跟进)

## 三、轮次备战要点
- 针对当前轮次(一面/二面/HR面等),给出该轮考官通常看什么、怎么准备

## 四、跟进建议
- 如果等待结果/需要推进,给 1-2 条得体的跟进话术或动作

要求:基于候选人的真实数据,不要套模板;每条具体可执行。`

const ROUND_LABELS: Record<string, string> = {
  first: "一面", second: "二面", third: "三面", final: "终面",
  hr: "HR面", written: "笔试", other: "其他",
}

const STATUS_LABELS: Record<string, string> = {
  applied: "已投递", interviewing: "面试中", offer: "已拿 Offer", rejected: "已拒绝", closed: "已结束",
}

function buildStrategyPrompt(app: {
  company: string
  position: string
  status: string
  currentRound: string
  notes?: string
}, userContext: string): string {
  return `请为以下求职进度生成下一步行动策略。

## 当前求职进度
- 公司:${app.company}
- 岗位:${app.position}
- 状态:${STATUS_LABELS[app.status] || app.status}
- 当前轮次:${ROUND_LABELS[app.currentRound] || app.currentRound}
- 备注:${app.notes || "无"}

## 【用户数据】
${userContext}

请按输出要求生成 Markdown 策略。`
}

function mockStrategy(app: {
  company: string
  position: string
  status: string
  currentRound: string
}): string {
  return `# ${app.company} · ${app.position} 下一步行动(基础模式)

> 当前未配置 AI API Key,以下为通用建议。

## 一、当前形势判断
- 你正在推进 ${app.company} 的${ROUND_LABELS[app.currentRound] || app.currentRound},保持节奏,主动跟进。

## 二、下一步该做什么
1. 复盘最近一场该公司的面试,找出薄弱项
2. 针对下一轮高频题做 2-3 次模拟练习
3. 确认后续轮次的时间安排,提前准备

## 三、轮次备战要点
- ${ROUND_LABELS[app.currentRound] || app.currentRound}:重点准备该轮考察的能力(技术/项目/行为/HR)

## 四、跟进建议
- 面试后 1-2 天内发一条得体的感谢/跟进消息,体现主动。`
}

export interface ApplicationStrategyInput {
  company: string
  position: string
  status: string
  currentRound: string
  notes?: string
}

export async function generateApplicationStrategy(
  userId: string,
  app: ApplicationStrategyInput
): Promise<string> {
  const userContext = await buildUserContext(userId)
  const system = `${STRATEGY_SYSTEM_PROMPT}\n\n## 【用户数据】\n${userContext}`
  const prompt = buildStrategyPrompt(app, userContext)
  const messages: CoachMessage[] = [{ role: "user", content: prompt }]

  return chatWithFallback(system, messages, () => mockStrategy(app))
}
