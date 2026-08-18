// 统一 API 请求封装：自动前缀 /interview/api，统一 402/401 升级引导
// 新代码优先用它；存量页面按需迁移。402（付费墙）→ 升级页；401 → 登录页带回调。

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

export function isUpgradeRequired(err: unknown): boolean {
  return err instanceof ApiError && err.status === 402
}

export function isUnauthenticated(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401
}

/** 跳转价格页（带来源回跳，from 供升级后返回原页面） */
export function redirectToPricing(from?: string) {
  const current = from || `${window.location.pathname}${window.location.search}`
  const params = new URLSearchParams()
  if (current) params.set("from", current)
  const qs = params.toString()
  window.location.assign(`/interview/pricing${qs ? `?${qs}` : ""}`)
}

/** 跳转登录页（带回调回跳） */
export function redirectToLogin(callbackUrl?: string) {
  const cb = callbackUrl || `${window.location.pathname}${window.location.search}`
  const params = new URLSearchParams()
  if (cb) params.set("callbackUrl", cb)
  const qs = params.toString()
  window.location.assign(`/interview/auth/login${qs ? `?${qs}` : ""}`)
}

const API_BASE = "/interview/api"

async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init)
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text || null
  }

  if (!res.ok) {
    throw new ApiError(res.status, (body as { error?: string } | null)?.error || `请求失败（${res.status}）`, body)
  }

  return body as T
}

export const api = {
  get<T = unknown>(path: string) {
    return apiFetch<T>(path)
  },
  post<T = unknown>(path: string, data?: unknown) {
    return apiFetch<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    })
  },
}
