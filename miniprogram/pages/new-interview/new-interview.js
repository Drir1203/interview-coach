const api = require("../../utils/api")
const { POPULAR_POSITIONS, POPULAR_COMPANIES, POPULAR_INDUSTRIES, POPULAR_TAGS } = require("../../utils/options")

Page({
  data: {
    isEdit: false,
    editId: "",
    companyName: "",
    companyIndustry: "",
    position: "",
    positionSuggestions: POPULAR_POSITIONS,
    companySuggestions: POPULAR_COMPANIES,
    industrySuggestions: POPULAR_INDUSTRIES,
    tagSuggestions: POPULAR_TAGS.map((t) => ({ name: t, selected: false })),
    selectedTags: [],
    roundType: "first",
    roundTypeIndex: 0,
    roundTypeLabel: "一面",
    userNotes: "",
    questions: [{ order: 1, questionText: "", userAnswer: "" }],
    saving: false,
    showRoundPicker: false,
    roundColumns: [],
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
    this.setData({ roundColumns: this.data.roundTypes.map((r) => r.label) })
    if (options.id) {
      this.setData({ isEdit: true, editId: options.id })
      api.getInterview(options.id).then((data) => {
        const idx = Math.max(this.data.roundTypes.findIndex((r) => r.value === data.roundType), 0)
        const rt = this.data.roundTypes[idx] || this.data.roundTypes[0]
        this.setData({
          companyName: data.company.name,
          companyIndustry: data.company.industry || "",
          position: data.position,
          roundType: data.roundType,
          roundTypeIndex: idx,
          roundTypeLabel: rt.label,
          userNotes: data.userNotes || "",
          selectedTags: (data.tags || []).map((t) => t.tag.name),
          tagSuggestions: this.data.tagSuggestions.map((s) => ({
            ...s,
            selected: (data.tags || []).some((t) => t.tag.name === s.name),
          })),
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

  onCompanyInput(e) { this.setData({ companyName: e.detail }) },
  onIndustryInput(e) { this.setData({ companyIndustry: e.detail }) },
  onPositionInput(e) { this.setData({ position: e.detail }) },
  onNotesInput(e) { this.setData({ userNotes: e.detail }) },
  openRoundPicker() {
    this.setData({ showRoundPicker: true })
  },

  closeRoundPicker() {
    this.setData({ showRoundPicker: false })
  },

  onRoundConfirm(e) {
    // 扁平 columns 时 simple=true，index 是数字；多列时是数组
    const idx = Array.isArray(e.detail.index) ? e.detail.index[0] : e.detail.index
    const rt = this.data.roundTypes[idx] || this.data.roundTypes[0]
    this.setData({
      roundType: rt.value,
      roundTypeIndex: idx,
      roundTypeLabel: rt.label,
      showRoundPicker: false,
    })
  },

  onQuestionTextInput(e) {
    const idx = e.currentTarget.dataset.idx
    const qs = this.data.questions
    qs[idx].questionText = e.detail
    this.setData({ questions: qs })
  },

  onAnswerInput(e) {
    const idx = e.currentTarget.dataset.idx
    const qs = this.data.questions
    qs[idx].userAnswer = e.detail
    this.setData({ questions: qs })
  },

  toggleTag(e) {
    const tag = e.currentTarget.dataset.tag
    if (!tag) return
    const cur = this.data.selectedTags
    const next = cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]
    const tagSuggestions = this.data.tagSuggestions.map((s) =>
      s.name === tag ? { ...s, selected: !s.selected } : s
    )
    this.setData({ selectedTags: next, tagSuggestions })
  },

  removeTag(e) {
    const tag = e.currentTarget.dataset.tag
    this.setData({ selectedTags: this.data.selectedTags.filter((t) => t !== tag) })
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
      tags: this.data.selectedTags,
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
