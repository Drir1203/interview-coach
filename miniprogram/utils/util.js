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

module.exports = {
  formatDate,
  formatDateTime,
  ROUND_LABELS,
  RESULT_LABELS,
  STATUS_LABELS,
  CATEGORY_LABELS,
}
