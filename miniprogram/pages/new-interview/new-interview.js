const api = require("../../utils/api")

Page({
  data: {
    isEdit: false,
    editId: "",
    companyName: "",
    companyIndustry: "",
    position: "",
    roundType: "first",
    userNotes: "",
    questions: [{ order: 1, questionText: "", userAnswer: "" }],
    saving: false,
    roundTypes: [
      { value: "first", label: "一面" },
      { value: "second", label: "二面" },
      { value: "third", label: "三面" },
      { value: "final", label: "终面" },
      { value: "hr", label: "HR面" },
      { value: "written", label: "笔试" },
      { value: "other", label: "其他" },
    ],
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ isEdit: true, editId: options.id })
      api.getInterview(options.id).then((data) => {
        this.setData({
          companyName: data.company.name,
          companyIndustry: data.company.industry || "",
          position: data.position,
          roundType: data.roundType,
          userNotes: data.userNotes || "",
          questions: data.questions.length > 0
            ? data.questions.map((q) => ({
                order: q.order,
                questionText: q.questionText,
                userAnswer: q.userAnswer || "",
              }))
            : [{ order: 1, questionText: "", userAnswer: "" }],
        })
      })
    }
  },

  onCompanyInput(e) { this.setData({ companyName: e.detail.value }) },
  onIndustryInput(e) { this.setData({ companyIndustry: e.detail.value }) },
  onPositionInput(e) { this.setData({ position: e.detail.value }) },
  onNotesInput(e) { this.setData({ userNotes: e.detail.value }) },
  onRoundChange(e) { this.setData({ roundType: e.detail.value }) },

  onQuestionTextInput(e) {
    const idx = e.currentTarget.dataset.idx
    const qs = this.data.questions
    qs[idx].questionText = e.detail.value
    this.setData({ questions: qs })
  },

  onAnswerInput(e) {
    const idx = e.currentTarget.dataset.idx
    const qs = this.data.questions
    qs[idx].userAnswer = e.detail.value
    this.setData({ questions: qs })
  },

  addQuestion() {
    const qs = this.data.questions
    qs.push({ order: qs.length + 1, questionText: "", userAnswer: "" })
    this.setData({ questions: qs })
  },

  removeQuestion(e) {
    const idx = e.currentTarget.dataset.idx
    const qs = this.data.questions.filter((_, i) => i !== idx)
    this.setData({ questions: qs.map((q, i) => ({ ...q, order: i + 1 })) })
  },

  handleSave() {
    const { companyName, position, questions } = this.data
    if (!companyName.trim() || !position.trim()) {
      wx.showToast({ title: "请填写公司和岗位", icon: "none" })
      return
    }

    this.setData({ saving: true })
    const payload = {
      companyName: companyName.trim(),
      companyIndustry: this.data.companyIndustry.trim() || undefined,
      position: position.trim(),
      roundType: this.data.roundType,
      userNotes: this.data.userNotes.trim() || undefined,
      questions: questions.filter((q) => q.questionText.trim()).map((q) => ({
        order: q.order,
        questionText: q.questionText.trim(),
        userAnswer: q.userAnswer.trim() || undefined,
      })),
    }

    if (this.data.isEdit) {
      api.request("/api/interviews/" + this.data.editId, "PUT", payload)
        .then(() => {
          wx.navigateBack()
        })
        .catch(() => {
          wx.showToast({ title: "保存失败", icon: "none" })
          this.setData({ saving: false })
        })
    } else {
      api.createInterview(payload).then((res) => {
        wx.redirectTo({ url: `/pages/interview-detail/interview-detail?id=${res.id}` })
      }).catch(() => {
        wx.showToast({ title: "保存失败", icon: "none" })
        this.setData({ saving: false })
      })
    }
  },
})
