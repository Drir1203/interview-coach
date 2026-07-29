const api = require("../../utils/api")
const util = require("../../utils/util")

Page({
  data: {
    interviews: [],
    loading: true,
    search: "",
    tab: "all",
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    this.setData({ loading: true })
    api.getInterviews().then((data) => {
      this.setData({ interviews: data || [], loading: false })
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  onSearchInput(e) {
    const search = e.detail.value
    this.setData({ search })
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ tab })
  },

  goNew() {
    wx.navigateTo({ url: "/pages/new-interview/new-interview" })
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/interview-detail/interview-detail?id=${e.currentTarget.dataset.id}` })
  },

  get filtered() {
    const { interviews, search, tab } = this.data
    return interviews.filter((i) => {
      if (tab !== "all" && i.status !== tab) return false
      if (search && !i.company.name.includes(search) && !i.position.includes(search)) return false
      return true
    })
  },
})
