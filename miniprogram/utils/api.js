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
  coachChat: (messages, conversationId) => {
    const data = { messages }
    if (conversationId) data.conversationId = conversationId
    return request("/api/coach", "POST", data)
  },

  // 教练历史对话（q 为空时不带 query）
  getCoachConversations: (q) => {
    const base = "/api/coach/conversations"
    return request(q ? base + "?q=" + encodeURIComponent(q) : base)
  },
  getCoachConversation: (id) =>
    request("/api/coach/conversations/" + id),
  renameCoachConversation: (id, title) =>
    request("/api/coach/conversations/" + id, "PUT", { title }),
  deleteCoachConversation: (id) =>
    request("/api/coach/conversations/" + id, "DELETE"),

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

  // 模拟面试（questionBankId 可选：指定我的题库按顺序出题，后端 action=start 用该字段）
  mockStart: (company, position, roundType, resumeMode, questionBankId) =>
    request("/api/mock", "POST", {
      action: "start",
      company,
      position,
      roundType,
      resumeMode,
      ...(questionBankId ? { questionBankId } : {}),
    }),

  mockRespond: (sessionId, answer) =>
    request("/api/mock", "POST", { action: "respond", sessionId, answer }),

  mockEnd: (sessionId) =>
    request("/api/mock", "POST", { action: "end", sessionId }),

  // 会员 / 支付：服务端走「收款码 + 管理员开通」手动模式，小程序轮询订单状态直到 paid
  getSubscription: () => request("/api/subscription"),
  createOrder: (plan) => request("/api/payment/order", "POST", { plan }),
  getOrder: (orderId) => request("/api/payment/order/" + orderId),
  notifyOrder: (orderId) =>
    request("/api/payment/order/" + orderId + "/notify", "POST", {}),
  mockApproveOrder: (orderId) =>
    request("/api/payment/mock/approve", "POST", { orderId }),

  // 我的题库（question-bank）
  getQuestionBanks: () => request("/api/question-bank"),
  deleteQuestionBank: (id) =>
    request("/api/question-bank?id=" + encodeURIComponent(id), "DELETE"),

  // 面经库（experiences）
  getExperiences: (company, position) => {
    const params = []
    if (company) params.push("company=" + encodeURIComponent(company))
    if (position) params.push("position=" + encodeURIComponent(position))
    const qs = params.length ? "?" + params.join("&") : ""
    return request("/api/experiences" + qs)
  },
  getMyExperiences: () => request("/api/experiences/mine"),
  createExperience: (data) => request("/api/experiences", "POST", data),
  deleteExperience: (id) =>
    request("/api/experiences/" + encodeURIComponent(id), "DELETE"),
}
