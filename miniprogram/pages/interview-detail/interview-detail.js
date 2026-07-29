const api = require("../../utils/api")
const util = require("../../utils/util")

Page({
  data: {
    interview: null,
    loading: true,
    reviewing: false,
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
        strengths: data.strengths ? JSON.parse(data.strengths) : [],
        improvementAreas: data.improvementAreas ? JSON.parse(data.improvementAreas) : [],
        weaknessAreas: data.weaknessAreas ? JSON.parse(data.weaknessAreas) : [],
      })
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  startReview() {
    this.setData({ reviewing: true })
    api.review(this.data.id).then(() => {
      this.loadData()
      this.setData({ reviewing: false })
    }).catch(() => {
      wx.showToast({ title: "AI 复盘失败", icon: "none" })
      this.setData({ reviewing: false })
    })
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
