// 管理端纯逻辑（可单测，不触 DB）：订单筛选、用户搜索、手动开通 Pro 数据构造、分页参数解析。
// 路由侧只做鉴权 + Prisma 调用；规则判定全部收敛在本文件，保证行为可测。

import { PLANS, type PlanInfo } from "./types"

// ── 常量：订单筛选白名单 ──
export const ADMIN_ORDER_STATUSES = ["pending", "paid"] as const
export const ADMIN_ORDER_SOURCES = ["trial", "mock", "admin"] as const // admin = 管理员手动开通

export const ADMIN_PAGE_SIZE = 20
export const ADMIN_PAGE_SIZE_MAX = 50

// ── 订单筛选 ──
export interface OrderFilterInput {
  status?: string
  source?: string
}

export type OrderFilterWhere = {
  status?: { in: string[] }
  source?: string
}

// 白名单校验：未知状态/来源 → 明确报错（路由回 400），绝不静默放行或注入 where。
export function buildOrderFilter(
  input: OrderFilterInput
): { ok: true; where: OrderFilterWhere } | { ok: false; error: string } {
  const where: OrderFilterWhere = {}
  const { status, source } = input

  if (status) {
    if (!(ADMIN_ORDER_STATUSES as readonly string[]).includes(status)) {
      return { ok: false, error: `未知订单状态：${status}` }
    }
    where.status = { in: [status] }
  }
  if (source) {
    if (!(ADMIN_ORDER_SOURCES as readonly string[]).includes(source)) {
      return { ok: false, error: `未知订单来源：${source}` }
    }
    where.source = source
  }
  return { ok: true, where }
}

// ── 用户搜索（邮箱/昵称模糊匹配，不区分大小写） ──
export interface UserFilterInput {
  q?: string
}

export type UserSearchWhere = {
  OR?: Array<{
    email?: { contains: string; mode: "insensitive" }
    name?: { contains: string; mode: "insensitive" }
  }>
}

export function buildUserFilter(input: UserFilterInput): UserSearchWhere {
  const q = input.q?.trim()
  if (!q) return {}
  return {
    OR: [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ],
  }
}

// ── 手动开通 Pro：套餐解析 + 订单数据构造 ──
export function resolvePlan(
  planId: string
): { ok: true; plan: PlanInfo } | { ok: false; error: string } {
  const plan = PLANS[planId as keyof typeof PLANS]
  if (!plan) return { ok: false, error: `未知套餐：${planId}` }
  return { ok: true, plan }
}

export interface AdminGrantData {
  plan: string
  amount: number
  status: "paid"
  source: "admin"
  paidAt: Date
  expiresAt: Date
}

// 管理员手动开通 → 落一条已支付订单（source=admin）留痕，与 Mock 回调账单同构。
export function buildAdminGrant(
  plan: PlanInfo,
  expiresAt: Date,
  now: Date
): { ok: true; data: AdminGrantData } | { ok: false; error: string } {
  return {
    ok: true,
    data: {
      plan: plan.id,
      amount: plan.amount,
      status: "paid",
      source: "admin",
      paidAt: now,
      expiresAt,
    },
  }
}

// ── 分页参数解析：非法/缺省回退默认，超大截断 ──
export function parsePage(input: string | null): number {
  const n = Number(input)
  if (!Number.isInteger(n) || n < 1) return 1
  return n
}

export function parsePageSize(input: string | null): number {
  const n = Number(input)
  if (!Number.isInteger(n) || n < 1) return ADMIN_PAGE_SIZE
  return Math.min(n, ADMIN_PAGE_SIZE_MAX)
}
