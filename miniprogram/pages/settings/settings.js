const app = getApp()

Page({
  data: {
    user: null,
    loggedIn: false,
  },

  onShow() {
    const user = app.globalData.user
    this.setData({
      user,
      loggedIn: !!user,
      avatarLetter: user && user.email ? user.email[0].toUpperCase() : "U",
    })
  },

  goLogin() {
    wx.navigateTo({ url: "/pages/login/login" })
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
