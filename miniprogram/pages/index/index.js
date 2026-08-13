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

  onPullDownRefresh() {
    this.loadData(true)
  },

  onShareAppMessage() {
    return {
      title: "AI 面师 - 你的 AI 面试教练",
      path: "/pages/index/index",
    }
  },

  goLogin() {
    wx.navigateTo({ url: "/pages/login/login" })
  },

  loadData(fromPull) {
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
      if (fromPull) wx.stopPullDownRefresh()
    }).catch(() => {
      this.setData({ loading: false })
      if (fromPull) wx.stopPullDownRefresh()
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

  goAnalysis() {
    wx.navigateTo({ url: "/pages/analysis/analysis" })
  },

  goTranscribe() {
    wx.navigateTo({ url: "/pages/transcribe/transcribe" })
  },

  goCalendar() {
    wx.navigateTo({ url: "/pages/calendar/calendar" })
  },

  goApplications() {
    wx.navigateTo({ url: "/pages/applications/applications" })
  },

  goCompanies() {
    wx.navigateTo({ url: "/pages/companies/companies" })
  },
})
