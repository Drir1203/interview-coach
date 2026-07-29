const app = getApp()

function request(url, method = "GET", data = {}) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync("token")
    wx.request({
      url: app.globalData.baseUrl + url,
      method,
      data,
      header: {
        "Content-Type": "application/json",
        ...(token ? { Cookie: `next-auth.session-token=${token}` } : {}),
      },
      success: (res) => {
        if (res.statusCode === 401) {
          app.logout()
          reject(new Error("未登录"))
          return
        }
        resolve(res.data)
      },
      fail: (err) => reject(new Error("网络错误：" + err.errMsg)),
    })
  })
}

module.exports = {
  // 认证
  login: (email, password) =>
    wx.request({
      url: app.globalData.baseUrl + "/api/auth/callback/credentials",
      method: "POST",
      header: { "Content-Type": "application/x-www-form-urlencoded" },
      data: { email, password, csrfToken: "mock", callbackUrl: "/" },
    }),

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

  // 模拟面试
  mockStart: (company, position, roundType) =>
    request("/api/mock", "POST", { action: "start", company, position, roundType }),

  mockRespond: (sessionId, answer) =>
    request("/api/mock", "POST", { action: "respond", sessionId, answer }),

  mockEnd: (sessionId) =>
    request("/api/mock", "POST", { action: "end", sessionId }),
}
