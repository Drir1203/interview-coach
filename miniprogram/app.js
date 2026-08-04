const { baseUrl } = require("./config")

App({
  globalData: {
    baseUrl,
    token: "",
    tokenName: "authjs.session-token",
    user: null,
  },

  onLaunch() {
    const token = wx.getStorageSync("token")
    const tokenName = wx.getStorageSync("tokenName")
    const user = wx.getStorageSync("user")
    if (token) {
      this.globalData.token = token
      if (tokenName) this.globalData.tokenName = tokenName
      this.globalData.user = user
    }
  },

  setToken(token, user, tokenName) {
    this.globalData.token = token
    this.globalData.user = user
    if (tokenName) {
      this.globalData.tokenName = tokenName
      wx.setStorageSync("tokenName", tokenName)
    }
    wx.setStorageSync("token", token)
    wx.setStorageSync("user", user)
  },

  logout() {
    this.globalData.token = ""
    this.globalData.user = null
    wx.removeStorageSync("token")
    wx.removeStorageSync("tokenName")
    wx.removeStorageSync("user")
    wx.reLaunch({ url: "/pages/login/login" })
  },
})
