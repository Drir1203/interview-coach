import type { AIReviewInput, AIReviewOutput } from "@/types"

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

## 输出格式
返回合法的 JSON 对象，不要包含 Markdown 代码块标记。`

function buildReviewPrompt(input: AIReviewInput): string {
  return `请分析以下面试记录：

## 面试背景
- 公司：${input.company}
- 岗位：${input.position}
- 轮次：${input.roundType}

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

请以 JSON 格式返回分析结果：
{
  "overallScore": <1-10>,
  "overallFeedback": "<总体评语，2-3句话>",
  "strengths": ["<优点1>", "<优点2>"],
  "improvementAreas": ["<改进方向1>", "<改进方向2>"],
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

// ---- Mock 模式：无 API Key 时使用，返回模拟数据 ----

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
    questions,
    weaknessAreas: [
      { category: "technical", score: 6.5, description: "技术深度可以进一步加强" },
      { category: "behavioral", score: 5.0, description: "缺少结构化表达" },
      { category: "project_deep_dive", score: 6.0, description: "项目细节准备不足" },
    ],
  }
}

// ---- AI 复盘（支持 API Key 从参数传入） ----

export async function aiReview(
  input: AIReviewInput
): Promise<AIReviewOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"
  const model = process.env.AI_MODEL || "claude-sonnet-4-20250514"

  // 无 API Key → Mock 模式（平台尚未配置）
  if (!apiKey) {
    await new Promise((r) => setTimeout(r, 1500))
    return generateMockReview(input)
  }

  const prompt = buildReviewPrompt(input)

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
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`AI API 调用失败: ${error}`)
  }

  const data = await response.json()
  const content = data.content?.[0]?.text

  if (!content) {
    throw new Error("AI 返回内容为空")
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error("AI 返回格式异常，无法解析")
  }

  return JSON.parse(jsonMatch[0]) as AIReviewOutput
}
