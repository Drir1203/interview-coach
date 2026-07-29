App({
  globalData: {
    baseUrl: "http://localhost:3000",
    token: "",
    user: null,
  },

  onLaunch() {
    const token = wx.getStorageSync("token")
    const user = wx.getStorageSync("user")
    if (token) {
      this.globalData.token = token
      this.globalData.user = user
    }
  },

  setToken(token, user) {
    this.globalData.token = token
    this.globalData.user = user
    wx.setStorageSync("token", token)
    wx.setStorageSync("user", user)
  },

  logout() {
    this.globalData.token = ""
    this.globalData.user = null
    wx.removeStorageSync("token")
    wx.removeStorageSync("user")
    wx.reLaunch({ url: "/pages/login/login" })
  },
})
