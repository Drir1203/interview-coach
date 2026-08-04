const api = require("../../utils/api")
const { parseMarkdown } = require("../../utils/markdown")

function withKeys(blocks) {
  return blocks.map((b, i) => ({ ...b, key: i }))
}

Page({
  data: {
    generating: false,
    reportBlocks: [],
    hasReport: false,
  },

  generate() {
    this.setData({ generating: true })
    api.generateReport()
      .then((data) => {
        this.setData({
          reportBlocks: withKeys(parseMarkdown(data.report)),
          hasReport: true,
          generating: false,
        })
      })
      .catch(() => {
        wx.showToast({ title: "报告生成失败，请稍后再试", icon: "none" })
        this.setData({ generating: false })
      })
  },

  onShareAppMessage() {
    return {
      title: "我的面试成长报告 - AI 面师",
      path: "/pages/report/report",
    }
  },
})
