const api = require("../../utils/api")
const util = require("../../utils/util")

Page({
  data: {
    stats: { total: 0, reviewed: 0, passRate: 0, avgScore: 0 },
    interviews: [],
    loading: true,
    userName: "",
    loggedIn: false,
  },

  onShow() {
    const user = getApp().globalData.user
    this.setData({ userName: user && user.name ? user.name : "", loggedIn: !!user })
    this.loadData()
  },

  goLogin() {
    wx.navigateTo({ url: "/pages/login/login" })
  },

  loadData() {
    this.setData({ loading: true })
    Promise.all([
      api.getInterviews(),
      api.getAnalysis(),
    ]).then(([interviews, analysis]) => {
      const stats = analysis.stats || { total: 0, reviewed: 0, passRate: 0, avgScore: 0 }
      this.setData({
        interviews: (interviews || []).map((i) => ({
          ...i,
          roundLabel: util.ROUND_LABELS[i.roundType] || i.roundType,
          dateText: util.formatDate(i.date),
        })),
        stats,
        passRateDisplay: Math.round((stats.passRate || 0) * 100),
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

  goCoach() {
    wx.navigateTo({ url: "/pages/coach/coach" })
  },

  goPrep() {
    wx.navigateTo({ url: "/pages/prep/prep" })
  },

  goReport() {
    wx.navigateTo({ url: "/pages/report/report" })
  },
})
