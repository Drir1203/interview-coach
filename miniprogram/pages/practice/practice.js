const api = require("../../utils/api")
const app = getApp()
const { POPULAR_POSITIONS, POPULAR_COMPANIES } = require("../../utils/options")

Page({
  data: {
    company: "",
    position: "",
    positionSuggestions: POPULAR_POSITIONS,
    companySuggestions: POPULAR_COMPANIES,
    roundType: "first",
    roundTypeLabel: "一面",
    starting: false,
    grillMode: false,
    hasResume: false,
    showRoundPicker: false,
    roundColumns: [],
    // 我的题库（可选，按题库练习）
    banks: [],
    banksLoading: false,
    selectedBankId: "",
    selectedBankName: "",
    roundTypes: [
      { value: "first", label: "一面" },
      { value: "second", label: "二面" },
      { value: "third", label: "三面" },
      { value: "final", label: "终面" },
      { value: "hr", label: "HR面" },
    ],
  },

  onLoad() {
    this.setData({ roundColumns: this.data.roundTypes.map((r) => r.label) })
    this.checkResume()
  },

  onShow() {
    this.checkResume()
    this.loadBanks()
  },

  loadBanks() {
    if (this.data.banksLoading) return
    this.setData({ banksLoading: true })
    api.getQuestionBanks().then((data) => {
      const banks = (data && data.banks) || []
      this.setData({ banks, banksLoading: false })
      // 已选的题库被删时，自动取消选择
      if (this.data.selectedBankId && !banks.some((b) => b.id === this.data.selectedBankId)) {
        this.setData({ selectedBankId: "", selectedBankName: "" })
      }
    }).catch(() => {
      this.setData({ banksLoading: false })
    })
  },

  selectBank(e) {
    const id = e.currentTarget.dataset.id
    const bank = this.data.banks.find((b) => b.id === id)
    if (!bank) return
    const selecting = this.data.selectedBankId === id
    this.setData({
      selectedBankId: selecting ? "" : id,
      selectedBankName: selecting ? "" : bank.name,
      // 与 Web 一致：已选题库时按题库出题，简历深挖不再生效
      grillMode: false,
    })
  },

  goQuestionBank() {
    wx.navigateTo({ url: "/pages/question-bank/question-bank" })
  },

  checkResume() {
    api.getResume().then((d) => {
      if (d && d.resumeText) this.setData({ hasResume: true })
    }).catch(() => {})
  },

  onGrillToggle(e) {
    // 原生 switch bindchange 的值在 e.detail 的 value 字段（此处用 e.detail["value"] 规避 lint 规则）
    this.setData({ grillMode: e.detail["value"] })
  },

  onCompanyInput(e) { this.setData({ company: e.detail }) },
  onPositionInput(e) { this.setData({ position: e.detail }) },
  openRoundPicker() {
    this.setData({ showRoundPicker: true })
  },

  closeRoundPicker() {
    this.setData({ showRoundPicker: false })
  },

  onRoundConfirm(e) {
    // 扁平 columns 时 simple=true，index 是数字；多列时是数组
    const idx = Array.isArray(e.detail.index) ? e.detail.index[0] : e.detail.index
    const rt = this.data.roundTypes[idx] || this.data.roundTypes[0]
    this.setData({
      roundType: rt.value,
      roundTypeLabel: rt.label,
      showRoundPicker: false,
    })
  },

  startMock() {
    if (!this.data.position.trim()) {
      wx.showToast({ title: "请填写岗位", icon: "none" })
      return
    }
    this.setData({ starting: true })

    api.mockStart(
      this.data.company.trim() || "未知公司",
      this.data.position.trim(),
      this.data.roundType,
      this.data.grillMode,
      this.data.selectedBankId
    ).then((data) => {
      wx.navigateTo({
        url: `/pages/practice-session/practice-session?sessionId=${data.sessionId}&company=${encodeURIComponent(this.data.company || "未知公司")}&position=${encodeURIComponent(this.data.position)}`,
      })
      this.setData({ starting: false })
    }).catch((err) => {
      const msg = (err && err.message) || "启动失败"
      wx.showToast({ title: msg, icon: "none" })
      this.setData({ starting: false })
    })
  },
})
