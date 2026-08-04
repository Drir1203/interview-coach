const api = require("../../utils/api")
const util = require("../../utils/util")

Page({
  data: {
    year: 0,
    month: 0,
    monthLabel: "",
    days: [],
    selectedDate: "",
    dayInterviews: [],
    loading: true,
  },

  onLoad() {
    const now = new Date()
    this.setData({ year: now.getFullYear(), month: now.getMonth() + 1 })
    this.loadData()
  },

  loadData() {
    this.setData({ loading: true })
    api.getInterviews().then((data) => {
      this.interviews = data || []
      const dateMap = {}
      this.interviews.forEach((i) => {
        if (i.date) {
          const d = i.date.slice(0, 10)
          dateMap[d] = (dateMap[d] || 0) + 1
        }
      })
      this.dateMap = dateMap
      this.buildCalendar()
      this.setData({ loading: false })
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  buildCalendar() {
    const { year, month } = this.data
    const daysInMonth = new Date(year, month, 0).getDate()
    const startWeekday = new Date(year, month - 1, 1).getDay()
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    const days = []

    for (let i = 0; i < startWeekday; i++) days.push({ key: "blank-" + i, day: "", isBlank: true })

    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      const count = this.dateMap[date] || 0
      days.push({
        key: date,
        day: d,
        isBlank: false,
        date,
        hasInterview: count > 0,
        count,
        isToday: date === todayStr,
      })
    }
    while (days.length % 7 !== 0) days.push({ key: "tail-" + days.length, day: "", isBlank: true })

    const sel = this.data.selectedDate || todayStr
    this.setData({ days, monthLabel: `${year}年${month}月`, selectedDate: sel })
    this.updateDayInterviews(sel)
  },

  prevMonth() {
    let { year, month } = this.data
    month--
    if (month < 1) { month = 12; year-- }
    this.setData({ year, month }, () => this.buildCalendar())
  },

  nextMonth() {
    let { year, month } = this.data
    month++
    if (month > 12) { month = 1; year++ }
    this.setData({ year, month }, () => this.buildCalendar())
  },

  selectDay(e) {
    const date = e.currentTarget.dataset.date
    if (!date) return
    this.setData({ selectedDate: date })
    this.updateDayInterviews(date)
  },

  updateDayInterviews(date) {
    const dayInterviews = (this.interviews || [])
      .filter((i) => i.date && i.date.slice(0, 10) === date)
      .map((i) => ({
        id: i.id,
        title: i.company.name + " · " + i.position,
        label: (util.ROUND_LABELS[i.roundType] || i.roundType) + " · " + util.formatDate(i.date) + " · " + (util.STATUS_LABELS[i.status] || i.status),
        score: i.overallScore ? i.overallScore.toFixed(1) : "",
      }))
    this.setData({ dayInterviews })
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/interview-detail/interview-detail?id=${e.currentTarget.dataset.id}` })
  },
})
