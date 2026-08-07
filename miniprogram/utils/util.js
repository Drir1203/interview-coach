// 日期格式化
function formatDate(dateStr) {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatDateTime(dateStr) {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return `${formatDate(dateStr)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

// 轮次标签
const ROUND_LABELS = {
  first: "一面", second: "二面", third: "三面",
  final: "终面", hr: "HR面", written: "笔试", other: "其他",
}

// 结果标签
const RESULT_LABELS = {
  pass: "✅ 通过", fail: "❌ 未通过", waiting: "⏳ 等待中", unknown: "未知",
}

// 状态标签
const STATUS_LABELS = {
  draft: "草稿", recorded: "已记录", ai_reviewed: "已复盘", archived: "已归档",
}

// 能力维度
const CATEGORY_LABELS = {
  technical: "技术基础", behavioral: "行为面试",
  project_deep_dive: "项目深挖", system_design: "系统设计", hr: "HR 面试",
}

// 分数刻度：clamp [0, max]，非数字返回 0（后端 AI 评分为 10 分制）
function clampScore(score, max = 10) {
  if (typeof score !== "number" || Number.isNaN(score)) return 0
  return Math.min(Math.max(score, 0), max)
}

// 进度条百分比：score/max → 0-100 整数
function barPercent(score, max = 10) {
  if (max <= 0) return 0
  return Math.round((clampScore(score, max) / max) * 100)
}

// 薄弱项走势序列文本："7 → 8 → 9"；不足 2 场返回 ""
function trendText(trend) {
  if (!Array.isArray(trend) || trend.length < 2) return ""
  return trend
    .map((t) => {
      const v = t && t.score
      return Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0
    })
    .join(" → ")
}

module.exports = {
  formatDate,
  formatDateTime,
  ROUND_LABELS,
  RESULT_LABELS,
  STATUS_LABELS,
  CATEGORY_LABELS,
  clampScore,
  barPercent,
  trendText,
}
