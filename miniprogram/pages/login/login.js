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

  onEmailInput(e) { this.setData({ email: e.detail, error: "" }) },
  onPasswordInput(e) { this.setData({ password: e.detail, error: "" }) },
  onNameInput(e) { this.setData({ name: e.detail, error: "" }) },

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
          this.setData({ error: err.message || "注册失败", loading: false })
        })
    } else {
      this.doLogin(email, password)
    }
  },

  doLogin(email, password) {
    api.login(email, password)
      .then((data) => {
        app.setToken(data.token, { email }, data.cookieName)
        wx.reLaunch({ url: "/pages/index/index" })
      })
      .catch((err) => {
        this.setData({ error: err.message || "邮箱或密码错误", loading: false })
      })
  },

  wechatLogin() {
    this.setData({ loading: true, error: "" })
    wx.login({
      success: (res) => {
        if (!res.code) {
          this.setData({ error: "微信登录失败，请重试", loading: false })
          return
        }
        api.wxLogin(res.code).then((data) => {
          app.setToken(data.token, data.user || { name: "微信用户" }, data.cookieName)
          wx.reLaunch({ url: "/pages/index/index" })
        }).catch((err) => {
          this.setData({ error: err.message || "微信登录失败", loading: false })
        })
      },
      fail: () => {
        this.setData({ error: "微信登录失败，请重试", loading: false })
      },
    })
  },
})
