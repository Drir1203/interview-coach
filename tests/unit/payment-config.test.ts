import { describe, it, expect } from "vitest"
import { sanitizePaymentConfig } from "@/lib/payment/payment-config"

// sanitizePaymentConfig：admin 收款设置保存前的输入清洗（纯函数）。
// 只接受 http(s) 图片 URL 或空串；文案裁剪 + 限长。非法输入 → ok:false + 中文错误。

describe("sanitizePaymentConfig（收款设置输入清洗）", () => {
  it("合法双码 + 文案 → ok + trim 后的数据", () => {
    const r = sanitizePaymentConfig({
      wechatQrUrl: "https://cdn.example.com/wechat.png",
      alipayQrUrl: "https://cdn.example.com/alipay.png",
      accountHint: "  收款账户：张三（微信）  ",
    })
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error("应返回成功")
    expect(r.data).toEqual({
      wechatQrUrl: "https://cdn.example.com/wechat.png",
      alipayQrUrl: "https://cdn.example.com/alipay.png",
      accountHint: "收款账户：张三（微信）",
    })
  })

  it("全部留空 → 三个字段都变 null（清空配置）", () => {
    const r = sanitizePaymentConfig({ wechatQrUrl: "", alipayQrUrl: "", accountHint: "" })
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error("应返回成功")
    expect(r.data).toEqual({ wechatQrUrl: null, alipayQrUrl: null, accountHint: null })
  })

  it("缺失字段按空处理 → null", () => {
    const r = sanitizePaymentConfig({})
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error("应返回成功")
    expect(r.data).toEqual({ wechatQrUrl: null, alipayQrUrl: null, accountHint: null })
  })

  it("非法 URL（非 http/https 开头）→ ok false", () => {
    const r = sanitizePaymentConfig({ wechatQrUrl: "javascript:alert(1)" })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error("应返回失败")
    expect(r.error).toContain("http")
  })

  it("非法 URL（含空格）→ ok false", () => {
    const r = sanitizePaymentConfig({ alipayQrUrl: "https://cdn.example.com/a b.png" })
    expect(r.ok).toBe(false)
  })

  it("明文 http 收款码 → ok false（HTTPS 页面降级，中间人可换图）", () => {
    const r = sanitizePaymentConfig({ wechatQrUrl: "http://cdn.example.com/wechat.png" })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error("应返回失败")
    expect(r.error).toContain("https")
  })

  it("IP 字面量 / 内网 / 回环 / 裸主机名 → ok false", () => {
    const bad = [
      "https://127.0.0.1/qr.png", // IPv4 回环
      "https://169.254.169.254/latest/meta-data", // 链路本地 / 云元数据
      "https://10.0.0.8/qr.png", // 私有网段
      "https://[::1]/qr.png", // IPv6 回环
      "https://localhost/qr.png", // 裸主机名
      "https://internal-server/qr.png", // 无点主机名
    ]
    for (const url of bad) {
      const r = sanitizePaymentConfig({ alipayQrUrl: url })
      expect(r.ok).toBe(false)
      if (r.ok) throw new Error(`应拒绝 ${url}`)
    }
  })

  it("文案超 100 字 → ok false", () => {
    const r = sanitizePaymentConfig({ accountHint: "啊".repeat(101) })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error("应返回失败")
    expect(r.error).toContain("100")
  })

  it("非字符串输入 → ok false", () => {
    const r = sanitizePaymentConfig({ wechatQrUrl: 12345 })
    expect(r.ok).toBe(false)
  })
})
