import { chatWithFallback, type CoachMessage } from "@/lib/ai-coach"

// ────────── 类型 ──────────

export interface ExperienceQuestionInput {
  id: string
  questionText: string
  userAnswer: string | null
}

export interface AbstractedExperience {
  position: string
  round: string
  question: string
  answer: string | null
  originalQuestion: string
  originalAnswer: string | null
}

const ROUND_LABEL: Record<string, string> = {
  first: "一面", second: "二面", third: "三面", final: "终面",
  hr: "HR面", written: "笔试", other: "其他",
}

// ────────── AI 抽象系统提示词 ──────────

const ABSTRACT_SYSTEM_PROMPT = `你是一位资深的面经整理专家，擅长把面试记录抽象成可公开分享的匿名面经。
任务：把用户提供的面试题目和回答，改写为帮助更多候选人备考的通用面经。

## 要求
1. 每题输出一条面经，只输出 JSON 数组，不要任何多余文字或 markdown。
2. 每条结构：{"question": "题目（可轻微概括，保留考察点）", "answer": "通用回答思路"}
3. 脱敏原则：
   - 去掉真实姓名、公司内部机密、可识别身份的信息
   - 具体数字模糊化（如"327万用户"改成"几十万用户"）
   - 回答不要照抄原文过于具体的个人经历，改写成普适的答题思路
4. 题目一般保留原样，除非包含敏感信息。

## 输出
[{"question":"...","answer":"..."}, ...]`

// ────────── 公司名匿名化（D） ──────────

export function maskCompany(companyName: string, industry: string | null): string {
  if (!industry) return "某公司"
  const seg = industry.split("/")[0].trim()
  return seg ? `某${seg}公司` : "某公司"
}

// ────────── 解析 AI 返回的结构化 JSON（健壮降级） ──────────

function parseAbstractJson(raw: string): { question: string; answer: string | null }[] {
  try {
    let s = raw.trim()
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fence) s = fence[1].trim()
    const start = s.indexOf("[")
    const end = s.lastIndexOf("]")
    if (start !== -1 && end > start) s = s.slice(start, end + 1)
    const arr = JSON.parse(s)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((x) => x && typeof x.question === "string")
      .map((x) => ({
        question: x.question.trim().slice(0, 500),
        answer:
          typeof x.answer === "string" && x.answer.trim()
            ? x.answer.trim().slice(0, 2000)
            : null,
      }))
  } catch {
    return []
  }
}

// ────────── 无 Key mock 兜底（保持功能可用） ──────────

function mockAbstract(
  questions: ExperienceQuestionInput[]
): { question: string; answer: string | null }[] {
  return questions.map((q) => ({
    question: q.questionText,
    answer: q.userAnswer
      ? `（基础模式）可以这样回答：${q.userAnswer.slice(0, 300)}`
      : "（基础模式）先给结论再展开，用 STAR 法则组织回答。",
  }))
}

// ────────── 主入口：把面试问题抽象成面经草稿 ──────────

export async function abstractExperiences(
  company: string,
  position: string,
  roundType: string,
  questions: ExperienceQuestionInput[]
): Promise<AbstractedExperience[]> {
  const source = questions
    .map(
      (q, i) =>
        `【题目${i + 1}】${q.questionText}\n【我的回答${i + 1}】${q.userAnswer || "(未记录)"}`
    )
    .join("\n\n")

  const prompt = `请把以下面试记录抽象成匿名面经。
- 公司：${company}
- 岗位：${position}
- 轮次：${ROUND_LABEL[roundType] || roundType}

${source}

按输出要求输出 JSON 数组，每题一条。`

  const messages: CoachMessage[] = [{ role: "user", content: prompt }]
  const raw = await chatWithFallback(ABSTRACT_SYSTEM_PROMPT, messages, () =>
    JSON.stringify(mockAbstract(questions))
  )
  const parsed = parseAbstractJson(raw)

  // AI 解析失败时降级为 mock 抽象，保证流程可用
  const fallback = mockAbstract(questions)
  const entries = parsed.length > 0 ? parsed : fallback

  return entries.map((p, i) => ({
    position,
    round: roundType,
    question: p.question,
    answer: p.answer,
    originalQuestion: questions[i]?.questionText ?? "",
    originalAnswer: questions[i]?.userAnswer ?? null,
  }))
}
