// 轻量 Markdown → 结构化块解析（AI 回复展示用）
// 支持: # h1 / ## h2 / ### h3 / "- " "* " "1. " 列表 / **加粗**(剥星号) / 普通段落
// 返回 [{ type: 'h1'|'h2'|'h3'|'li'|'p', text }]

function stripInline(text) {
  return String(text).replace(/\*\*(.+?)\*\*/g, "$1")
}

function parseMarkdown(text) {
  if (!text) return []
  const blocks = []
  const lines = String(text).split("\n")

  for (let raw of lines) {
    const line = raw.replace(/\s+$/, "")
    if (!line.trim()) continue

    let type = "p"
    let content = line

    if (/^### /.test(line)) {
      type = "h3"
      content = line.slice(4)
    } else if (/^## /.test(line)) {
      type = "h2"
      content = line.slice(3)
    } else if (/^# /.test(line)) {
      type = "h1"
      content = line.slice(2)
    } else if (/^[-*] /.test(line)) {
      type = "li"
      content = line.replace(/^[-*] /, "")
    } else if (/^\d+\.\s/.test(line)) {
      type = "li"
      content = line.replace(/^\d+\.\s/, "")
    }

    blocks.push({ type, text: stripInline(content) })
  }

  return blocks
}

module.exports = { parseMarkdown }
