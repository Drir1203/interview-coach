const api = require("../../utils/api")
const util = require("../../utils/util")

Page({
  data: {
    interviews: [],
    loading: true,
    search: "",
    tab: "all",
    filtered: [],
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    this.setData({ loading: true })
    api.getInterviews().then((data) => {
      this.setData({ interviews: data || [], loading: false })
      this.applyFilter()
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  applyFilter() {
    const { interviews, search, tab } = this.data
    const filtered = interviews.filter((i) => {
      if (tab !== "all" && i.status !== tab) return false
      if (search && !i.company.name.includes(search) && !i.position.includes(search)) return false
      return true
    }).map((i) => ({
      ...i,
      statusLabel: util.STATUS_LABELS[i.status] || i.status,
    }))
    this.setData({ filtered })
  },

  onSearchInput(e) {
    this.setData({ search: e.detail.value })
    this.applyFilter()
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab })
    this.applyFilter()
  },

  goNew() {
    wx.navigateTo({ url: "/pages/new-interview/new-interview" })
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/interview-detail/interview-detail?id=${e.currentTarget.dataset.id}` })
  },
})
