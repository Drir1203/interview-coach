import type { Company } from "../generated/prisma"

// ────────── 面试创建/更新 ──────────

export interface CreateInterviewInput {
  companyId?: string
  companyName: string
  companyIndustry?: string
  position: string
  roundType: string
  date?: string
  userNotes?: string
  tags?: string[]
  questions?: CreateQuestionInput[]
}

export interface UpdateInterviewInput {
  position?: string
  roundType?: string
  date?: string
  userNotes?: string
  result?: string
  status?: string
  tags?: string[]
}

export interface CreateQuestionInput {
  order: number
  questionText: string
  userAnswer?: string
  userScore?: number
}

// ────────── AI 复盘 ──────────

export interface AIReviewInput {
  company: string
  position: string
  roundType: string
  questions: {
    questionText: string
    userAnswer?: string
  }[]
  // 候选人简历文本，作为评分背景；为空则不带入
  resumeText?: string
}

export interface AIReviewOutput {
  overallScore: number
  overallFeedback: string
  strengths: string[]
  improvementAreas: string[]
  nextSteps?: string // AI 教练下一步练习建议(面试后自动闭环)
  questions: {
    index: number
    score: number
    feedback: string
    improvedAnswer?: string
    category: string
    keyMistake?: string
  }[]
  weaknessAreas: {
    category: string
    score: number
    description: string
  }[]
}

// ────────── 常量 ──────────

export const ROUND_TYPE_LABELS: Record<string, string> = {
  first: "一面",
  second: "二面",
  third: "三面",
  final: "终面",
  hr: "HR面",
  written: "笔试",
  other: "其他",
}

export const ROUND_TYPES = [
  { value: "first", label: "一面" },
  { value: "second", label: "二面" },
  { value: "third", label: "三面" },
  { value: "final", label: "终面" },
  { value: "hr", label: "HR面" },
  { value: "written", label: "笔试" },
  { value: "other", label: "其他" },
] as const

export const QUESTION_CATEGORIES = [
  { value: "technical", label: "技术基础", color: "#3b82f6" },
  { value: "behavioral", label: "行为面试", color: "#8b5cf6" },
  { value: "project_deep_dive", label: "项目深挖", color: "#10b981" },
  { value: "system_design", label: "系统设计", color: "#f59e0b" },
  { value: "hr", label: "HR 问题", color: "#ec4899" },
  { value: "other", label: "其他", color: "#6b7280" },
] as const

export const INTERVIEW_RESULTS = [
  { value: "unknown", label: "未知" },
  { value: "pass", label: "通过" },
  { value: "fail", label: "未通过" },
  { value: "waiting", label: "等待结果" },
] as const

export const INTERVIEW_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "gray" },
  recorded: { label: "已记录", color: "blue" },
  ai_reviewed: { label: "已复盘", color: "green" },
  archived: { label: "已归档", color: "slate" },
}
