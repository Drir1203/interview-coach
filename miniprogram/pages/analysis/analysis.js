const api = require("../../utils/api")
const util = require("../../utils/util")

Page({
  data: {
    loading: true,
    hasData: false,
    stats: { total: 0, reviewed: 0, passRate: 0, avgScore: 0 },
    skillProfile: [],
    weakness: [],
    companies: [],
    scoreTrend: [],
  },

  onLoad() {
    this.loadData()
  },

  loadData() {
    // 主分析(stats+雷达) + 深入分析(薄弱项+趋势+公司对比)
    Promise.all([api.getAnalysis(), api.getDeepAnalysis()]).then(([basic, deep]) => {
      const stats = basic.stats || {}
      const skillProfile = basic.skillProfile || []
      const weakness = deep.weaknessTracking || []
      const companies = deep.companyComparison || []
      const trend = deep.trendData || []

      this.setData(
        {
          loading: false,
          hasData: skillProfile.length > 0 || weakness.length > 0 || trend.length > 0,
          stats: {
            total: stats.total || 0,
            reviewed: stats.reviewed || 0,
            passRate: Math.round((stats.passRate || 0) * 100),
            avgScore: stats.avgScore || 0,
          },
          skillProfile,
          weakness,
          companies,
          scoreTrend: trend,
        },
        () => {
          if (skillProfile.length >= 3) this.drawRadar(skillProfile)
          if (trend.length > 0) this.drawTrend(trend)
        }
      )
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  // rpx → px（750 设计稿）
  rpx2px(v) {
    const win = wx.getSystemInfoSync() || {}
    return (v * (win.windowWidth || 375)) / 750
  },

  // 能力雷达图（原生 canvas）
  drawRadar(profile) {
    const ctx = wx.createCanvasContext("radarCanvas", this)
    const w = this.rpx2px(620)
    const h = this.rpx2px(440)
    const cx = w / 2
    const cy = h / 2
    const R = Math.min(w, h) / 2 - this.rpx2px(54)
    const n = profile.length
    if (n < 3) return
    const angle = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n
    const scoreAt = (i) => Math.min(Math.max(profile[i].score || 0, 0), 5)
    const pxAt = (i, ratio) => {
      const a = angle(i)
      return { x: cx + R * ratio * Math.cos(a), y: cy + R * ratio * Math.sin(a) }
    }

    // 网格环（4 层）+ 中心连线
    ctx.setStrokeStyle("#e2e8f0")
    ctx.setLineWidth(1)
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath()
      for (let i = 0; i <= n; i++) {
        const p = pxAt(i % n, ring / 4)
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
    }
    for (let i = 0; i < n; i++) {
      const p = pxAt(i, 1)
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }

    // 数据多边形
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const p = pxAt(i, scoreAt(i) / 5)
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
    }
    ctx.closePath()
    ctx.setFillStyle("rgba(99,102,241,0.2)")
    ctx.fill()
    ctx.setStrokeStyle("#6366f1")
    ctx.setLineWidth(2)
    ctx.stroke()

    // 顶点圆点
    for (let i = 0; i < n; i++) {
      const p = pxAt(i, scoreAt(i) / 5)
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI)
      ctx.setFillStyle("#6366f1")
      ctx.fill()
    }

    // 维度标签（中文）
    ctx.setFillStyle("#1e293b")
    ctx.setFontSize(11)
    ctx.setTextAlign("center")
    for (let i = 0; i < n; i++) {
      const a = angle(i)
      const lx = cx + (R + this.rpx2px(26)) * Math.cos(a)
      const ly = cy + (R + this.rpx2px(26)) * Math.sin(a) + 4
      ctx.fillText(util.CATEGORY_LABELS[profile[i].category] || profile[i].category, lx, ly)
    }

    ctx.draw()
  },

  // 评分趋势折线（原生 canvas）
  drawTrend(trend) {
    const ctx = wx.createCanvasContext("trendCanvas", this)
    const w = this.rpx2px(620)
    const h = this.rpx2px(360)
    const padL = this.rpx2px(36)
    const padR = this.rpx2px(16)
    const padT = this.rpx2px(16)
    const padB = this.rpx2px(40)
    const plotW = w - padL - padR
    const plotH = h - padT - padB
    const n = trend.length
    if (n === 0) return

    // 坐标轴
    ctx.setStrokeStyle("#e2e8f0")
    ctx.setLineWidth(1)
    ctx.beginPath()
    ctx.moveTo(padL, padT)
    ctx.lineTo(padL, h - padB)
    ctx.lineTo(w - padR, h - padB)
    ctx.stroke()

    // 0-5 分横网格
    ctx.setStrokeStyle("#f1f5f9")
    for (let s = 0; s <= 5; s++) {
      const y = h - padB - (plotH * s) / 5
      ctx.beginPath()
      ctx.moveTo(padL, y)
      ctx.lineTo(w - padR, y)
      ctx.stroke()
    }

    const xOf = (i) => (n === 1 ? padL + plotW / 2 : padL + (plotW * i) / (n - 1))
    const yOf = (score) => h - padB - (plotH * Math.min(Math.max(score, 0), 5)) / 5

    // 折线
    ctx.setStrokeStyle("#6366f1")
    ctx.setLineWidth(2)
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const x = xOf(i)
      const y = yOf(trend[i].score)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()

    // 数据点
    for (let i = 0; i < n; i++) {
      ctx.beginPath()
      ctx.arc(xOf(i), yOf(trend[i].score), 3, 0, 2 * Math.PI)
      ctx.setFillStyle("#6366f1")
      ctx.fill()
    }

    // 日期标签（首/中/尾）
    ctx.setFontSize(10)
    ctx.setFillStyle("#64748b")
    ctx.setTextAlign("center")
    const idxs = n === 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1]
    for (const i of idxs) {
      ctx.fillText(String(trend[i].date).slice(5), xOf(i), h - padB + 14)
    }

    ctx.draw()
  },
})
