const { baseUrl } = require("../config")

function request(url, method = "GET", data = {}) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync("token")
    const tokenName = wx.getStorageSync("tokenName") || "authjs.session-token"
    wx.request({
      url: baseUrl + url,
      method,
      data,
      header: {
        "Content-Type": "application/json",
        ...(token ? { Cookie: `${tokenName}=${token}` } : {}),
      },
      success: (res) => {
        if (res.statusCode === 401) {
          getApp().logout()
          reject(new Error("未登录"))
          return
        }
        if (res.statusCode >= 400) {
          reject(new Error(res.data?.error || `请求失败(${res.statusCode})`))
          return
        }
        resolve(res.data)
      },
      fail: (err) => reject(new Error("网络错误：" + err.errMsg)),
    })
  })
}

module.exports = {
  request,
  // 认证
  login: (email, password) =>
    request("/api/auth/mp-login", "POST", { email, password }),

  register: (name, email, password) =>
    request("/api/auth/register", "POST", { name, email, password }),

  // 面试
  getInterviews: () => request("/api/interviews"),
  getInterview: (id) => request("/api/interviews/" + id),
  createInterview: (data) => request("/api/interviews", "POST", data),
  deleteInterview: (id) => request("/api/interviews/" + id, "DELETE"),
  updateResult: (id, result) =>
    request("/api/interviews/" + id, "PUT", { result }),

  // AI 复盘
  review: (interviewId) =>
    request("/api/review", "POST", { interviewId }),

  // 分析
  getAnalysis: () => request("/api/analysis"),
  getDeepAnalysis: () => request("/api/analysis/deep"),

  // AI 功能
  coachChat: (messages) =>
    request("/api/coach", "POST", { messages }),

  prepPlan: (company, position, roundType) =>
    request("/api/prep", "POST", { company, position, roundType }),

  generateReport: () =>
    request("/api/report", "POST", {}),

  // 模拟面试
  mockStart: (company, position, roundType) =>
    request("/api/mock", "POST", { action: "start", company, position, roundType }),

  mockRespond: (sessionId, answer) =>
    request("/api/mock", "POST", { action: "respond", sessionId, answer }),

  mockEnd: (sessionId) =>
    request("/api/mock", "POST", { action: "end", sessionId }),
}
