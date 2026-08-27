// 收款设置（PaymentConfig 单例）的输入清洗与公开读取（纯函数，不碰 DB）。
// 后台保存前用 sanitizePaymentConfig 校验；价格页展示用 toPublicConfig 保证只暴露安全字段。

export interface PaymentConfigData {
  wechatQrUrl: string | null
  alipayQrUrl: string | null
  accountHint: string | null
}

export const PAYMENT_CONFIG_ID = 1
export const PAYMENT_CONFIG_ACCOUNT_HINT_MAX = 100

export type ConfigVerdict =
  | { ok: true; data: PaymentConfigData }
  | { ok: false; error: string }

// 收款码由价格页所有访客的浏览器 <img> 直接加载，地址只允许 https + 公网域名：
// - 拒绝明文 http（HTTPS 页面降级，中间人可换收款图）
// - 拒绝 IP 字面量 / localhost / 裸主机名（内网、回环、云元数据探测）
// - 拒绝含空白（URL 结构不合法）
const IPV4_HOST_RE = /^\d{1,3}(\.\d{1,3}){3}$/
const IPV6_HOST_RE = /^\[[0-9a-f:]+\]$/i

function isSafePublicHttpsUrl(value: string): boolean {
  if (/\s/.test(value)) return false
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return false
  }
  if (parsed.protocol !== "https:") return false
  if (parsed.username || parsed.password) return false
  const host = parsed.hostname
  if (!host) return false
  if (IPV4_HOST_RE.test(host) || IPV6_HOST_RE.test(host)) return false
  if (!host.includes(".")) return false
  return true
}

function cleanUrl(value: unknown): { url: string | null } | { error: string } {
  if (value === undefined || value === null || value === "") return { url: null }
  if (typeof value !== "string" || !isSafePublicHttpsUrl(value)) {
    return { error: "收款码图片地址需为 https:// 开头的公网图片链接（不支持 http / IP / 内网地址）" }
  }
  return { url: value }
}

export function sanitizePaymentConfig(input: {
  wechatQrUrl?: unknown
  alipayQrUrl?: unknown
  accountHint?: unknown
}): ConfigVerdict {
  const wechat = cleanUrl(input.wechatQrUrl)
  if ("error" in wechat) return { ok: false, error: wechat.error }
  const alipay = cleanUrl(input.alipayQrUrl)
  if ("error" in alipay) return { ok: false, error: alipay.error }

  let accountHint: string | null = null
  if (input.accountHint !== undefined && input.accountHint !== null && input.accountHint !== "") {
    if (typeof input.accountHint !== "string") return { ok: false, error: "收款提示文案格式不正确" }
    const trimmed = input.accountHint.trim()
    if (trimmed.length > PAYMENT_CONFIG_ACCOUNT_HINT_MAX) {
      return { ok: false, error: `收款提示文案不能超过 ${PAYMENT_CONFIG_ACCOUNT_HINT_MAX} 字` }
    }
    accountHint = trimmed || null
  }

  return { ok: true, data: { wechatQrUrl: wechat.url, alipayQrUrl: alipay.url, accountHint } }
}

// 公共配置（价格页只读）：未配置返回空对象，前端据此 fallback 到「联系管理员」。
export function toPublicConfig(data: PaymentConfigData | null): PaymentConfigData {
  return {
    wechatQrUrl: data?.wechatQrUrl ?? null,
    alipayQrUrl: data?.alipayQrUrl ?? null,
    accountHint: data?.accountHint ?? null,
  }
}
