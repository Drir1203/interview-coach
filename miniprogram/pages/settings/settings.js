const app = getApp()
const api = require("../../utils/api")

Page({
  data: {
    user: null,
    loggedIn: false,
    resumeText: "",
    resumeSaving: false,
    showNameEdit: false,
    editName: "",
    showPwdEdit: false,
    oldPwd: "",
    newPwd: "",
    confirmPwd: "",
    pwdSaving: false,
  },

  openPwdEdit() {
    this.setData({ showPwdEdit: true })
  },

  closePwdEdit() {
    this.setData({ showPwdEdit: false })
  },

  onPwdInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail })
  },

  savePwd() {
    const oldPwd = this.data.oldPwd || ""
    const newPwd = this.data.newPwd || ""
    const confirmPwd = this.data.confirmPwd || ""
    if (newPwd.length < 6) {
      wx.showToast({ title: "新密码至少 6 位", icon: "none" })
      return
    }
    if (newPwd !== confirmPwd) {
      wx.showToast({ title: "两次输入不一致", icon: "none" })
      return
    }
    this.setData({ pwdSaving: true })
    api.changePassword({ oldPassword: oldPwd, newPassword: newPwd }).then(() => {
      wx.showToast({ title: "密码已修改", icon: "success" })
      this.setData({ showPwdEdit: false, oldPwd: "", newPwd: "", confirmPwd: "", pwdSaving: false })
    }).catch((err) => {
      wx.showToast({ title: (err && err.message) || "修改失败", icon: "none" })
      this.setData({ pwdSaving: false })
    })
  },

  openNameEdit() {
    this.setData({ showNameEdit: true, editName: this.data.user && this.data.user.name ? this.data.user.name : "" })
  },

  closeNameEdit() {
    this.setData({ showNameEdit: false })
  },

  onNameEditInput(e) {
    this.setData({ editName: e.detail })
  },

  saveName() {
    const name = this.data.editName
    if (!name || !name.trim()) {
      wx.showToast({ title: "请输入昵称", icon: "none" })
      return
    }
    api.updateName(name.trim()).then((data) => {
      const user = app.globalData.user
      app.setToken(app.globalData.token, { ...(user || {}), name: data.name }, app.globalData.tokenName)
      this.setData({ user: app.globalData.user, showNameEdit: false })
      wx.showToast({ title: "已更新", icon: "success" })
    }).catch(() => {
      wx.showToast({ title: "更新失败", icon: "none" })
    })
  },

  onShow() {
    const user = app.globalData.user
    this.setData({
      user,
      loggedIn: !!user,
      avatarLetter: user && user.email ? user.email[0].toUpperCase() : "U",
    })
    this.loadResume()
  },

  loadResume() {
    api.getResume().then((data) => {
      if (data && data.resumeText) this.setData({ resumeText: data.resumeText })
    }).catch(() => {})
  },

  onResumeInput(e) {
    this.setData({ resumeText: e.detail })
  },

  saveResume() {
    const text = this.data.resumeText
    if (!text || !text.trim()) {
      wx.showToast({ title: "请输入简历内容", icon: "none" })
      return
    }
    this.setData({ resumeSaving: true })
    api.saveResumeText(text.trim()).then(() => {
      wx.showToast({ title: "已保存", icon: "success" })
      this.setData({ resumeSaving: false })
    }).catch(() => {
      wx.showToast({ title: "保存失败", icon: "none" })
      this.setData({ resumeSaving: false })
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
