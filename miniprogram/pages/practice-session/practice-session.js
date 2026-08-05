const api = require("../../utils/api")
const { baseUrl } = require("../../config")
const { analyzeVoiceState } = require("../../utils/voice")

Page({
  data: {
    sessionId: "",
    company: "",
    position: "",
    messages: [],
    currentAnswer: "",
    phase: "answering", // answering | waiting | finished
    summary: null,
    recording: false,
    transcribing: false,
    voiceState: null,
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

    // 录音管理器（参考 transcribe 页）
    this.recorder = wx.getRecorderManager()
    this.recorder.onStop((res) => {
      const duration = Math.max(1, Math.round((Date.now() - this.startTime) / 1000))
      this.setData({ recording: false, transcribing: true })
      this.uploadVoice(res.tempFilePath, duration)
    })
    this.recorder.onError(() => {
      this.setData({ recording: false, transcribing: false })
      wx.showToast({ title: "录音失败，请重试", icon: "none" })
    })
  },

  onAnswerInput(e) {
    // van-field 的 bind:input 事件 e.detail 就是值
    // 手动编辑输入框时清空语音状态，避免徽章错挂到文字回答上
    this.setData({ currentAnswer: e.detail, voiceState: null })
  },

  toggleRecord() {
    if (this.data.phase !== "answering" || this.data.transcribing) return
    if (this.data.recording) {
      this.recorder.stop()
      return
    }
    const that = this
    wx.authorize({
      scope: "scope.record",
      success() {
        that.startTime = Date.now()
        that.setData({ recording: true })
        that.recorder.start({
          duration: 600000, // 最长 10 分钟
          format: "mp3", // Android 生效；iOS 由系统定为 aac（真机需验证）
          sampleRate: 16000,
          numberOfChannels: 1,
          encodeBitRate: 48000,
        })
      },
      fail() {
        wx.showModal({ title: "需要麦克风权限", content: "请在设置中开启录音权限后重试", showCancel: false })
      },
    })
  },

  uploadVoice(filePath, duration) {
    const that = this
    wx.uploadFile({
      url: baseUrl + "/api/transcribe",
      filePath,
      name: "audio",
      formData: { duration: String(duration) },
      success(res) {
        let data = {}
        try { data = JSON.parse(res.data) } catch (e) { /* 非 JSON 视为失败 */ }
        if (data.error) {
          that.setData({ transcribing: false })
          wx.showToast({ title: data.error, icon: "none" })
          return
        }
        const transcript = (data.transcript || "").trim()
        if (!transcript) {
          that.setData({ transcribing: false })
          wx.showToast({ title: "没听清，请再说一次或直接打字", icon: "none" })
          return
        }
        const voiceState = analyzeVoiceState(transcript, duration)
        that.setData({
          transcribing: false,
          currentAnswer: transcript,
          voiceState,
        })
        wx.showToast({ title: "语音已识别，可编辑后发送", icon: "none" })
      },
      fail() {
        that.setData({ transcribing: false })
        wx.showToast({ title: "上传失败，请重试", icon: "none" })
      },
    })
  },

  handleSend() {
    if (!this.data.currentAnswer.trim() || this.data.phase !== "answering") return

    const answer = this.data.currentAnswer.trim()
    const userMsg = { role: "user", content: answer }
    if (this.data.voiceState) userMsg.voiceState = this.data.voiceState

    this.setData({
      currentAnswer: "",
      voiceState: null,
      phase: "waiting",
      messages: [...this.data.messages, userMsg],
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
