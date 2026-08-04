import type {
  AIReviewInput,
  AIReviewOutput,
  AIReviewQuestionInput,
  AIReviewQuestionOutput,
} from "@/types"

const SYSTEM_PROMPT = `你是一位资深的技术面试官，在互联网行业有10年以上招聘经验。
你将分析一场面试记录，给出客观、建设性的反馈。

## 评分标准
- 9-10 分：回答有深度、有结构、有亮点，超出预期
- 7-8 分：回答完整清晰，逻辑通顺，有具体案例
- 5-6 分：回答基本正确，但缺乏深度或具体支撑
- 3-4 分：回答笼统、空泛、缺乏具体内容
- 1-2 分：答非所问或明显准备不足

## 评分原则
- 不要所有问题都给中高分，要真实反映水平
- 对于明显背诵套话的回答适当降分
- 优化回答要可操作，是该候选人真实能说出来的水平
- 优先指出 1-2 个最关键改进点，而不是列一堆

## 简历参照
- 提供候选人简历时，将回答与其简历中的项目经历、技能、岗位背景对照评估
- 若简历明确写了某技能/项目但回答完全未体现，在对应问题的 feedback 中指出"简历写了 X 但未展开"
- 优化回答（improvedAnswer）必须贴合该候选人简历中的真实经历，不要编造简历之外的能力
- 简历仅作为评分背景，不额外增加输出维度

## 输出格式
返回合法的 JSON 对象，不要包含 Markdown 代码块标记。`

// 单题深入复盘的专用提示词：只分析一道题，要求更充分展开
const QUESTION_SYSTEM_PROMPT = `你是一位资深的技术面试官，在互联网行业有10年以上招聘经验。你正在对某一道面试题的回答做深入复盘。

## 分析深度要求
- 逐点拆解回答，指出每一处的优点与不足，不要笼统带过
- 结合候选人简历中的项目经历、技能、岗位背景来评估（提供简历时）
- 给出可落地的优化回答，是该候选人真实能说出来的水平，不要编造简历之外的能力
- 评分标准：9-10 有深度有亮点；7-8 完整清晰有案例；5-6 基本正确缺深度；3-4 笼统空泛；1-2 答非所问
- 若用户提供了附加要求，必须严格按附加要求的方向来调整分析重点与篇幅

## 输出格式
返回合法的 JSON 对象，不要包含 Markdown 代码块标记。`

function buildReviewPrompt(input: AIReviewInput): string {
  const instruction = input.instruction?.trim()
  return `请分析以下面试记录：

## 面试背景
- 公司：${input.company}
- 岗位：${input.position}
- 轮次：${input.roundType}
${input.resumeText?.trim() ? `\n## 候选人简历背景\n${input.resumeText.trim()}\n` : ""}
## 面试问题与回答
${input.questions
  .map(
    (q, i) => `
### 问题 ${i + 1}
面试官：${q.questionText}
候选人：${q.userAnswer || "（未记录回答）"}
`
  )
  .join("\n")}
${instruction ? `\n## 用户附加要求（必须遵循）\n${instruction}\n` : ""}
请以 JSON 格式返回分析结果：
{
  "overallScore": <1-10>,
  "overallFeedback": "<总体评语，2-3句话>",
  "strengths": ["<优点1>", "<优点2>"],
  "improvementAreas": ["<改进方向1>", "<改进方向2>"],
  "nextSteps": "<1-2句：基于本次复盘，接下来最该练什么、怎么练>",
  "questions": [
    {
      "index": 0,
      "score": <1-10>,
      "feedback": "<评分理由>",
      "improvedAnswer": "<优化回答>",
      "category": "technical|behavioral|project_deep_dive|system_design|hr|other",
      "keyMistake": "<关键失误点，没有则留空>"
    }
  ],
  "weaknessAreas": [
    {
      "category": "technical|behavioral|project_deep_dive|system_design|hr",
      "score": <1-10>,
      "description": "<该维度短板描述>"
    }
  ]
}`
}

function buildQuestionReviewPrompt(input: AIReviewQuestionInput): string {
  const instruction = input.instruction?.trim()
  return `请深入分析下面这道面试题的回答：

## 面试背景
- 公司：${input.company}
- 岗位：${input.position}
- 轮次：${input.roundType}
${input.resumeText?.trim() ? `\n## 候选人简历背景\n${input.resumeText.trim()}\n` : ""}
## 待分析题目
面试官：${input.question.questionText}
候选人：${input.question.userAnswer || "（未记录回答）"}
${instruction ? `\n## 用户附加要求（必须遵循）\n${instruction}\n` : ""}
请以 JSON 格式返回对这一道题的分析结果：
{
  "score": <1-10>,
  "feedback": "<评分理由，深入、具体，逐点分析回答的优劣，不要敷衍>",
  "improvedAnswer": "<优化后的回答，贴合候选人真实水平，可操作>",
  "category": "technical|behavioral|project_deep_dive|system_design|hr|other",
  "keyMistake": "<关键失误点，没有则留空>"
}`
}

// ---- Mock 模式 ----

function generateMockReview(input: AIReviewInput): AIReviewOutput {
  const questions = input.questions.map((q, i) => {
    const hasAnswer = !!q.userAnswer && q.userAnswer.length > 10
    const score = hasAnswer ? 5 + Math.round(Math.random() * 4) : 2 + Math.round(Math.random() * 3)
    return {
      index: i,
      score,
      feedback: hasAnswer
        ? "回答基本完整，结构清晰，如果能补充具体的数据或案例会更有说服力。"
        : "未记录回答，建议面试后立即补充回答内容以便AI给出更有针对性的反馈。",
      improvedAnswer: hasAnswer
        ? "感谢面试官的提问。关于这个问题，我从以下几个方面来回答：\n1. 首先，...\n2. 其次，...\n3. 最后，...\n总的来说，我的核心观点是..."
        : undefined,
      category: ["technical", "behavioral", "project_deep_dive", "system_design", "hr", "other"][i % 6],
      keyMistake: hasAnswer ? undefined : "缺少具体回答内容",
    }
  })

  const overallScore = Math.round((questions.reduce((s, q) => s + q.score, 0) / questions.length) * 10) / 10

  return {
    overallScore,
    overallFeedback: `总体表现${overallScore >= 7 ? "不错" : "还有提升空间"}。回答${overallScore >= 7 ? "基本覆盖了核心要点" : "需要更深入和结构化"}。建议多在项目深挖和Behavioral问题上准备具体案例。`,
    strengths: overallScore >= 7
      ? ["技术基础扎实", "回答有结构逻辑清晰"]
      : ["态度积极", "有基本的技术认知"],
    improvementAreas: ["建议使用 STAR 法则回答 Behavioral 问题", "项目经验需要准备更多量化数据"],
    nextSteps: "接下来优先用 STAR 法则打磨 2 个最有代表性的项目案例,并每天练 1 道行为面试题口述录音。",
    questions,
    weaknessAreas: [
      { category: "technical", score: 6.5, description: "技术深度可以进一步加强" },
      { category: "behavioral", score: 5.0, description: "缺少结构化表达" },
      { category: "project_deep_dive", score: 6.0, description: "项目细节准备不足" },
    ],
  }
}

function generateMockQuestionReview(input: AIReviewQuestionInput): AIReviewQuestionOutput {
  const hasAnswer = !!input.question.userAnswer && input.question.userAnswer.length > 10
  const score = hasAnswer ? 5 + Math.round(Math.random() * 4) : 2 + Math.round(Math.random() * 3)
  return {
    score,
    feedback: hasAnswer
      ? "回答方向正确，但论证偏概括，缺乏具体支撑。建议补充可量化的数据或真实项目案例，并用「背景—方案—效果」的结构组织语言，逻辑会更完整、更有说服力。"
      : "未记录回答，建议补充回答内容以便 AI 给出更有针对性的深入分析。",
    improvedAnswer: hasAnswer
      ? "感谢面试官的提问。关于这个问题，我从背景、方案、效果三个层面回答：\n1. 背景：当时遇到的问题是……\n2. 方案：我采用了……，并重点处理了……\n3. 效果：最终……，关键指标提升了……\n总的来说，我的核心结论是……"
      : undefined,
    category: "technical",
    keyMistake: hasAnswer ? undefined : "缺少具体回答内容",
  }
}

// ---- 底层模型调用（OpenAI 兼容 / Anthropic），返回原始 JSON ----

async function callOpenAICompatible(
  system: string,
  userPrompt: string,
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<unknown> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`${model} 调用失败: ${error}`)
  }

  const data = await response.json()
  const content =
    data?.choices?.[0]?.message?.content || data?.output?.choices?.[0]?.message?.content
  if (!content) throw new Error("AI 返回内容为空")

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("AI 返回格式异常")

  return JSON.parse(jsonMatch[0])
}

async function callAnthropic(system: string, userPrompt: string, apiKey: string): Promise<unknown> {
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
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`AI API 调用失败: ${error}`)
  }

  const data = await response.json()
  const content = data.content?.[0]?.text
  if (!content) throw new Error("AI 返回内容为空")

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("AI 返回格式异常")

  return JSON.parse(jsonMatch[0])
}

// ---- 多模型链路（DeepSeek → DashScope → Anthropic → Mock） ----

async function runModelChain<T>(
  system: string,
  userPrompt: string,
  mock: () => T
): Promise<T> {
  const parse = (raw: unknown): T => raw as T

  // 1. DeepSeek（用户首选）
  const deepseekKey = process.env.DEEPSEEK_API_KEY
  if (deepseekKey) {
    try {
      return parse(
        await callOpenAICompatible(system, userPrompt, deepseekKey, "https://api.deepseek.com/v1", "deepseek-chat")
      )
    } catch (err) {
      console.error("DeepSeek 调用失败，尝试备用方案:", err)
    }
  }

  // 2. DashScope（Qwen）
  const dashscopeKey = process.env.DASHSCOPE_API_KEY
  if (dashscopeKey) {
    try {
      const qwenModel = process.env.AI_MODEL?.startsWith("qwen") ? process.env.AI_MODEL : "qwen-max"
      return parse(
        await callOpenAICompatible(
          system, userPrompt, dashscopeKey, "https://dashscope.aliyuncs.com/compatible-mode/v1", qwenModel
        )
      )
    } catch (err) {
      console.error("DashScope AI 调用失败，尝试备用方案:", err)
    }
  }

  // 3. Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey) {
    try {
      return parse(await callAnthropic(system, userPrompt, anthropicKey))
    } catch (err) {
      console.error("Anthropic AI 调用失败:", err)
    }
  }

  // 无可用 Key → Mock 模式
  await new Promise((r) => setTimeout(r, 1500))
  return mock()
}

// ---- 对外导出函数 ----

export async function aiReview(input: AIReviewInput): Promise<AIReviewOutput> {
  return runModelChain<AIReviewOutput>(SYSTEM_PROMPT, buildReviewPrompt(input), () =>
    generateMockReview(input)
  )
}

// 单题重新生成分析（支持用户自定义要求）
export async function aiReviewQuestion(input: AIReviewQuestionInput): Promise<AIReviewQuestionOutput> {
  return runModelChain<AIReviewQuestionOutput>(QUESTION_SYSTEM_PROMPT, buildQuestionReviewPrompt(input), () =>
    generateMockQuestionReview(input)
  )
}
