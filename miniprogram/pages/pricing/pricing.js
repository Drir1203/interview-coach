// 定价 / 会员页：展示会员状态 + Pro 订阅与语音点数包，下单走
// POST /api/payment/order → 展示收款码（paymentConfig）→ 轮询订单状态 → paid 后刷新会员
// 生产为「收款码 + 管理员开通」手动模式；mockAction === "auto"（本地/测试）时展示模拟支付按钮
const app = getApp()
const api = require("../../utils/api")
const util = require("../../utils/util")

// 轮询间隔 / 连续失败上限（达到上限停止静默重试，提示用户手动查看）
const POLL_INTERVAL_MS = 3000
const POLL_MAX_FAILURES = 10

const VOICE_PACKS = [
  { id: "voice10", name: "语音 10 场", price: "¥29", unit: "¥2.9/场", note: "灵活尝鲜，适合低频加场" },
  { id: "voice30", name: "语音 30 场", price: "¥69", unit: "¥2.3/场", note: "求职冲刺期之选", hot: true },
  { id: "voice100", name: "语音 100 场", price: "¥199", unit: "¥2.0/场", note: "长期使用最划算" },
]

const ORDER_STORAGE_KEY = "pricingOrder"

function buildMember(s) {
  if (!s) return null
  const loggedIn = !!(s && s.user)
  const isPro = s.tier === "pro"
  const inTrial = isPro && s.source === "trial"
  const used = s.voiceUsedThisMonth || 0
  const quota = s.voiceMonthlyQuota || 0

  let tierLabel
  let tierDesc
  if (!loggedIn) {
    tierLabel = "未登录"
    tierDesc = "登录后可购买 Pro 会员 / 语音点数包"
  } else if (isPro) {
    tierLabel = "Pro 会员"
    tierDesc = inTrial
      ? `7 天试用 · 剩余 ${s.daysLeft || 0} 天 · AI 语音含 ${quota} 场`
      : `会员有效期至 ${util.formatDate(s.proExpiresAt) || "—"} · AI 语音已用 ${used}/${quota} 场`
  } else {
    tierLabel = "免费用户"
    tierDesc = `已记录 ${s.interviewCount || 0}/${s.freeLimit || 5} 场文字面试 · AI 语音需点数包`
  }

  return {
    loggedIn,
    isPro,
    isTrial: inTrial,
    tierLabel,
    tierDesc,
    voiceUsageText: !loggedIn ? "—" : isPro ? `${used}/${quota} 场` : "需 Pro 或点数包",
    voiceCreditsText: !loggedIn ? "—" : String(s.voiceCredits || 0),
    voiceCredits: s.voiceCredits || 0,
    interviewCount: s.interviewCount || 0,
    freeLimit: s.freeLimit || 5,
  }
}

function buildOrder(o) {
  if (!o) return null
  const wechatQrUrl = (o.paymentConfig && o.paymentConfig.wechatQrUrl) || ""
  const alipayQrUrl = (o.paymentConfig && o.paymentConfig.alipayQrUrl) || ""
  const isVoice = o.planKind === "voice"
  const orderId = o.orderId || ""
  return {
    orderId,
    orderIdTail: orderId ? orderId.slice(-8) : "",
    amountYuan: ((o.amount || 0) / 100).toFixed(2),
    desc: isVoice
      ? `即时到账 ${o.credits || 0} 场语音点数`
      : "有效期 30 天（续费自动叠加）",
    isVoice,
    mockAction: o.mockAction || "manual",
    hasQr: !!(wechatQrUrl || alipayQrUrl),
    showChannelSwitch: !!(wechatQrUrl && alipayQrUrl),
    qrChannel: alipayQrUrl && !wechatQrUrl ? "alipay" : "wechat",
    activeQrUrl: wechatQrUrl || alipayQrUrl,
    wechatQrUrl,
    alipayQrUrl,
    accountHint: (o.paymentConfig && o.paymentConfig.accountHint) || "",
  }
}

Page({
  data: {
    member: null,
    voicePacks: VOICE_PACKS,
    order: null,
    orderActive: false,
    notified: false,
    ordering: "",
    acting: false,
  },

  onLoad() {
    this.resumeOrder()
  },

  onShow() {
    this.loadMember()
  },

  onHide() {
    this.stopPolling()
  },

  onUnload() {
    this.stopPolling()
  },

  goLogin() {
    wx.navigateTo({ url: "/pages/login/login" })
  },

  loadMember() {
    api.getSubscription().then((data) => {
      const member = buildMember(data)
      this.setData({ member })
      // 后台已开通而本页停留在旧会员状态时同步刷新
      if (member && member.loggedIn && this.data.orderActive) {
        this.checkCurrentOrderPaid()
      }
    }).catch(() => {
      // 网络失败：保留上次 member，避免整页闪空
    })
  },

  // 恢复上次未完成订单（离开页面再回来时避免重复下单）
  resumeOrder() {
    const raw = wx.getStorageSync(ORDER_STORAGE_KEY)
    if (!raw || !raw.orderId) return
    const order = buildOrder(raw)
    this.setData({ order, orderActive: true, notified: !!raw.userNotifiedAt })
    this.startPolling()
  },

  persistOrder(raw) {
    wx.setStorageSync(ORDER_STORAGE_KEY, raw)
  },

  clearOrderStore() {
    wx.removeStorageSync(ORDER_STORAGE_KEY)
  },

  onBuy(e) {
    const plan = e.currentTarget.dataset.plan
    if (!this.data.member || !this.data.member.loggedIn) {
      wx.showToast({ title: "请先登录后再购买", icon: "none" })
      this.goLogin()
      return
    }
    if (this.data.orderActive || this.data.ordering) return
    this.setData({ ordering: plan })
    api.createOrder(plan).then((data) => {
      const order = buildOrder(data)
      this.setData({ order, orderActive: true, ordering: "", notified: false })
      this.persistOrder(data)
      if (order.mockAction === "manual") {
        wx.showToast({
          title: order.hasQr ? "订单已提交，请扫码付款" : "订单已提交，等待管理员开通",
          icon: "none",
        })
      }
      this.startPolling()
    }).catch((err) => {
      this.setData({ ordering: "" })
      wx.showToast({ title: (err && err.message) || "下单失败，请稍后重试", icon: "none" })
    })
  },

  startPolling() {
    this.stopPolling()
    const order = this.data.order
    if (!order || !order.orderId) return
    let failures = 0
    this._pollTimer = setInterval(() => {
      api.getOrder(order.orderId).then((data) => {
        failures = 0
        if (data && data.status === "paid") {
          this.onOrderPaid(order.orderId)
        } else if (data && data.userNotifiedAt) {
          this.setData({ notified: true })
        }
      }).catch(() => {
        failures += 1
        if (failures >= POLL_MAX_FAILURES) {
          this.stopPolling()
          wx.showToast({ title: "订单状态查询失败，可稍后手动查看", icon: "none" })
        }
      })
    }, POLL_INTERVAL_MS)
  },

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer)
      this._pollTimer = null
    }
  },

  // 订单已开通：清状态、去本地订单、提示、刷新会员
  onOrderPaid(orderId) {
    this.stopPolling()
    const order = this.data.order
    const isVoice = !!(order && order.isVoice)
    this.clearOrderStore()
    this.setData({ order: null, orderActive: false, notified: false, ordering: "", acting: false })
    wx.showToast({ title: isVoice ? "语音点数已到账" : "Pro 已开通", icon: "success" })
    this.loadMember()
  },

  // 用户「我已转账」声明：通知平台，管理员确认到账后自动开通
  onNotify() {
    const order = this.data.order
    if (!order || !order.orderId) return
    this.setData({ acting: true })
    api.notifyOrder(order.orderId).then(() => {
      this.setData({ notified: true, acting: false })
      wx.showToast({ title: "已通知平台，等待管理员确认到账", icon: "none" })
    }).catch((err) => {
      this.setData({ acting: false })
      wx.showToast({ title: (err && err.message) || "通知失败，请稍后重试", icon: "none" })
    })
  },

  // 本地/测试模式：模拟支付成功（mockAction === "auto" 才展示入口）
  onMockPay() {
    const order = this.data.order
    if (!order || !order.orderId) return
    this.setData({ acting: true })
    api.mockApproveOrder(order.orderId).then(() => {
      this.onOrderPaid(order.orderId)
    }).catch((err) => {
      this.setData({ acting: false })
      wx.showToast({ title: (err && err.message) || "模拟支付失败", icon: "none" })
    })
  },

  previewQr() {
    const order = this.data.order
    if (!order) return
    const urls = []
    if (order.wechatQrUrl) urls.push(order.wechatQrUrl)
    if (order.alipayQrUrl) urls.push(order.alipayQrUrl)
    if (!urls.length) return
    const current = order.qrChannel === "wechat" ? order.wechatQrUrl : order.alipayQrUrl
    wx.previewImage({ current, urls })
  },

  switchQr(e) {
    const channel = e.currentTarget.dataset.channel
    const order = this.data.order
    if (!order || (channel !== "wechat" && channel !== "alipay")) return
    const next = Object.assign({}, order, {
      qrChannel: channel,
      activeQrUrl: channel === "wechat" ? order.wechatQrUrl : order.alipayQrUrl,
    })
    this.setData({ order: next })
  },

  // 重新进入页面时顺带查一次当前本地订单是否已 paid（服务端管理员可能已放行）
  checkCurrentOrderPaid() {
    const order = this.data.order
    if (!order || !order.orderId) return
    api.getOrder(order.orderId).then((data) => {
      if (data && data.status === "paid") this.onOrderPaid(order.orderId)
    }).catch(() => {})
  },
})
