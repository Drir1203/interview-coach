const api = require("../../utils/api")
const util = require("../../utils/util")

Page({
  data: {
    interview: null,
    loading: true,
    reviewing: false,
    // C4 教练下一步建议（仅本次复盘响应，不持久化）
    nextSteps: null,
    // C1 重新分析
    reanalyzeOpen: false,
    reanalyzeInstr: "",
    reanalyzing: false,
    // C2 单题重新生成
    regenQuestionId: null,
    regenInstr: "",
    regeneratingId: null,
    // C5 查看优化回答
    showImprovedId: null,
  },

  onLoad(options) {
    this.setData({ id: options.id })
    this.loadData()
  },

  loadData() {
    api.getInterview(this.data.id).then((data) => {
      this.setData({
        interview: data,
        loading: false,
        roundLabel: util.ROUND_LABELS[data.roundType] || data.roundType,
        dateText: util.formatDate(data.date),
        statusLabel: util.STATUS_LABELS[data.status] || data.status,
        strengths: data.strengths ? JSON.parse(data.strengths) : [],
        improvementAreas: data.improvementAreas ? JSON.parse(data.improvementAreas) : [],
        // C3 薄弱维度：映射中文类别 + 计算进度条百分比
        weaknessAreas: data.weaknessAreas
          ? JSON.parse(data.weaknessAreas).map((w) => ({
              ...w,
              label: util.CATEGORY_LABELS[w.category] || w.category,
              percent: Math.min(100, Math.max(0, (Number(w.score) || 0) * 10)),
            }))
          : [],
      })
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  startReview() {
    this.setData({ reviewing: true })
    api.review(this.data.id).then((result) => {
      this.loadData()
      this.setData({
        reviewing: false,
        nextSteps: (result && result.nextSteps) || null,
      })
    }).catch(() => {
      wx.showToast({ title: "AI 复盘失败", icon: "none" })
      this.setData({ reviewing: false })
    })
  },

  // ── C1 重新分析 ──
  toggleReanalyze() {
    this.setData({
      reanalyzeOpen: !this.data.reanalyzeOpen,
      reanalyzeInstr: "",
    })
  },

  closeReanalyze() {
    this.setData({ reanalyzeOpen: false, reanalyzeInstr: "" })
  },

  onReanalyzeInput(e) {
    this.setData({ reanalyzeInstr: e.detail.value })
  },

  reanalyze() {
    if (this.data.reanalyzing) return
    this.setData({ reanalyzing: true })
    api.review(this.data.id, { instruction: this.data.reanalyzeInstr }).then((result) => {
      this.loadData()
      this.setData({
        reanalyzing: false,
        reanalyzeOpen: false,
        reanalyzeInstr: "",
        nextSteps: (result && result.nextSteps) || null,
      })
    }).catch(() => {
      wx.showToast({ title: "AI 复盘失败", icon: "none" })
      this.setData({ reanalyzing: false })
    })
  },

  // ── C2 单题重新生成 ──
  toggleRegen(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      regenQuestionId: this.data.regenQuestionId === id ? null : id,
      regenInstr: "",
    })
  },

  onRegenInput(e) {
    this.setData({ regenInstr: e.detail.value })
  },

  regenQuestion(e) {
    const id = e.currentTarget.dataset.id
    if (this.data.regeneratingId) return
    this.setData({ regeneratingId: id })
    api.review(this.data.id, {
      mode: "question",
      questionId: id,
      instruction: this.data.regenInstr,
    }).then(() => {
      this.loadData()
      this.setData({ regeneratingId: null, regenQuestionId: null, regenInstr: "" })
    }).catch(() => {
      wx.showToast({ title: "重新生成失败", icon: "none" })
      this.setData({ regeneratingId: null })
    })
  },

  // ── C5 查看优化回答 ──
  toggleImproved(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ showImprovedId: this.data.showImprovedId === id ? null : id })
  },

  updateResult(e) {
    const result = e.currentTarget.dataset.value
    api.updateResult(this.data.id, result).then(() => {
      this.setData({ "interview.result": result })
    })
  },

  deleteInterview() {
    wx.showModal({
      title: "确认删除",
      content: "确定删除这条面试记录？",
      success: (res) => {
        if (res.confirm) {
          api.deleteInterview(this.data.id).then(() => {
            wx.navigateBack()
          })
        }
      },
    })
  },

  goEdit() {
    wx.navigateTo({ url: `/pages/new-interview/new-interview?id=${this.data.id}` })
  },
})
