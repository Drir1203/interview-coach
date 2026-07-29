const app = getApp()

Page({
  data: {
    user: null,
  },

  onShow() {
    this.setData({ user: app.globalData.user })
  },

  logout() {
    wx.showModal({
      title: "退出登录",
      content: "确定退出？",
      success: (res) => {
        if (res.confirm) app.logout()
      },
    })
  },
})
