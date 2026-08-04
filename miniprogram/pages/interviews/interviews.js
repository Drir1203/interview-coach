const api = require("../../utils/api")
const util = require("../../utils/util")

Page({
  data: {
    interviews: [],
    loading: true,
    search: "",
    tab: "all",
    filtered: [],
    visible: [],
    visibleCount: 20,
  },

  onShow() {
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData(true)
  },

  loadData(fromPull) {
    this.setData({ loading: true })
    api.getInterviews().then((data) => {
      this.setData({ interviews: data || [], loading: false })
      this.applyFilter()
      if (fromPull) wx.stopPullDownRefresh()
    }).catch(() => {
      this.setData({ loading: false })
      if (fromPull) wx.stopPullDownRefresh()
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
    this.setData({ filtered, visibleCount: 20, visible: filtered.slice(0, 20) })
  },

  updateVisible() {
    this.setData({ visible: this.data.filtered.slice(0, this.data.visibleCount) })
  },

  onReachBottom() {
    const { filtered, visibleCount } = this.data
    if (visibleCount < filtered.length) {
      this.setData({ visibleCount: visibleCount + 20 }, () => this.updateVisible())
    }
  },

  onSearchInput(e) {
    this.setData({ search: e.detail })
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
