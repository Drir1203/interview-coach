const api = require("../../utils/api")
const util = require("../../utils/util")

// 与 Web 端 experiences 接口一致：round 取值与 util.ROUND_LABELS 对齐
const ROUND_TYPES = [
  { value: "first", label: "一面" },
  { value: "second", label: "二面" },
  { value: "third", label: "三面" },
  { value: "final", label: "终面" },
  { value: "hr", label: "HR面" },
  { value: "written", label: "笔试" },
  { value: "other", label: "其他" },
]

Page({
  data: {
    experiences: [],
    loading: true,
    loadError: "",
    searchCompany: "",
    searchPosition: "",
    // 写面经弹窗
    showEditor: false,
    editorCompany: "",
    editorPosition: "",
    editorRound: "first",
    editorRoundLabel: "一面",
    editorQuestion: "",
    editorAnswer: "",
    editorError: "",
    saving: false,
    roundTypes: ROUND_TYPES,
  },

  onShow() {
    this.fetchAll(this.data.searchCompany, this.data.searchPosition, true)
  },

  onPullDownRefresh() {
    this.fetchAll(this.data.searchCompany, this.data.searchPosition, false)
      .then(() => wx.stopPullDownRefresh())
  },

  fetchAll(company, position, showLoading) {
    if (showLoading) this.setData({ loading: true, loadError: "" })
    const feedP = api.getExperiences(company, position).catch(() => null)
    const mineP = api.getMyExperiences().then((l) => l || []).catch(() => [])
    return Promise.all([feedP, mineP])
      .then(([feed, mine]) => {
        if (!Array.isArray(feed)) {
          this.setData({ loadError: "加载面经失败，请稍后重试" })
          return
        }
        const idSet = new Set((mine || []).map((m) => m.id))
        this.setData({
          experiences: feed.map((x) => ({
            ...x,
            roundLabel: util.ROUND_LABELS[x.round] || x.round || "其他",
            dateText: util.formatDate(x.createdAt),
            canDelete: idSet.has(x.id),
            answerOpen: false,
          })),
        })
      })
      .catch(() => {
        this.setData({ loadError: "加载面经失败，请稍后重试" })
      })
      .then(() => this.setData({ loading: false }))
  },

  onSearchCompanyInput(e) { this.setData({ searchCompany: e.detail }) },
  onSearchPositionInput(e) { this.setData({ searchPosition: e.detail }) },

  handleSearch() {
    this.fetchAll(this.data.searchCompany.trim(), this.data.searchPosition.trim(), true)
  },

  resetSearch() {
    this.setData({ searchCompany: "", searchPosition: "" })
    this.fetchAll("", "", true)
  },

  toggleAnswer(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      experiences: this.data.experiences.map((x) =>
        x.id === id ? { ...x, answerOpen: !x.answerOpen } : x
      ),
    })
  },

  // ────────── 写面经（手动贡献）──────────
  openEditor() {
    this.setData({
      showEditor: true,
      editorCompany: "",
      editorPosition: "",
      editorRound: "first",
      editorRoundLabel: "一面",
      editorQuestion: "",
      editorAnswer: "",
      editorError: "",
    })
  },

  closeEditor() {
    if (this.data.saving) return
    this.setData({ showEditor: false })
  },

  onEditorCompanyInput(e) { this.setData({ editorCompany: e.detail }) },
  onEditorPositionInput(e) { this.setData({ editorPosition: e.detail }) },
  onEditorQuestionInput(e) { this.setData({ editorQuestion: e.detail }) },
  onEditorAnswerInput(e) { this.setData({ editorAnswer: e.detail }) },

  onEditorRound(e) {
    const value = e.currentTarget.dataset.value
    const rt = ROUND_TYPES.find((r) => r.value === value) || ROUND_TYPES[0]
    this.setData({ editorRound: rt.value, editorRoundLabel: rt.label })
  },

  submitExperience() {
    const company = (this.data.editorCompany || "").trim()
    const position = (this.data.editorPosition || "").trim()
    const question = (this.data.editorQuestion || "").trim()
    if (!company || !position || !question) {
      this.setData({ editorError: "公司、岗位、题目为必填项" })
      return
    }
    this.setData({ saving: true, editorError: "" })
    const answer = (this.data.editorAnswer || "").trim()
    api.createExperience({
      company,
      position,
      round: this.data.editorRound,
      question,
      ...(answer ? { answer } : {}),
    }).then(() => {
      this.setData({ saving: false, showEditor: false })
      wx.showToast({ title: "贡献成功", icon: "success" })
      this.fetchAll(this.data.searchCompany, this.data.searchPosition, true)
    }).catch((err) => {
      this.setData({ saving: false, editorError: (err && err.message) || "提交失败，请稍后重试" })
    })
  },

  // ────────── 撤回自己发布的面经 ──────────
  deleteExperience(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.showModal({
      title: "撤回面经",
      content: "确定撤回这条面经？撤回后将从面经库移除。",
      success: (res) => {
        if (!res.confirm) return
        api.deleteExperience(id).then(() => {
          wx.showToast({ title: "已撤回", icon: "success" })
          this.setData({ experiences: this.data.experiences.filter((x) => x.id !== id) })
        }).catch((err) => {
          wx.showToast({ title: (err && err.message) || "撤回失败", icon: "none" })
        })
      },
    })
  },
})
