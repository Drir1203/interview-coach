const api = require("../../utils/api")
const app = getApp()

Page({
  data: {
    company: "",
    position: "",
    roundType: "first",
    starting: false,
    roundTypes: [
      { value: "first", label: "一面" },
      { value: "second", label: "二面" },
      { value: "third", label: "三面" },
      { value: "final", label: "终面" },
      { value: "hr", label: "HR面" },
    ],
  },

  onCompanyInput(e) { this.setData({ company: e.detail.value }) },
  onPositionInput(e) { this.setData({ position: e.detail.value }) },
  onRoundChange(e) { this.setData({ roundType: e.detail.value }) },

  startMock() {
    if (!this.data.position.trim()) {
      wx.showToast({ title: "请填写岗位", icon: "none" })
      return
    }
    this.setData({ starting: true })

    api.mockStart(
      this.data.company.trim() || "未知公司",
      this.data.position.trim(),
      this.data.roundType
    ).then((data) => {
      wx.navigateTo({
        url: `/pages/practice-session/practice-session?sessionId=${data.sessionId}&company=${encodeURIComponent(this.data.company || "未知公司")}&position=${encodeURIComponent(this.data.position)}`,
      })
      this.setData({ starting: false })
    }).catch(() => {
      wx.showToast({ title: "启动失败", icon: "none" })
      this.setData({ starting: false })
    })
  },
})
