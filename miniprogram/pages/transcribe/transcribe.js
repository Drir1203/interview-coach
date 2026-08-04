const api = require("../../utils/api")
const { baseUrl } = require("../../config")

Page({
  data: {
    recording: false,
    transcribing: false,
    hasResult: false,
    transcript: "",
    qas: [],
    company: "",
    position: "",
    saving: false,
  },

  onLoad() {
    this.recorder = wx.getRecorderManager()
    this.recorder.onStop((res) => {
      this.setData({ recording: false })
      const duration = Math.max(1, Math.round((Date.now() - this.startTime) / 1000))
      this.upload(res.tempFilePath, duration)
    })
    this.recorder.onError(() => {
      this.setData({ recording: false })
      wx.showToast({ title: "录音失败，请重试", icon: "none" })
    })
  },

  toggleRecord() {
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

  upload(filePath, duration) {
    this.setData({ transcribing: true, hasResult: false })
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
        const qas = (data.qas || []).map((q, i) => ({
          _k: i,
          questionText: q.questionText || "",
          userAnswer: q.userAnswer || "",
        }))
        that.setData({ transcribing: false, hasResult: true, transcript: data.transcript || "", qas })
      },
      fail() {
        that.setData({ transcribing: false })
        wx.showToast({ title: "上传失败，请重试", icon: "none" })
      },
    })
  },

  onCompanyInput(e) { this.setData({ company: e.detail.value }) },
  onPositionInput(e) { this.setData({ position: e.detail.value }) },

  saveAsInterview() {
    const { company, position, qas } = this.data
    if (!company.trim() || !position.trim()) {
      wx.showToast({ title: "请填写公司和岗位", icon: "none" })
      return
    }
    this.setData({ saving: true })
    api.createInterview({
      companyName: company.trim(),
      position: position.trim(),
      roundType: "first",
      questions: qas.map((q, i) => ({
        order: i + 1,
        questionText: q.questionText,
        userAnswer: q.userAnswer || "",
      })),
    }).then((res) => {
      wx.redirectTo({ url: `/pages/interview-detail/interview-detail?id=${res.id}` })
    }).catch(() => {
      wx.showToast({ title: "保存失败", icon: "none" })
      this.setData({ saving: false })
    })
  },
})
