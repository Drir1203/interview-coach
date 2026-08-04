# i面试 付费墙 + 支付（骨架 + 模拟支付，适配器架构）方案

> 状态：待审核（不实现）
> 关联：PRD 商业化 Roadmap「付费墙 + 支付」「改密码」「B2B」
> 前提：生产服务器正在筹备备案域名，本方案按「先建支付无关的骨架，资质就绪后插真实渠道」设计

---

## 1. 背景与目标

产品功能已完整（Web 21 项 + 小程序 14 页），缺变现通道。本方案落地 PRD 的 Free/Pro 模型：

- **Free**：5 场面试记录 + 基础功能
- **Pro**：无限记录 + AI 深度复盘（含按段重生成）+ 后续逐步解锁模拟面试/导出/深入分析
- **试用**：注册即送 7 天 Pro 试用，到期自动降级 Free

### 关键约束（决定架构）

当前服务器为裸 IP（47.116.138.61）+ 自签证书，无备案域名、无营业执照。
微信支付（JSAPI/H5）与支付宝（电脑网站/手机网站）均**强制要求**：备案域名 + 可信证书 + 企业/个体户资质。
→ 真实支付当前不可用，且不可绕过（不是代码问题，是前置条件）。

**因此采用「支付渠道适配器」架构**：业务层（会员/订单/限额/试用）与渠道无关；v1 提供 MockProvider，域名+资质就绪后各写一个真实 Provider 文件即切换，业务层零改动。这与项目已有的 AI 多模型链（DeepSeek→Qwen→Claude→Mock）同一套模式。

### 决策参数（已定，可改）

| 项 | 值 | 理由 |
|---|---|---|
| v1 付费墙范围 | 精简：面试 5 场限额 + AI 深度复盘锁 Pro | 改动小、见效快，其余功能等真实支付上线再逐步锁 |
| 定价 | 月卡 ¥29（Roadmap：季卡¥79/年卡¥249） | PRD 下限，利于初期转化 |
| 试用 | 注册自动发 7 天 | 零门槛，无感体验 Pro |
| 支付渠道 v1 | MockProvider（手动开通 + 模拟支付） | 唯一当前可落地；测试密钥保护 |
| 支付渠道 v2 | 微信支付 JSAPI（小程序）+ 支付宝（Web） | 域名/资质就绪后，各补一个 Provider |

---

## 2. 数据模型（Prisma schema 变更）

### 2.1 User 表新增字段（`prisma/schema.prisma`）

```prisma
model User {
  // ...现有字段
  proExpiresAt   DateTime?  // 会员/试用到期时间（唯一判定源，pro 判定 = now < proExpiresAt）
  trialClaimedAt DateTime?  // 试用领取时间（防重复领取，每账号仅一次）
}
```

设计要点：
- **会员判定唯一真源是 `proExpiresAt`**，不引入 isPro 冗余布尔字段（避免双源不一致）。
- 试用与付费共用同一字段，`source` 区分来源（见订单表）。

### 2.2 新建订单表 `SubscriptionOrder`

```prisma
model SubscriptionOrder {
  id               String   @id @default(cuid())
  userId           String
  plan             String   // month | quarter | year
  amount           Int      // 金额，单位分（¥29 → 2900）
  status           String   // pending | paid | refunded
  source           String   // trial | mock | wechat | alipay
  providerOrderId  String?  // 第三方渠道单号（渠道回填）
  paidAt           DateTime?
  expiresAt        DateTime? // 本单生效后的会员到期时间
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, status])
}
```

- `source` 支持多渠道并存（试用/mock/微信/支付宝共用一张表）。
- 试用也记一条 `source="trial"` 的订单（金额 0），便于审计。
- `expiresAt` 用于续费叠加计算与对账。

### 2.3 环境变量（`.env.example` 补充）

```
# Mock 支付（v1）
MOCK_PAY_SECRET=       # 模拟支付回调的测试密钥
PAYMENT_ADMIN_KEY=     # 手动开通会员的管理密钥（仅 Mock 阶段）
# v2 真实渠道（域名/资质就绪后启用）
WECHAT_MCH_ID=
WECHAT_API_V3_KEY=
WECHAT_PRIVATE_KEY_PATH=
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=
```

> 部署注意：schema 变更必须 `npx prisma db push` + `npx prisma generate`（CLAUDE.md 规则）。

---

## 3. 会员判定与试用（`src/lib/tier.ts`，新建）

```ts
// 统一入口，供所有 API 复用
getTier(userId): Promise<{ tier: "free"|"pro", proExpiresAt?: Date, source?: string }>
  // pro 判定 = proExpiresAt > now；source 从最近一条 paid/trial 订单取

requirePro(): Promise<{ ok: true } | { ok: false, error: string }>
  // 非 pro → { ok:false, error:"该功能仅 Pro 会员可用，请升级" }

claimTrial(userId): Promise<{ ok, error? }>
  // 无 trialClaimedAt → 写入 proExpiresAt = now+7d，source=trial，记一条金额 0 订单
  // 已有 → 拒绝（每账号仅一次）

ensureTrialOnRegister(userId)  // 注册成功后调用 claimTrial
```

**正确性关键**：`requirePro()` **每次实时查 DB**，不依赖 JWT 缓存。
原因：会员状态会变（购买/过期），JWT 是静态的，缓存会导致刚购买不生效、过期仍在用。
本地单表查询开销可忽略，换取正确性。`src/auth.ts` 的 JWT/session 不做会员字段缓存，只保留现有 userId。

---

## 4. 支付适配器层（核心，`src/lib/payment/`）

### 4.1 接口定义 `types.ts`

```ts
interface PaymentProvider {
  name: "mock" | "wechat" | "alipay"
  // 创建支付：返回支付参数（mock 返回模拟信息）
  createPayment(order: SubscriptionOrder): Promise<{ payUrl?: string; mockAction?: "auto" | "manual" }>
  // 回调验签 + 解析：只负责"验签+解出订单号"，不碰业务
  verifyCallback(rawBody: string, headers: Record<string, string>): Promise<{ orderId: string; success: boolean }>
}
```

### 4.2 MockProvider（v1，`mock.ts`）

- `createPayment` → 返回 `mockAction`：
  - `auto`（测试模式）：前端显示「模拟支付成功」按钮，点击走回调
  - `manual`（生产 Mock）：只能通过管理密钥手动开通
- `verifyCallback` → 校验请求头 `X-Mock-Secret` 等于 `MOCK_PAY_SECRET`，否则拒签
- **手动开通接口**：`POST /api/payment/mock/approve`，校验 `PAYMENT_ADMIN_KEY`，把订单置 paid + 激活会员（用于给用户手动开会员、退款处理）

### 4.3 真实 Provider（v2，只设计不实现）

| Provider | 渠道 | 适用端 | 要点 |
|---|---|---|---|
| `wechat.ts` | 微信支付 JSAPI | 小程序 | Native/JSAPI 下单；验签用微信 V3（APIv3 密钥 + 平台证书） |
| `wechat-h5.ts` | 微信 H5 支付 | Web | 需商户开通 H5 产品 + 备案域名 |
| `alipay.ts` | 支付宝电脑网站/手机网站 | Web | RSA2 验签；回调 `sign` 校验 |

切换渠道 = 新增一个 Provider 文件 + 改一行渠道路由，业务层不动。

---

## 5. API 路由设计

### 5.1 支付/会员 API（新建）

| 路由 | 方法 | 说明 | 鉴权 |
|---|---|---|---|
| `/api/payment/order` | POST | 创建订单（body: `{plan}`），调用 provider.createPayment，落 pending 订单 | 登录 |
| `/api/payment/callback` | POST | 支付回调（webhook）：验签 → 幂等（pending→paid）→ 激活会员（`proExpiresAt = max(now, 原到期) + 时长`，续费叠加）→ 返回渠道约定格式 | 渠道签名 |
| `/api/payment/order/[id]` | GET | 前端轮询订单状态 | 登录 + 本人 |
| `/api/payment/mock/approve` | POST | Mock 手动开通（仅 MockProvider 生效） | `PAYMENT_ADMIN_KEY` |
| `/api/subscription` | GET | 查会员状态（tier/proExpiresAt/source/剩余天数） | 登录 |
| `/api/subscription/trial` | POST | 领取试用（若改成"点击领取"模式时启用） | 登录 |

**回调安全（必须）**：
1. 验签失败一律拒绝（mock 验 `X-Mock-Secret`；真实渠道验渠道签名）
2. **幂等**：订单已是 paid 直接返回成功，不重复激活
3. **金额校验**：回调/查询里的金额不得直接信，须与 DB 订单 `amount` 比对，不符拒绝
4. 只允许用户操作自己的订单（`userId` 校验）

### 5.2 付费墙拦截（v1 精简范围，改动 API）

| 文件 | 拦截点 | 逻辑 |
|---|---|---|
| `src/app/api/interviews/route.ts` | POST 拿到 userId 后 | `count(userId) >= 5 && !pro` → 402「免费用户最多 5 场，升级 Pro 解锁无限」 |
| `src/app/api/review/route.ts` | 全量分支开头 + `mode:"question"` 分支开头 | `requirePro()`，未通过 → 402 |

> v1 不锁（后续按序加锁）：`/api/mock`、`/api/prep`、`/api/report`、`/api/export`、`/api/analysis/deep`。
> 加锁方式 = 各路由顶部加一行 `requirePro()`，模式统一。

### 5.3 注册触发试用

`src/app/api/auth/register/route.ts` 成功后 → `ensureTrialOnRegister(userId)`（写 7 天试用）。

---

## 6. 前端改动

| 文件 | 改动 |
|---|---|
| `src/hooks/useAuth.ts` | `AuthUser` 扩展 `tier`、`proExpiresAt`、`trialActive`、`trialDaysLeft`（`/api/me` 或 `/api/subscription` 提供） |
| `src/app/pricing/page.tsx`（新建） | 价格页：3 档方案展示 + 试用状态 + 购买按钮 + Mock 支付交互（测试模式「模拟支付」/ 引导手动开通） |
| `src/app/settings/page.tsx` | 新增「会员」卡片：当前档位/到期时间/试用剩余天数/升级入口 |
| `src/app/interviews/new/page.tsx` | 到达限额 → 提示升级 + 跳价格页 |
| `src/app/interviews/[id]/page.tsx` | 「开始 AI 复盘」「重新生成」按钮 Pro 锁定态 + 升级引导 |
| `src/components/layout/Sidebar.tsx` | 「价格/会员」导航入口 + Pro 角标 |
| 全局 402 处理 | `src/lib/api.ts`（新建）封装 fetch：`res.status === 402` → 弹出升级引导 | 

> 现有页面直接 `fetch("/interview/api/...")` 无统一封装、无 402 处理（探索结论），故新建 `api.ts`，新代码用它，存量页面按需迁移。

---

## 7. 试用期设计（汇总）

- **发放**：注册成功自动发（`ensureTrialOnRegister`），`trialClaimedAt` 记录，每账号仅一次
- **生效**：`proExpiresAt = now + 7d`，试用期 = 完整 Pro（解锁全部付费墙 + 不限面试数）
- **到期**：`proExpiresAt < now` → 自动降级 Free，5 场限额生效；已建的超出记录保留，仅禁止新建
- **展示**：pricing/settings 显示「试用中 · 剩余 N 天」
- **与付费关系**：试用期间购买 → 续费叠加（`max(now, 原到期) + 时长`）；试用不阻断购买

---

## 8. 定价（首版月卡，Roadmap 扩展）

| 档位 | 价格 | 说明 |
|---|---|---|
| 月卡 | ¥29 | v1 仅此档 |
| 季卡 | ¥79（≈88 折） | Roadmap |
| 年卡 | ¥249（≈7 折） | Roadmap |

价格页 3 档展示，未上线档位标「即将上线」。

---

## 9. 部署与真实渠道切换（分阶段）

**阶段 A（现在，v1）**
1. schema 变更 → `prisma db push` + `prisma generate`
2. env 增加 `MOCK_PAY_SECRET`、`PAYMENT_ADMIN_KEY`
3. 部署规则照旧：备份服务器 `.env`+`ecosystem.config.cjs` → 全量同步 `src/` + `prisma/schema.prisma` + `package.json` → `npm install --ignore-scripts` → 重启 PM2
4. 上线 Mock 手动开通（`PAYMENT_ADMIN_KEY`），可真实控制用户会员状态验证付费墙

**阶段 B（域名备案 + 可信证书 + 商户号就绪）**
1. 服务器配备案域名 + 可信证书（Let's Encrypt/云证书），Nginx 放行支付回调路径
2. 新增 `wechat.ts` / `alipay.ts` Provider，env 配商户密钥
3. 渠道路由指向真实 Provider，业务层零改动
4. 小程序端接微信 JSAPI；Web 端接支付宝/微信 H5

**阶段 C（商业化完善）**
- 季卡/年卡、退款接口（管理员）、发票、B2B 批量账号

---

## 10. 风险与注意事项

| 风险 | 说明 | 应对 |
|---|---|---|
| 证书/域名门槛 | 自签证书接不了真实支付回调 | 阶段 B 必须换可信证书；v1 不受影响 |
| 回调幂等/金额篡改 | 重复回调、金额不一致 | 幂等处理 + DB 金额比对 |
| 会员状态缓存不一致 | JWT 缓存导致刚买不生效/过期仍用 | `requirePro()` 实时查 DB |
| 试用滥用 | 一人多号重复试用 | `trialClaimedAt` 每账号一次（v1 够用，后续可加手机号/IP 风控） |
| 退款/售后 | v1 无自助退款 | 管理员 `mock/approve` 反向操作手动退款 |
| 合规 | 真实支付需营业执照；聚合支付二清不推荐 | 只走微信/支付宝官方渠道 |
| 测试回归 | 改动涉及注册/面试/复盘核心链路 | 质量门禁 18/18 + 手动流程回归 |

---

## 11. 验证方案

**自动化**：质量门禁 `bash tests/api-test.sh` 18/18 不回归。

**手动全流程（本地 + 生产）**：
1. 注册新号 → `/api/subscription` 返回 trialActive=true，剩余 7 天
2. 建 6 场面试 → 第 6 场被 402 拦截
3. `/api/payment/order` 建月卡订单 → Mock 模拟支付成功 → 回调激活 → `proExpiresAt` 生效
4. 再建面试不受限；AI 复盘/按段重生成解锁
5. 试用过期（改库时间）→ 降级 Free → 再次被限额
6. 生产探测：部署后 `curl` 验证 402 与会员状态接口

---

## 12. 涉及文件清单

**新建**：`src/lib/tier.ts`、`src/lib/payment/types.ts`、`src/lib/payment/mock.ts`、`src/lib/api.ts`、`src/app/pricing/page.tsx`、`src/app/api/payment/order/route.ts`、`src/app/api/payment/callback/route.ts`、`src/app/api/payment/mock/approve/route.ts`、`src/app/api/payment/order/[id]/route.ts`、`src/app/api/subscription/route.ts`

**修改**：`prisma/schema.prisma`（User 字段 + SubscriptionOrder）、`src/app/api/auth/register/route.ts`（触发试用）、`src/app/api/interviews/route.ts`（限额）、`src/app/api/review/route.ts`（Pro 拦截）、`src/hooks/useAuth.ts`、`src/app/settings/page.tsx`、`src/app/interviews/new/page.tsx`、`src/app/interviews/[id]/page.tsx`、`src/components/layout/Sidebar.tsx`、`.env.example`

**不改**：`src/middleware.ts`（空壳，不承担付费墙——付费墙在 API 层做，避免全局误拦）、`src/lib/ai-review.ts` 等 AI 链路（拦截在 route 层）
