const app = getApp()
const api = require("../../utils/api")

Page({
  data: {
    email: "",
    password: "",
    name: "",
    loading: false,
    error: "",
    isRegister: false,
  },

  onEmailInput(e) { this.setData({ email: e.detail.value, error: "" }) },
  onPasswordInput(e) { this.setData({ password: e.detail.value, error: "" }) },
  onNameInput(e) { this.setData({ name: e.detail.value, error: "" }) },

  switchMode() {
    this.setData({ isRegister: !this.data.isRegister, error: "" })
  },

  handleSubmit() {
    const { email, password, name, isRegister } = this.data
    if (!email || !password) {
      this.setData({ error: "请填写邮箱和密码" })
      return
    }
    if (isRegister && !name) {
      this.setData({ error: "请填写昵称" })
      return
    }

    this.setData({ loading: true, error: "" })

    if (isRegister) {
      api.register(name, email, password)
        .then(() => this.doLogin(email, password))
        .catch((err) => {
          this.setData({ error: err.error || "注册失败", loading: false })
        })
    } else {
      this.doLogin(email, password)
    }
  },

  doLogin(email, password) {
    const that = this
    wx.request({
      url: getApp().globalData.baseUrl + "/api/auth/callback/credentials",
      method: "POST",
      header: { "Content-Type": "application/x-www-form-urlencoded" },
      data: { email, password, csrfToken: "mock", callbackUrl: "/" },
      success(res) {
        if (res.statusCode === 200) {
          app.setToken("authenticated", { email })
          wx.reLaunch({ url: "/pages/index/index" })
        } else {
          that.setData({ error: "邮箱或密码错误", loading: false })
        }
      },
      fail() {
        that.setData({ error: "网络错误，请检查服务器是否启动", loading: false })
      },
    })
  },
})
