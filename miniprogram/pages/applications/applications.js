const api = require("../../utils/api")
const util = require("../../utils/util")
const { parseMarkdown } = require("../../utils/markdown")

const statusOptions = [
  { value: "applied", label: "已投递" },
  { value: "interviewing", label: "面试中" },
  { value: "offer", label: "已拿Offer" },
  { value: "rejected", label: "已拒绝" },
  { value: "closed", label: "已结束" },
]

const roundOptions = [
  { value: "first", label: "一面" },
  { value: "second", label: "二面" },
  { value: "third", label: "三面" },
  { value: "final", label: "终面" },
  { value: "hr", label: "HR面" },
  { value: "written", label: "笔试" },
  { value: "other", label: "其他" },
]

function statusType(status) {
  if (status === "interviewing") return "primary"
  if (status === "offer") return "success"
  if (status === "rejected") return "danger"
  return "default"
}

Page({
  data: {
    applications: [],
    loading: true,
    showCreate: false,
    createCompany: "",
    createPosition: "",
    createStatus: "applied",
    createStatusLabel: "已投递",
    createRound: "first",
    createRoundLabel: "一面",
    saving: false,
    expandedId: "",
    generatingId: "",
    hasResume: false,
    statusOptions,
    roundOptions,
  },

  onLoad() {
    api.getResume().then((d) => {
      if (d && d.resumeText) this.setData({ hasResume: true })
    }).catch(() => {})
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    this.setData({ loading: true })
    api.getApplications().then((list) => {
      const applications = (list || []).map((a) => {
        const statusIdx = this.data.statusOptions.findIndex((s) => s.value === a.status)
        const roundIdx = this.data.roundOptions.findIndex((r) => r.value === a.currentRound)
        return {
          ...a,
          statusLabel: statusIdx >= 0 ? this.data.statusOptions[statusIdx].label : (a.status || "未知"),
          roundLabel: roundIdx >= 0 ? this.data.roundOptions[roundIdx].label : (a.currentRound || "—"),
          statusType: statusType(a.status),
          statusIndex: statusIdx >= 0 ? statusIdx : 0,
          roundIndex: roundIdx >= 0 ? roundIdx : 0,
          appliedAtText: util.formatDate(a.appliedAt),
          strategyBlocks: [],
        }
      })
      this.setData({ applications, loading: false })
    }).catch(() => {
      this.setData({ loading: false })
      wx.showToast({ title: "加载失败", icon: "none" })
    })
  },

  openCreate() {
    this.setData({ showCreate: true })
  },

  closeCreate() {
    if (this.data.saving) return
    this.setData({ showCreate: false })
  },

  onCreateCompanyInput(e) {
    this.setData({ createCompany: e.detail })
  },

  onCreatePositionInput(e) {
    this.setData({ createPosition: e.detail })
  },

  onCreateStatus(e) {
    // 原生 picker bindchange 携带的是索引（e.detail 的 value 字段），此处用 e.detail["value"]
    const opt = this.data.statusOptions[e.detail["value"]]
    if (!opt) return
    this.setData({ createStatus: opt.value, createStatusLabel: opt.label })
  },

  onCreateRound(e) {
    const opt = this.data.roundOptions[e.detail["value"]]
    if (!opt) return
    this.setData({ createRound: opt.value, createRoundLabel: opt.label })
  },

  submitCreate() {
    const company = (this.data.createCompany || "").trim()
    const position = (this.data.createPosition || "").trim()
    if (!company || !position) {
      wx.showToast({ title: "请填写公司和岗位", icon: "none" })
      return
    }
    this.setData({ saving: true })
    api.createApplication({
      company,
      position,
      status: this.data.createStatus,
      currentRound: this.data.createRound,
    }).then(() => {
      this.setData({
        saving: false,
        showCreate: false,
        createCompany: "",
        createPosition: "",
        createStatus: "applied",
        createStatusLabel: "已投递",
        createRound: "first",
        createRoundLabel: "一面",
      })
      wx.showToast({ title: "已创建", icon: "success" })
      this.loadData()
    }).catch(() => {
      this.setData({ saving: false })
      wx.showToast({ title: "创建失败", icon: "none" })
    })
  },

  changeStatus(e) {
    const id = e.currentTarget.dataset.id
    const opt = this.data.statusOptions[e.detail["value"]]
    if (!id || !opt) return
    api.updateApplication(id, { status: opt.value }).then(() => {
      this.setData({
        applications: this.data.applications.map((a) => {
          if (a.id !== id) return a
          const statusIdx = this.data.statusOptions.findIndex((s) => s.value === opt.value)
          return {
            ...a,
            status: opt.value,
            statusLabel: opt.label,
            statusType: statusType(opt.value),
            statusIndex: statusIdx >= 0 ? statusIdx : 0,
          }
        }),
      })
      wx.showToast({ title: "已更新", icon: "success" })
    }).catch(() => {
      wx.showToast({ title: "更新失败", icon: "none" })
    })
  },

  changeRound(e) {
    const id = e.currentTarget.dataset.id
    const opt = this.data.roundOptions[e.detail["value"]]
    if (!id || !opt) return
    api.updateApplication(id, { currentRound: opt.value }).then(() => {
      this.setData({
        applications: this.data.applications.map((a) => {
          if (a.id !== id) return a
          const roundIdx = this.data.roundOptions.findIndex((r) => r.value === opt.value)
          return {
            ...a,
            currentRound: opt.value,
            roundLabel: opt.label,
            roundIndex: roundIdx >= 0 ? roundIdx : 0,
          }
        }),
      })
      wx.showToast({ title: "已更新", icon: "success" })
    }).catch(() => {
      wx.showToast({ title: "更新失败", icon: "none" })
    })
  },

  toggleExpand(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ expandedId: this.data.expandedId === id ? "" : id })
  },

  generateStrategy(e) {
    const id = e.currentTarget.dataset.id
    if (this.data.generatingId) return
    this.setData({ expandedId: id, generatingId: id })
    api.applicationStrategy(id).then((data) => {
      this.setData({
        generatingId: "",
        applications: util.storeStrategy(this.data.applications, id, parseMarkdown(data.strategy || "")),
      })
    }).catch(() => {
      this.setData({ generatingId: "" })
      wx.showToast({ title: "生成失败", icon: "none" })
    })
  },

  deleteApplication(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.showModal({
      title: "删除求职进度",
      content: "确定删除这条记录？",
      success: (res) => {
        if (!res.confirm) return
        api.deleteApplication(id).then(() => {
          wx.showToast({ title: "已删除", icon: "success" })
          this.loadData()
        }).catch(() => {
          wx.showToast({ title: "删除失败", icon: "none" })
        })
      },
    })
  },
})
