const api = require("../../utils/api")
const util = require("../../utils/util")

Page({
  data: {
    loading: true,
    companies: [],
  },

  onLoad() {
    this.loadData()
  },

  loadData() {
    this.setData({ loading: true })
    api.getInterviews()
      .then((interviews) => {
        // 按 company 分组（对齐 Web companies/page.tsx 逻辑）
        const grouped = {}
        for (const iv of interviews || []) {
          const c = iv.company
          if (!c) continue
          if (!grouped[c.id]) {
            grouped[c.id] = { ...c, interviews: [] }
          }
          grouped[c.id].interviews.push({
            id: iv.id,
            position: iv.position,
            dateText: util.formatDate(iv.date),
            overallScore: iv.overallScore,
          })
        }
        const companies = Object.values(grouped).map((company) => {
          const reviewed = company.interviews.filter((i) => i.overallScore)
          const avgScore = reviewed.length
            ? reviewed.reduce((s, i) => s + i.overallScore, 0) / reviewed.length
            : null
          return {
            ...company,
            avgScore,
            avgScoreText: avgScore ? avgScore.toFixed(1) : "",
            topInterviews: company.interviews.slice(0, 3),
            showMore: company.interviews.length > 3,
            moreCount: company.interviews.length - 3,
          }
        })
        this.setData({ companies, loading: false })
      })
      .catch(() => {
        this.setData({ loading: false })
      })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/interview-detail/interview-detail?id=${id}` })
  },
})
