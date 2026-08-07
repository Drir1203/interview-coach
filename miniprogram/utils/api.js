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

  wxLogin: (code) =>
    request("/api/auth/wx-login", "POST", { code }),

  register: (name, email, password) =>
    request("/api/auth/register", "POST", { name, email, password }),

  // 面试
  getInterviews: () => request("/api/interviews"),
  getInterview: (id) => request("/api/interviews/" + id),
  createInterview: (data) => request("/api/interviews", "POST", data),
  deleteInterview: (id) => request("/api/interviews/" + id, "DELETE"),
  updateResult: (id, result) =>
    request("/api/interviews/" + id, "PUT", { result }),

  // AI 复盘（options: { mode?: "full"|"question", questionId?, instruction? }）
  review: (interviewId, options = {}) => {
    const data = { interviewId }
    if (options.mode) data.mode = options.mode
    if (options.questionId) data.questionId = options.questionId
    const instruction =
      typeof options.instruction === "string" ? options.instruction.trim() : ""
    if (instruction) data.instruction = instruction
    return request("/api/review", "POST", data)
  },

  // 分析
  getAnalysis: () => request("/api/analysis"),
  getDeepAnalysis: () => request("/api/analysis/deep"),

  // 简历
  getResume: () => request("/api/profile/resume"),
  saveResumeText: (resumeText) =>
    request("/api/profile/resume-text", "POST", { resumeText }),

  // 资料
  updateName: (name) =>
    request("/api/profile/name", "POST", { name }),

  changePassword: (data) =>
    request("/api/auth/change-password", "POST", data),

  // AI 功能
  coachChat: (messages) =>
    request("/api/coach", "POST", { messages }),

  prepPlan: (company, position, roundType) =>
    request("/api/prep", "POST", { company, position, roundType }),

  generateReport: () =>
    request("/api/report", "POST", {}),

  // 求职进度
  getApplications: () => request("/api/applications"),
  createApplication: (data) => request("/api/applications", "POST", data),
  updateApplication: (id, data) => request("/api/applications/" + id, "PUT", data),
  deleteApplication: (id) => request("/api/applications/" + id, "DELETE"),
  applicationStrategy: (id) =>
    request("/api/applications/" + id + "/strategy", "POST", {}),

  // 模拟面试
  mockStart: (company, position, roundType, resumeMode) =>
    request("/api/mock", "POST", { action: "start", company, position, roundType, resumeMode }),

  mockRespond: (sessionId, answer) =>
    request("/api/mock", "POST", { action: "respond", sessionId, answer }),

  mockEnd: (sessionId) =>
    request("/api/mock", "POST", { action: "end", sessionId }),
}
