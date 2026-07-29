const api = require("../../utils/api")
const util = require("../../utils/util")

Page({
  data: {
    stats: { total: 0, reviewed: 0, passRate: 0, avgScore: 0 },
    interviews: [],
    loading: true,
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    this.setData({ loading: true })
    Promise.all([
      api.getInterviews(),
      api.getAnalysis(),
    ]).then(([interviews, analysis]) => {
      this.setData({
        interviews,
        stats: analysis.stats || { total: 0, reviewed: 0, passRate: 0, avgScore: 0 },
        loading: false,
      })
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  goNew() {
    wx.navigateTo({ url: "/pages/new-interview/new-interview" })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/interview-detail/interview-detail?id=${id}` })
  },
})
