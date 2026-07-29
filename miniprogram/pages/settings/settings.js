const app = getApp()

Page({
  data: {
    user: null,
    apiKey: "",
    baseUrl: "http://localhost:3000",
  },

  onShow() {
    this.setData({
      user: app.globalData.user,
      apiKey: wx.getStorageSync("anthropic_api_key") || "",
      baseUrl: app.globalData.baseUrl,
    })
  },

  onApiKeyInput(e) {
    this.setData({ apiKey: e.detail.value })
  },

  saveApiKey() {
    wx.setStorageSync("anthropic_api_key", this.data.apiKey)
    wx.showToast({ title: "已保存" })
  },

  onBaseUrlInput(e) {
    this.setData({ baseUrl: e.detail.value })
  },

  saveBaseUrl() {
    app.globalData.baseUrl = this.data.baseUrl
    wx.setStorageSync("baseUrl", this.data.baseUrl)
    wx.showToast({ title: "服务器地址已更新" })
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
