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
    trendDetail: [],
  },

  onLoad() {
    this.loadData()
  },

  loadData() {
    // 主分析(stats+雷达) + 深入分析(薄弱项+趋势+公司对比)
    Promise.all([api.getAnalysis(), api.getDeepAnalysis()]).then(([basic, deep]) => {
      const stats = basic.stats || {}
      const skillProfile = basic.skillProfile || []
      const weakness = (deep.weaknessTracking || []).map((w) => ({
        ...w,
        barPercent: util.barPercent(w.avgScore),
        trendText: util.trendText(w.trend || []),
      }))
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
          trendDetail: trend.slice().reverse().map((t) => ({
            ...t,
            scoreText: typeof t.score === "number" ? t.score.toFixed(1) : "-",
          })),
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

  // 能力雷达核心绘制（页面雷达 + 认证卡共用）
  // ctx：已创建的 CanvasContext；cx/cy：圆心；R：半径；profile：[{category, score}]
  // opts：{ labelOffset, fontSize, pointRadius, drawLabels }
  drawRadarOn(ctx, cx, cy, R, profile, opts) {
    const cfg = opts || {}
    const n = profile.length
    if (n < 3) return
    const labelOffset = cfg.labelOffset || 0
    const fontSize = cfg.fontSize || 11
    const pointRadius = cfg.pointRadius || 3
    const drawLabels = cfg.drawLabels !== false
    const angle = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n
    const scoreAt = (i) => util.clampScore(profile[i].score)
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
      const p = pxAt(i, scoreAt(i) / 10)
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
      const p = pxAt(i, scoreAt(i) / 10)
      ctx.beginPath()
      ctx.arc(p.x, p.y, pointRadius, 0, 2 * Math.PI)
      ctx.setFillStyle("#6366f1")
      ctx.fill()
    }

    // 维度标签（中文，认证卡场景可关闭）
    if (drawLabels) {
      ctx.setFillStyle("#1e293b")
      ctx.setFontSize(fontSize)
      ctx.setTextAlign("center")
      for (let i = 0; i < n; i++) {
        const a = angle(i)
        const lx = cx + (R + labelOffset) * Math.cos(a)
        const ly = cy + (R + labelOffset) * Math.sin(a) + 4
        ctx.fillText(util.CATEGORY_LABELS[profile[i].category] || profile[i].category, lx, ly)
      }
    }
  },

  // 能力雷达图（原生 canvas）
  drawRadar(profile) {
    const ctx = wx.createCanvasContext("radarCanvas", this)
    const w = this.rpx2px(620)
    const h = this.rpx2px(440)
    const cx = w / 2
    const cy = h / 2
    const R = Math.min(w, h) / 2 - this.rpx2px(54)
    this.drawRadarOn(ctx, cx, cy, R, profile, {
      labelOffset: this.rpx2px(26),
      fontSize: 11,
      pointRadius: 3,
      drawLabels: true,
    })
    ctx.draw()
  },

  // 能力认证分享卡：离屏 canvas 绘制 → 保存相册 / 分享好友
  generateCert() {
    const profile = this.data.skillProfile || []
    if (profile.length < 3) {
      wx.showToast({ title: "完成 AI 复盘后生成", icon: "none" })
      return
    }
    const app = getApp()
    const user = (app && app.globalData && app.globalData.user) || null
    const name = (user && (user.name || user.nickname)) || "面试者"
    const total = (this.data.stats && this.data.stats.total) || 0

    const w = this.rpx2px(600)
    const h = this.rpx2px(800)
    const ctx = wx.createCanvasContext("certCanvas", this)

    // 白底圆角卡片
    const radius = this.rpx2px(24)
    ctx.beginPath()
    ctx.arc(radius, radius, radius, Math.PI, Math.PI * 1.5)
    ctx.arc(w - radius, radius, radius, Math.PI * 1.5, 0)
    ctx.arc(w - radius, h - radius, radius, 0, Math.PI * 0.5)
    ctx.arc(radius, h - radius, radius, Math.PI * 0.5, Math.PI)
    ctx.closePath()
    ctx.setFillStyle("#ffffff")
    ctx.fill()
    ctx.setStrokeStyle("#e2e8f0")
    ctx.setLineWidth(2)
    ctx.stroke()

    // 顶部标题 + 昵称
    ctx.setFillStyle("#111827")
    ctx.setFontSize(this.rpx2px(34))
    ctx.setTextAlign("center")
    ctx.fillText("AI 面师 · 能力认证", w / 2, this.rpx2px(80))
    ctx.setFillStyle("#64748b")
    ctx.setFontSize(this.rpx2px(24))
    ctx.fillText(name, w / 2, this.rpx2px(132))

    // 中部雷达（复用绘制逻辑，不重复画标签）
    this.drawRadarOn(ctx, w / 2, this.rpx2px(400), this.rpx2px(150), profile, {
      labelOffset: 0,
      fontSize: 0,
      pointRadius: 4,
      drawLabels: false,
    })

    // 底部 5 维中文标签 + 分数
    const labelStart = this.rpx2px(565)
    const rowH = this.rpx2px(40)
    ctx.setFontSize(this.rpx2px(26))
    for (let i = 0; i < profile.length; i++) {
      const label = util.CATEGORY_LABELS[profile[i].category] || profile[i].category
      const score = util.clampScore(profile[i].score)
      const y = labelStart + i * rowH
      ctx.setFillStyle("#1e293b")
      ctx.setTextAlign("left")
      ctx.fillText(label, this.rpx2px(56), y)
      ctx.setFillStyle("#6366f1")
      ctx.setTextAlign("right")
      ctx.fillText(Number(score).toFixed(1), w - this.rpx2px(56), y)
    }

    // 底部说明
    ctx.setFillStyle("#94a3b8")
    ctx.setFontSize(this.rpx2px(20))
    ctx.setTextAlign("center")
    ctx.fillText("由 AI 面师 AI 评估 · " + total + " 场真实面试", w / 2, this.rpx2px(772))

    // 导出临时图 → 保存/分享（canvasToTempFilePath 需在 draw 回调内调用）
    ctx.draw(false, () => {
      wx.canvasToTempFilePath(
        {
          canvasId: "certCanvas",
          success: (res) => {
            wx.showActionSheet({
              itemList: ["保存到相册", "分享给好友"],
              success: (r) => {
                if (r.tapIndex === 0) {
                  this.saveCertToAlbum(res.tempFilePath)
                } else if (r.tapIndex === 1) {
                  wx.shareAppMessage({
                    title: "我的面试能力认证 - AI 面师",
                    imageUrl: res.tempFilePath,
                  })
                }
              },
            })
          },
          fail: () => {
            wx.showToast({ title: "生成失败，请重试", icon: "none" })
          },
        },
        this
      )
    })
  },

  // 保存认证卡到相册（含相册权限引导）
  saveCertToAlbum(filePath) {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => {
        wx.showToast({ title: "已保存到相册", icon: "success" })
      },
      fail: () => {
        wx.showModal({
          title: "需要相册权限",
          content: "请在设置中开启「保存到相册」权限后重试",
          confirmText: "去设置",
          success: (r) => {
            if (r.confirm) wx.openSetting()
          },
        })
      },
    })
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

    // 0-10 分横网格（步长 2）
    ctx.setStrokeStyle("#f1f5f9")
    for (let s = 0; s <= 10; s += 2) {
      const y = h - padB - (plotH * s) / 10
      ctx.beginPath()
      ctx.moveTo(padL, y)
      ctx.lineTo(w - padR, y)
      ctx.stroke()
    }

    const xOf = (i) => (n === 1 ? padL + plotW / 2 : padL + (plotW * i) / (n - 1))
    const yOf = (score) => h - padB - (plotH * util.clampScore(score)) / 10

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
