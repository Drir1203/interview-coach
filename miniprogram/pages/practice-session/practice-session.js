const api = require("../../utils/api")

Page({
  data: {
    sessionId: "",
    company: "",
    position: "",
    messages: [],
    currentAnswer: "",
    phase: "answering", // answering | waiting | finished
    summary: null,
  },

  onLoad(options) {
    this.setData({
      sessionId: options.sessionId,
      company: options.company || "未知公司",
      position: options.position || "未知岗位",
    })
  },

  onReady() {
    // 获取第一个问题 - session 已经在 start 时创建
    // 从 options 中获取初始消息
    this.setData({
      messages: [{ role: "assistant", content: "开始面试..." }],
    })
  },

  onAnswerInput(e) {
    this.setData({ currentAnswer: e.detail.value })
  },

  handleSend() {
    if (!this.data.currentAnswer.trim() || this.data.phase !== "answering") return

    const answer = this.data.currentAnswer.trim()
    this.setData({
      currentAnswer: "",
      phase: "waiting",
      messages: [...this.data.messages, { role: "user", content: answer }],
    })

    api.mockRespond(this.data.sessionId, answer).then((data) => {
      if (data.isComplete) {
        const msgs = data.feedback
          ? [...this.data.messages, { role: "assistant", content: data.feedback }]
          : this.data.messages
        this.setData({
          messages: msgs,
          phase: "finished",
          summary: data.summary,
        })
      } else {
        const msgs = data.feedback
          ? [...this.data.messages, { role: "assistant", content: data.feedback + "\n\n" + data.question }]
          : [...this.data.messages, { role: "assistant", content: data.question }]
        this.setData({ messages: msgs, phase: "answering" })
      }
    }).catch(() => {
      wx.showToast({ title: "请求失败", icon: "none" })
      this.setData({ phase: "answering" })
    })
  },

  endSession() {
    this.setData({ phase: "waiting" })
    api.mockEnd(this.data.sessionId).then((data) => {
      this.setData({ phase: "finished", summary: data.summary })
    }).catch(() => {
      wx.showToast({ title: "结束失败", icon: "none" })
      this.setData({ phase: "answering" })
    })
  },

  goBack() {
    wx.navigateBack()
  },
})
