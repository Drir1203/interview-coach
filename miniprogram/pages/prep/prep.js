const api = require("../../utils/api")
const { parseMarkdown } = require("../../utils/markdown")

function withKeys(blocks) {
  return blocks.map((b, i) => ({ ...b, key: i }))
}

Page({
  data: {
    company: "",
    position: "",
    roundType: "first",
    roundTypeLabel: "一面",
    showRoundPicker: false,
    roundColumns: [],
    generating: false,
    planBlocks: [],
    hasPlan: false,
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

  onLoad() {
    this.setData({ roundColumns: this.data.roundTypes.map((r) => r.label) })
  },

  onCompanyInput(e) {
    this.setData({ company: e.detail })
  },

  onPositionInput(e) {
    this.setData({ position: e.detail })
  },

  openRoundPicker() {
    this.setData({ showRoundPicker: true })
  },

  closeRoundPicker() {
    this.setData({ showRoundPicker: false })
  },

  onRoundConfirm(e) {
    const idx = Array.isArray(e.detail.index) ? e.detail.index[0] : e.detail.index
    const rt = this.data.roundTypes[idx] || this.data.roundTypes[0]
    this.setData({
      roundType: rt.value,
      roundTypeLabel: rt.label,
      showRoundPicker: false,
    })
  },

  generate() {
    const company = this.data.company.trim()
    const position = this.data.position.trim()
    if (!company || !position) {
      wx.showToast({ title: "请填写公司和岗位", icon: "none" })
      return
    }

    this.setData({ generating: true })
    api.prepPlan(company, position, this.data.roundType)
      .then((data) => {
        this.setData({
          planBlocks: withKeys(parseMarkdown(data.plan)),
          hasPlan: true,
          generating: false,
        })
      })
      .catch(() => {
        wx.showToast({ title: "押题生成失败，请稍后再试", icon: "none" })
        this.setData({ generating: false })
      })
  },
})
