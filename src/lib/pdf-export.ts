import { ROUND_TYPE_LABELS, INTERVIEW_RESULTS, QUESTION_CATEGORIES } from "@/types"
import { formatDate } from "@/lib/utils"

// ────────── 类型（与页面局部接口结构兼容，可直接传入） ──────────

export interface PdfQuestion {
  questionText: string
  userAnswer?: string | null
  aiScore?: number | null
  aiFeedback?: string | null
  aiImprovedAnswer?: string | null
  aiKeyMistake?: string | null
  aiCategory?: string | null
}

export interface PdfWeaknessArea {
  category: string
  score: number
  description?: string
}

export interface PdfInterview {
  id: string
  date: string // ISO 字符串
  position: string
  roundType: string
  result?: string | null
  overallScore?: number | null
  overallFeedback?: string | null
  strengths?: string | null // JSON string[]
  improvementAreas?: string | null // JSON string[]
  weaknessAreas?: string | null // JSON {category,score,description}[]
  userNotes?: string | null
  company: { name: string; industry?: string | null }
  questions: PdfQuestion[]
}

export interface PdfSummaryItem {
  company: { name: string }
  position: string
  roundType: string
  date: string
  overallScore?: number | null
  result?: string | null
}

// ────────── 常量与工具 ──────────

// A4(210mm) @ 144dpi ≈ 1191px，文字清晰
const REPORT_WIDTH = 1191
const FONT_FAMILY =
  '-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif'

// 根节点显式 color/background：阻断 Tailwind v4 oklch 变量进入 html2canvas 捕获子树
const ROOT_STYLE = `width:${REPORT_WIDTH}px;padding:40px;box-sizing:border-box;font-family:${FONT_FAMILY};color:#1f2937;background:#ffffff;font-size:14px;line-height:1.7;`

const H2_STYLE = "font-size:16px;font-weight:bold;color:#111827;margin:0 0 12px;"

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function roundLabel(r: string): string {
  return ROUND_TYPE_LABELS[r] || r
}

function resultLabel(r?: string | null): string {
  return INTERVIEW_RESULTS.find((x) => x.value === r)?.label || r || "未知"
}

function categoryLabel(c: string): string {
  return QUESTION_CATEGORIES.find((x) => x.value === c)?.label || c
}

function safeJson<T>(raw: string | null | undefined): T {
  try {
    return raw ? (JSON.parse(raw) as T) : ([] as unknown as T)
  } catch {
    return [] as unknown as T
  }
}

function footerHtml(): string {
  const today = new Date().toLocaleDateString("zh-CN")
  return `<div style="margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">由 i面试 生成 · 导出时间 ${esc(today)}</div>`
}

// ────────── 单场完整报告 ──────────

function headerHtml(iv: PdfInterview): string {
  const scoreBlock =
    iv.overallScore != null
      ? `<div style="text-align:center;flex-shrink:0;">
           <div style="font-size:36px;font-weight:bold;color:#3b82f6;">${iv.overallScore.toFixed(1)}</div>
           <div style="font-size:12px;color:#9ca3af;">总体评分</div>
         </div>`
      : ""
  const industry = iv.company.industry
    ? `<div style="margin-top:4px;font-size:12px;color:#9ca3af;">行业：${esc(iv.company.industry)}</div>`
    : ""
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:2px solid #e5e7eb;margin-bottom:24px;">
    <div>
      <div style="font-size:26px;font-weight:bold;color:#111827;">${esc(iv.company.name)}</div>
      <div style="margin-top:6px;font-size:14px;color:#4b5563;">${esc(iv.position)} · ${esc(roundLabel(iv.roundType))} · ${esc(formatDate(iv.date))} · ${esc(resultLabel(iv.result))}</div>
      ${industry}
    </div>
    ${scoreBlock}
  </div>`
}

function reviewHtml(iv: PdfInterview): string {
  const strengths = safeJson<string[]>(iv.strengths)
  const improvements = safeJson<string[]>(iv.improvementAreas)
  const weaknesses = safeJson<PdfWeaknessArea[]>(iv.weaknessAreas)
  const hasReview =
    !!iv.overallFeedback || strengths.length > 0 || improvements.length > 0 || weaknesses.length > 0

  if (!hasReview) {
    return `<div style="margin-bottom:24px;"><h2 style="${H2_STYLE}">AI 复盘结果</h2><div style="color:#9ca3af;font-size:13px;">尚未进行 AI 复盘</div></div>`
  }

  const sections: string[] = []
  if (iv.overallFeedback) {
    sections.push(
      `<div style="margin-bottom:12px;"><h3 style="font-size:13px;font-weight:bold;color:#111827;margin:0 0 6px;">总体评价</h3><p style="margin:0;color:#374151;white-space:pre-wrap;">${esc(iv.overallFeedback)}</p></div>`
    )
  }
  if (strengths.length > 0) {
    sections.push(
      `<div style="margin-bottom:12px;"><h3 style="font-size:13px;font-weight:bold;color:#15803d;margin:0 0 6px;">✅ 优点</h3>${strengths
        .map((s) => `<div style="color:#374151;">• ${esc(s)}</div>`)
        .join("")}</div>`
    )
  }
  if (improvements.length > 0) {
    sections.push(
      `<div style="margin-bottom:12px;"><h3 style="font-size:13px;font-weight:bold;color:#b45309;margin:0 0 6px;">🔴 改进方向</h3>${improvements
        .map((s) => `<div style="color:#374151;">• ${esc(s)}</div>`)
        .join("")}</div>`
    )
  }
  if (weaknesses.length > 0) {
    sections.push(
      `<div style="margin-bottom:12px;"><h3 style="font-size:13px;font-weight:bold;color:#111827;margin:0 0 6px;">薄弱维度</h3>${weaknesses
        .map(
          (w) => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:12px;padding:2px 8px;border:1px solid #e5e7eb;border-radius:999px;color:#4b5563;white-space:nowrap;">${esc(categoryLabel(w.category))}</span>
            <div style="flex:1;height:8px;border-radius:999px;background:#f3f4f6;"><div style="height:8px;border-radius:999px;background:#3b82f6;width:${Math.min(100, Math.max(0, w.score * 10))}%;"></div></div>
            <span style="font-size:12px;color:#6b7280;">${typeof w.score === "number" ? w.score.toFixed(1) : ""}</span>
          </div>`
        )
        .join("")}</div>`
    )
  }
  return `<div style="margin-bottom:24px;"><h2 style="${H2_STYLE}">AI 复盘结果</h2>${sections.join("")}</div>`
}

function questionsHtml(iv: PdfInterview): string {
  if (iv.questions.length === 0) return ""
  const items = iv.questions
    .map((q, i) => {
      const aiScore =
        q.aiScore != null
          ? `<div style="flex-shrink:0;width:32px;height:32px;border-radius:999px;background:#eff6ff;display:flex;align-items:center;justify-content:center;"><span style="font-size:13px;font-weight:bold;color:#3b82f6;">${q.aiScore.toFixed(0)}</span></div>`
          : ""
      const answer = q.userAnswer
        ? `<div style="margin-top:8px;"><span style="font-size:12px;color:#6b7280;">你的回答：</span><p style="margin:2px 0 0;color:#374151;white-space:pre-wrap;">${esc(q.userAnswer)}</p></div>`
        : ""
      let aiBlock = ""
      if (q.aiFeedback) {
        const mistake = q.aiKeyMistake
          ? `<p style="margin:6px 0 0;color:#dc2626;">关键失误：${esc(q.aiKeyMistake)}</p>`
          : ""
        const improved = q.aiImprovedAnswer
          ? `<div style="margin-top:8px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:6px;padding:8px 10px;"><div style="font-size:12px;font-weight:bold;color:#1d4ed8;margin-bottom:4px;">优化回答</div><p style="margin:0;color:#1e3a8a;white-space:pre-wrap;">${esc(q.aiImprovedAnswer)}</p></div>`
          : ""
        aiBlock = `<div style="margin-top:8px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:6px;padding:8px 10px;"><div style="font-size:12px;font-weight:bold;color:#3b82f6;margin-bottom:4px;">AI 反馈</div><p style="margin:0;color:#374151;white-space:pre-wrap;">${esc(q.aiFeedback)}</p>${mistake}${improved}</div>`
      }
      const cat = q.aiCategory
        ? `<div style="margin-top:6px;font-size:11px;color:#9ca3af;">${esc(categoryLabel(q.aiCategory))}</div>`
        : ""
      return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div style="flex:1;"><span style="font-size:12px;color:#6b7280;">Q${i + 1}</span><p style="margin:4px 0 0;font-weight:bold;color:#111827;">${esc(q.questionText)}</p></div>
          ${aiScore}
        </div>
        ${answer}${aiBlock}${cat}
      </div>`
    })
    .join("")
  return `<div style="margin-bottom:24px;"><h2 style="${H2_STYLE}">面试问题（${iv.questions.length}）</h2>${items}</div>`
}

function notesHtml(iv: PdfInterview): string {
  if (!iv.userNotes) return ""
  return `<div style="margin-bottom:24px;"><h2 style="${H2_STYLE}">备注</h2><p style="margin:0;color:#374151;white-space:pre-wrap;">${esc(iv.userNotes)}</p></div>`
}

function buildInterviewReportHtml(iv: PdfInterview): string {
  return `<div style="${ROOT_STYLE}">${headerHtml(iv)}${reviewHtml(iv)}${questionsHtml(iv)}${notesHtml(iv)}${footerHtml()}</div>`
}

// ────────── 多场汇总报告 ──────────

function buildSummaryReportHtml(items: PdfSummaryItem[]): string {
  if (items.length === 0) {
    return `<div style="${ROOT_STYLE}"><h1 style="font-size:20px;font-weight:bold;color:#111827;margin:0 0 16px;">面试记录汇总</h1><div style="color:#9ca3af;">暂无面试记录</div>${footerHtml()}</div>`
  }
  const th = "padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;color:#4b5563;text-align:left;"
  const td = "padding:8px 10px;border:1px solid #e5e7eb;font-size:13px;"
  const rows = items
    .map((it, i) => {
      const bg = i % 2 === 1 ? "background:#fcfcfd;" : ""
      return `<tr style="${bg}">
        <td style="${td}">${esc(formatDate(it.date))}</td>
        <td style="${td}">${esc(it.company.name)}</td>
        <td style="${td}">${esc(it.position)}</td>
        <td style="${td}">${esc(roundLabel(it.roundType))}</td>
        <td style="${td}">${esc(resultLabel(it.result))}</td>
        <td style="${td}">${it.overallScore != null ? it.overallScore.toFixed(1) : "-"}</td>
      </tr>`
    })
    .join("")
  return `<div style="${ROOT_STYLE}">
    <h1 style="font-size:20px;font-weight:bold;color:#111827;margin:0 0 4px;">面试记录汇总</h1>
    <div style="font-size:12px;color:#9ca3af;margin-bottom:16px;">共 ${items.length} 场面试</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#f9fafb;"><th style="${th}">日期</th><th style="${th}">公司</th><th style="${th}">岗位</th><th style="${th}">轮次</th><th style="${th}">结果</th><th style="${th}">总分</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${footerHtml()}
  </div>`
}

// ────────── 渲染与保存 ──────────

async function renderToPdf(html: string, filename: string): Promise<void> {
  // 动态 import：避免 SSR 阶段 window 未定义；显式 import html2canvas 确保打进依赖图
  const [{ jsPDF }] = await Promise.all([import("jspdf"), import("html2canvas")])

  const el = document.createElement("div")
  el.innerHTML = html
  // 注意：jsPDF 的 doc.html() 会克隆此元素并强制其 position:relative，但保留内联 left/top。
  // 若用 left:-100000px 移出屏幕，克隆体内容会被再水平偏移 10 万像素，html2canvas 截取不到 → 空白 PDF。
  // 因此只做垂直偏移（top:-100000px），left 保持 0。
  el.style.position = "absolute"
  el.style.left = "0"
  el.style.top = "-100000px"
  el.style.width = `${REPORT_WIDTH}px`
  el.style.backgroundColor = "#ffffff"
  document.body.appendChild(el)

  try {
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })
    await doc.html(el, {
      margin: [12, 12, 14, 12], // [top, right, bottom, left] mm
      width: 210, // A4 宽(mm)，1191px → 210mm ≈ 144dpi
      windowWidth: REPORT_WIDTH,
      autoPaging: "text", // 单列连续文字，分页尽量不切行
      html2canvas: {
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        scale: 2,
      },
    })
    doc.save(filename)
  } finally {
    el.remove()
  }
}

// ────────── 对外导出函数 ──────────

export async function exportInterviewPdf(iv: PdfInterview): Promise<void> {
  const datePart = formatDate(iv.date).replaceAll("/", "-")
  const filename = `面试复盘_${iv.company.name}_${datePart}.pdf`
  const html = buildInterviewReportHtml(iv)
  await renderToPdf(html, filename)
}

export async function exportSummaryPdf(items: PdfSummaryItem[]): Promise<void> {
  const datePart = new Date().toISOString().slice(0, 10)
  const filename = `面试记录汇总_${datePart}.pdf`
  const html = buildSummaryReportHtml(items)
  await renderToPdf(html, filename)
}
