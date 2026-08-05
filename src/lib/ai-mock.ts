// AI 模拟面试引擎

export interface MockSession {
  id: string
  company: string
  position: string
  roundType: string
  questions: MockQA[]
  currentRound: number
  startedAt: string
  endedAt?: string
  summary?: MockSummary
}

export interface MockQA {
  question: string
  answer?: string
  feedback?: string
  category: string
  round: number
}

export interface MockSummary {
  overallScore: number
  totalQuestions: number
  strengths: string[]
  improvementAreas: string[]
  questionScores: { question: string; score: number; feedback: string }[]
}

// 面试题库
const QUESTION_BANK: Record<string, string[]> = {
  technical: [
    "请介绍一下你最有挑战性的一个技术项目，你在其中扮演了什么角色？",
    "Java 中 HashMap 和 ConcurrentHashMap 的区别是什么？",
    "你如何理解 RESTful API 设计？请举例说明好的设计 vs 不好的设计。",
    "MySQL 中索引的原理是什么？什么情况下索引会失效？",
    "你用过哪些设计模式？在什么场景下使用过？",
    "谈谈你对微服务架构的理解，它有哪些优缺点？",
    "如何保证缓存（Redis）和数据库的数据一致性？",
    "你如何做系统性能调优？请分享一个具体案例。",
    "说说你对分布式事务的理解，有哪些解决方案？",
    "如果让你设计一个短链接系统，你会怎么设计？",
  ],
  behavioral: [
    "请做一个简单的自我介绍。",
    "你为什么离开上一家公司？",
    "你的职业规划是什么？未来3年想达到什么目标？",
    "说说你过去工作中遇到的最大困难，你是怎么解决的？",
    "你如何看待加班？",
    "你和同事产生过意见冲突吗？你是怎么处理的？",
    "你期望的薪资是多少？",
    "你觉得自己的优点和缺点分别是什么？",
    "如果让你重新选择一次，你会选择什么职业道路？",
    "你有什么想问我们的吗？",
  ],
  project_deep_dive: [
    "讲一个你最有成就感的项目，详细说说你的贡献。",
    "这个项目的技术选型是怎么做的？为什么选这些技术？",
    "项目上线后有没有出过线上问题？你是怎么排查和解决的？",
    "如果让你重新做这个项目，你会做哪些改进？",
    "这个项目的核心难点在哪里？你是怎么攻克的？",
    "项目的日均 QPS 是多少？你是怎么评估和验证的？",
    "你的项目团队有多少人？你是怎么协作的？",
    "项目的数据模型是怎么设计的？有没有做过重构？",
  ],
  system_design: [
    "如果让你设计一个电商秒杀系统，你会怎么设计？",
    "设计一个支持海量用户的实时聊天系统。",
    "如何设计一个高可用的配置中心？",
    "设计一个限流组件，支持不同粒度的限流策略。",
    "如果让你设计一个日志收集系统，你会怎么做？",
  ],
  hr: [
    "你为什么选择我们公司？",
    "你对这个岗位的理解是什么？",
    "你期望的工作环境是什么样的？",
    "你收到其他公司的 offer 吗？你怎么选择？",
    "你最快什么时候能到岗？",
  ],
}

// 追问库
const FOLLOW_UP_POOL = [
  "能说得更具体一点吗？",
  "当时你是怎么权衡这个方案的优缺点的？",
  "如果流量再扩大10倍，你的方案还能支撑吗？",
  "有没有考虑过其他的技术方案？为什么没选？",
  "这个方案上线后效果如何？有具体数据吗？",
  "你在这个决策中扮演了什么角色？",
  "如果现在让你重新做，你会有什么不同的选择？",
  "你觉得这个方案最大的风险是什么？",
]

const ALL_CATEGORIES = ["technical", "behavioral", "project_deep_dive", "system_design", "hr"]
const CATEGORY_WEIGHTS = [0.3, 0.2, 0.3, 0.1, 0.1]

// ---- Mock 模拟面试 ----

function pickQuestion(category: string, askedQuestions: string[]): string {
  const pool = QUESTION_BANK[category] || QUESTION_BANK.technical
  const available = pool.filter((q) => !askedQuestions.includes(q))
  if (available.length === 0) return pool[Math.floor(Math.random() * pool.length)]
  return available[Math.floor(Math.random() * available.length)]
}

function generateMockFeedback(answer: string, category: string): string {
  if (!answer || answer.length < 20) {
    return "回答过于简短，建议补充具体细节和案例。可以使用 STAR 法则来组织回答。"
  }
  if (answer.length < 60) {
    return "回答基本正确，但可以更加深入。建议提供具体的数据或项目经验来支撑你的观点。"
  }
  return "回答完整，逻辑清晰，有具体案例支撑，表现不错。"
}

function generateMockScore(answer: string): number {
  if (!answer || answer.length < 20) return 3 + Math.round(Math.random() * 2)
  if (answer.length < 60) return 5 + Math.round(Math.random() * 2)
  return 6 + Math.round(Math.random() * 3)
}

let sessionCounter = 0

export function createMockSession(
  company: string,
  position: string,
  roundType: string
): MockSession {
  sessionCounter++
  const categories = [...ALL_CATEGORIES]

  // 根据轮次调整题目分布
  const questions: MockQA[] = []
  const askedQuestions: string[] = []

  // 首轮问题
  const firstCategory = roundType === "hr" ? "hr" : roundType === "behavioral" ? "behavioral" : "technical"
  const q1 = pickQuestion(firstCategory, askedQuestions)
  askedQuestions.push(q1)
  questions.push({
    question: q1,
    category: firstCategory,
    round: 1,
  })

  return {
    id: `mock_${Date.now()}_${sessionCounter}`,
    company,
    position,
    roundType,
    questions,
    currentRound: 1,
    startedAt: new Date().toISOString(),
  }
}

export function mockRespond(
  session: MockSession,
  answer: string
): { question?: string; feedback?: string; isFollowUp: boolean; isComplete: boolean } {
  const currentQA = session.questions[session.questions.length - 1]
  if (!currentQA) {
    return { isFollowUp: false, isComplete: true }
  }

  // 保存回答
  currentQA.answer = answer
  currentQA.feedback = generateMockFeedback(answer, currentQA.category)

  // 50% 概率追问
  if (Math.random() > 0.5 && session.questions.length < 12) {
    const followUp = FOLLOW_UP_POOL[Math.floor(Math.random() * FOLLOW_UP_POOL.length)]
    session.questions.push({
      question: followUp,
      category: currentQA.category,
      round: session.currentRound,
    })
    return { feedback: currentQA.feedback, isFollowUp: true, isComplete: false }
  }

  // 进入下一轮
  session.currentRound++

  // 决定是否结束（最少3轮，最多8轮）
  const totalRounds = session.questions.filter((q) => !FOLLOW_UP_POOL.includes(q.question)).length
  if (totalRounds >= 8 || (totalRounds >= 3 && Math.random() > 0.7)) {
    return { feedback: currentQA.feedback, isFollowUp: false, isComplete: true }
  }

  // 选下一题
  const askedQuestions = session.questions.map((q) => q.question)
  const nextCategory = ALL_CATEGORIES[Math.floor(Math.random() * ALL_CATEGORIES.length)]
  const nextQ = pickQuestion(nextCategory, askedQuestions)
  session.questions.push({
    question: nextQ,
    category: nextCategory,
    round: session.currentRound,
  })

  return { feedback: currentQA.feedback, isFollowUp: false, isComplete: false }
}

export function generateMockSummary(session: MockSession): MockSummary {
  const questionScores = session.questions
    .filter((q) => q.answer)
    .map((q) => ({
      question: q.question,
      score: generateMockScore(q.answer || ""),
      feedback: q.feedback || generateMockFeedback(q.answer || "", q.category),
    }))

  const avgScore =
    questionScores.length > 0
      ? Math.round(
          (questionScores.reduce((s, q) => s + q.score, 0) / questionScores.length) * 10
        ) / 10
      : 5

  return {
    overallScore: avgScore,
    totalQuestions: questionScores.length,
    strengths: avgScore >= 6
      ? ["回答问题有结构", "技术基础扎实", "有项目实战经验"]
      : ["态度积极", "愿意学习"],
    improvementAreas: [
      "建议使用 STAR 法则组织回答",
      "增加具体数据和量化指标",
      "提前准备 Behavior 问题的故事线",
    ],
    questionScores,
  }
}

// ---- 真实 AI 模式 ----

const MOCK_SYSTEM_PROMPT = `你是一位资深的技术面试官。你将进行一场模拟面试。

规则：
1. 每次只问一个问题
2. 根据候选人的回答给出简短反馈，然后追问或问下一个问题
3. 面试话题应该围绕候选人的技术栈和项目经验展开
4. 可以适当追问，模拟真实面试压力
5. 保持专业、友好的态度
6. 最多进行 8 轮问答

面试背景：
- 公司：{company}
- 岗位：{position}
- 轮次：{roundType}

请先从自我介绍或简单问题开始。`

export function buildMockStartPrompt(
  company: string,
  position: string,
  roundType: string,
  resume?: string,
  grillMode?: boolean
): string {
  let prompt = MOCK_SYSTEM_PROMPT.replace("{company}", company)
    .replace("{position}", position)
    .replace("{roundType}", roundType)

  if (grillMode && resume) {
    prompt += `

## 简历深挖模式（务必执行）
你现在是"简历深挖面试官"，只针对候选人简历提问：
1. 找出简历中的漏洞、模糊表述、夸大之处、前后矛盾点
2. 从最可疑/最薄弱的一点开始，第一问就直击要害
3. 要求候选人详细说明、给具体例子、量化成果、讲清责任边界
4. 简历里没有但你关心的关键点也可以追问（如技术栈深度、项目真实性）

候选人简历：
${resume.slice(0, 3000)}`
  }

  return prompt + "\n\n请开始面试，提出第一个问题。"
}

export function buildMockRespondPrompt(
  history: { role: "assistant" | "user"; content: string }[],
  userAnswer: string,
  grillMode?: boolean
): string {
  let prompt = `这是面试对话历史：
${history.map((m) => `${m.role === "assistant" ? "面试官" : "候选人"}：${m.content}`).join("\n")}

候选人对上一个问题的回答是：${userAnswer}

请给出简短反馈（1-2句话），然后提出下一个问题或追问。如果面试应该结束，请在最后加上 [END]。`

  if (grillMode) {
    prompt += `

## 简历深挖模式（务必执行）
- 若回答含糊、夸大、缺乏量化，追问具体细节并要证据
- 发现与简历矛盾的表述要明确指出并深挖
- 可对关键回答连续追问（最多 3 层），保持专业但有压力感
- 追问时引用简历原文（如"你简历里写…"）`
  }

  return prompt
}

export function buildMockSummaryPrompt(
  history: { role: "assistant" | "user"; content: string }[],
  grillMode?: boolean
): string {
  const dims = grillMode
    ? `,
  "credibility": <1-10, 回答可信度>,
  "technicalAccuracy": <1-10, 技术准确性>,
  "expression": <1-10, 表达结构>,
  "riskPoints": ["<简历深挖中暴露的风险点>"]`
    : ""
  return `这是一场模拟面试的完整对话记录：
${history.map((m) => `${m.role === "assistant" ? "面试官" : "候选人"}：${m.content}`).join("\n")}

请以 JSON 格式对这场面试进行总结：
{
  "overallScore": <1-10>,
  "totalQuestions": <number>,
  "strengths": ["<优点1>", "<优点2>", "<优点3>"],
  "improvementAreas": ["<改进方向1>", "<改进方向2>"],
  "questionScores": [
    {
      "question": "<问题内容>",
      "score": <1-10>,
      "feedback": "<反馈>"
    }
  ]${dims}
}`
}
