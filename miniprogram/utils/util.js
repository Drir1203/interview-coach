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

// 趋势公司筛选：company 空/"all" 返回原数组，否则过滤该公司；非法输入返回 []
function filterTrend(trend, company) {
  if (!Array.isArray(trend)) return []
  if (!company || company === "all") return trend
  return trend.filter((t) => t && t.company === company)
}

// 投递策略按卡存储（不可变更新）：返回新数组，匹配项 strategyBlocks 替换为 blocks
function storeStrategy(apps, id, blocks) {
  if (!Array.isArray(apps)) return []
  return apps.map((a) => (a && a.id === id ? { ...a, strategyBlocks: blocks } : a))
}

// 教练历史时间标签：今天返回 HH:mm，非今天返回 MM-DD HH:mm；空/非法输入返回 ""
function chatTimeLabel(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  if (sameDay) return `${hh}:${mm}`
  const mo = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${mo}-${dd} ${hh}:${mm}`
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
  filterTrend,
  storeStrategy,
  chatTimeLabel,
}
