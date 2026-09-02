# AI 面师 — 定价模型规格（Pro 订阅 + 语音点数包）

> 状态：规格（SDD 先行）· 2026-09-02 · 待用户确认后进入 TDD 实施
> 关联：`docs/commercialization-analysis.md` · `docs/commercialization-roadmap.md` · `docs/business-model.md` · `docs/paywall-plan.md` · `docs/ai-cost-metering-spec.md`

## 1. 背景与决策

- 成本计量（P0-1）已上线：文字 AI 按 token 计量 + 分层（免费廉价链 / Pro Claude 链 + 日上限），单次成本 ~¥0.1 量级 → **文字 AI 可安全全包进订阅**。
- **语音面试成本不可全包**：走阿里云「IMS → AI 实时互动」AIAgent，按实例运行时长计费，实测 ~¥1.5–2/场（约 15–20 分钟/场）。现行 Pro「每日 3 场」无月度总量 → 重度用户月成本可达 ¥90–180，远高于 ¥29 订阅价，**卖越多亏越多**。
- 竞品普遍把高成本可变项拆出订阅单独按量（智面星积分礼包 ¥148–598、萝卜面试 ¥10/次）——本次采用**订阅做留存 + 点数包做成本项**的成熟组合。

**决策记录（2026-09-02，用户确认）**
1. 架构 = **Pro 订阅（文字 AI 全包）+ 语音点数包（另购）**
2. Pro 语音额度 = **月度免费 N 场（超出走点数包）**，弃用「每日 3 场」
3. 本轮交付 = 本规格文档；确认后下一轮按 TDD 实施
4. 所有者白名单（`OWNER_EMAILS`，felix@test.com）行为不变：owner 全程豁免语音/场次/AI 配额，不受本改动影响

## 2. 定价模型总表

| 层 | 价格 | 权益 | 成本上限/毛利 |
|---|---|---|---|
| Free | ¥0 | 真实记录 5 场 + 文字 AI 基础额度（廉价链，日 token 上限）；语音仅在 7 天试用期内可体验 1 场 | 无语音敞口 |
| Pro | ¥29/月（¥79/季 · ¥249/年 规划中） | 文字 AI 全解锁（复盘/押题/教练/模拟/报告/深入分析，Claude 链 + 日上限）+ **语音 N 场/月** | N×~¥1.7 → **N=15**（成本上限 ~¥25.5 + 文字 ~¥2–4 ≈ ¥28–29.5，贴近 ¥29 ≈ 盈亏平衡线，首月账单校准，见 §8） |
| 语音点数包 | 10 场 ¥29 · 30 场 ¥69 · 100 场 ¥199 | 超额语音，每场扣 1 点；Pro 当月额度用完后再扣 | 售价/场 ¥2.90 / ¥2.30 / ¥1.99 → 毛利约 41% / 26% / 14%（按 ~¥1.7/场估） |

- `VOICE_MONTHLY_PRO_QUOTA`（N）为 `tier.ts` 常量，首月账单回填后校准（见 §8）。Free 不设免费语音场（避免开洞）；**试用 7 天 = Pro 权益，但语音独立设 1 场**（`VOICE_TRIAL_QUOTA`，防试用期刷语音成本，见 §3.1/§3.2）。
- 点数包**任意用户**（含 Free）可购 → Free/已降级用户也能靠点数继续语音，不依赖订阅。
- 单场不出售（避免碎片化），最小购买单元 = 10 场。
- 语音面试单场上限时长：实例运行 ≥30 分钟由后端强制结束（成本上界，见 §4.4）。

## 3. 配额与门禁新逻辑（改 `src/lib/tier.ts`）

### 3.1 常量与类型

```ts
// 替换 VIDEO_DAILY_LIMIT（旧：Pro 每日 3 场）
export const VOICE_MONTHLY_PRO_QUOTA = 15      // Pro 每月免费语音场次（首月账单校准，见 §8）
export const VOICE_TRIAL_QUOTA = 1             // 试用 7 天语音额度（独立于月度 N，防试用刷成本）

export type VideoQuotaResult =
  | { ok: true; channel: "owner" | "pro_monthly" | "credit"; remaining?: number }
  | { ok: false; error: string; code: string }

export const VOICE_NEEDS_CREDITS = "VOICE_NEEDS_CREDITS"
```

`TierInfo` 增 `voiceCredits: number`（`getTier` 的 user select 增 `voiceCredits`，与 email 同一次查）。

### 3.2 `assertVideoQuota(userId, db)` 新判定序

1. `ANON_USER_IDS.has(userId)` → `{ ok: true }`（匿名豁免，与现状一致）
2. `info.isOwner` → `{ ok: true, channel: "owner" }`（白名单）
3. `info.tier === "pro"`：
   - 额度按来源分：`quota = info.trialActive ? VOICE_TRIAL_QUOTA : VOICE_MONTHLY_PRO_QUOTA`（试用期 1 场、付费 Pro 15 场）
   - 当月视频场数 = `interview.count({ where:{ userId, type:"video", createdAt:{ gte: 本地当月 1 日 0 点 } } })`（试用期窗口沿用自然月——试用 7 天内最多 1 场，用完全局走点数，不续补）
   - `< quota` → `{ ok:true, channel:"pro_monthly", remaining: quota - count }`
4. 非 Pro **或** Pro 月额度已尽：
   - `info.voiceCredits > 0` → `{ ok:true, channel:"credit", remaining: voiceCredits }`
5. 否则 → `{ ok:false, code:"VOICE_NEEDS_CREDITS", error: 按来源生成 —— trialActive ? "试用期含 1 场语音，已用完，可购买语音点数包体验更多" : info.tier==="pro" ? `Pro 每月 ${quota} 场已用完，请购买语音点数包加场` : "语音面试需 Pro 会员或语音点数包，去升级/购买" }`

> 变更点：**去掉旧「free 走 assertInterviewQuota（5 场总量）分支」**——语音不再占用免费真实记录额度，Free 用户靠点数包即可语音。
> 旧 `VIDEO_DAILY_LIMIT` 常量删除，`tier.test.ts` 相关用例（按“日窗口”断言）改为按“当月窗口 + 三种 channel”。

### 3.3 点数扣减（credit channel，事务防并发）

- **消费点**：`/api/video-interview/start` 在调用阿里云**之前**原子预扣：
  `user.updateMany({ where:{ id:userId, voiceCredits:{ gte:1 } }, data:{ voiceCredits:{ decrement:1 } } })`
  - 返回 `count===0` → 并发被抢光 → 按 §3.2 第 5 条拒绝。
  - `provider.start` 抛错（降级文字）→ **退回 1 点**（`voiceCredits:{ increment:1 }` + 记账）再返回 text 模式，不让用户为失败买单。
- **自动退费（no-show）**：`/api/video-interview/end` 取回转写为空 / 会话极短（如 <60s 且无任何 user 发言）→ 判定空跑，退回 1 点（best-effort，日志记录）。
- 每笔扣/退写 `VoiceCreditLog`（§4.2）审计。

## 4. 数据模型变更（`prisma/schema.prisma`）

### 4.1 `User` 增字段

```prisma
voiceCredits Int @default(0) // 语音点数余额（场），购买/赠送 +，消费/退款 -
```

### 4.2 新增 `VoiceCreditLog`（审计）

```prisma
model VoiceCreditLog {
  id        String   @id @default(cuid())
  userId    String
  delta     Int      // 正=入账，负=扣点
  reason    String   // purchase | grant | consume | refund | adjust
  orderId   String?  // 点数包订单（purchase）关联
  refId     String?  // 消费关联的 interview/instanceId（可选）
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, createdAt])
}
```

（`schema.prisma` 的 `User` 关系补 `voiceCreditLogs VoiceCreditLog[]`。）

### 4.3 定价目录统一 `kind`（改 `src/lib/payment/types.ts`）

现 `PLANS` 全按订阅语义（`durationDays`）。改为单一目录 + `kind` 分流：

```ts
export type PlanId = "month" | "quarter" | "year" | "voice10" | "voice30" | "voice100"

interface PlanInfo {
  id: PlanId
  label: string
  priceYuan: number
  amount: number          // 分
  status: "available" | "soon"
  kind: "subscription" | "voice"
  durationDays?: number   // kind=subscription
  credits?: number        // kind=voice（场数）
}

export const PLANS: Record<PlanId, PlanInfo> = {
  month:  { id:"month",  label:"Pro 月卡",    priceYuan:29, amount:2900, durationDays:30,  status:"available", kind:"subscription" },
  quarter:{ id:"quarter",label:"Pro 季卡",    priceYuan:79, amount:7900, durationDays:90,  status:"soon",      kind:"subscription" },
  year:   { id:"year",   label:"Pro 年卡",    priceYuan:249,amount:24900,durationDays:365, status:"soon",      kind:"subscription" },
  voice10: { id:"voice10", label:"语音 10 场",  priceYuan:29, amount:2900, status:"available", kind:"voice", credits:10 },
  voice30: { id:"voice30", label:"语音 30 场",  priceYuan:69, amount:6900, status:"available", kind:"voice", credits:30 },
  voice100:{ id:"voice100",label:"语音 100 场", priceYuan:199,amount:19900,status:"available", kind:"voice", credits:100 },
}
```

> `order.plan` 直接存 id（现状）；后端不再从 `plan` 字段推断是订阅还是点数，改从 `PLANS[plan].kind` 判断。

### 4.4 语音单场上限（防单场超长烧钱）

- 现有护栏：`userOnlineTimeout:60s`（无人入会自停）、`maxIdleTime:300s`（静默自停）。
- **新增硬上界**：单场 AIAgent 运行 ≥30 分钟由 `/api/video-interview/status` 或结束路径判定并强制 `stopAIAgentInstance`，超时仍计 1 点。目的：单点成本上界 ~¥3（30min×~¥0.1），与点数价格（¥1.99–2.90）接近可控。
- 实施确认点：ICE 是否支持 agent 侧 `maxDuration`/定时停止，否则用服务端定时器。

## 5. API 与激活改动

### 5.1 激活分流（改 `src/lib/payment/activate.ts`）

`activateSubscription(orderId)` 在「订单已 paid → 直接成功」之后分支：

```ts
const plan = PLANS[order.plan as PlanId]
if (plan.kind === "voice") {
  // 事务：order→paid；user.voiceCredits += plan.credits；VoiceCreditLog(reason=purchase, orderId, delta=+credits)
} else { // subscription：现状 computeExpiry + proExpiresAt 续期叠加 }
```

幂等不变（paid 不重复入账）。**金额仍以 PLANS 白名单为准，不信客户端**。

### 5.2 路由改动清单

| 路由/文件 | 改动 |
|---|---|
| `src/app/api/video-interview/start/route.ts` | 用新 `assertVideoQuota`；credit channel 先预扣再建实例，失败退回；429→`VOICE_NEEDS_CREDITS`（提示购买） |
| `src/app/api/video-interview/end/route.ts` | no-show 退点逻辑 + CreditLog |
| `src/app/api/payment/order/route.ts` | 无需大改（白名单换新 PLANS 即支持 voice10/30/100）；响应带 `plan.kind` 供前端区分 UI |
| `src/app/api/payment/mock/approve/route.ts` | 无需改（复用 activateSubscription） |
| `src/app/api/subscription/route.ts` | 响应扩展 `voiceCredits`、`voiceUsedThisMonth`、`voiceMonthlyQuota` |
| `src/app/api/me/route.ts`（若有） | 同上，供 useAuth/settings 展示 |

### 5.3 支付通道现状（不变）

- 未配置官方支付：仍走「收款码 + 管理员开通」冷启动（`PaymentConfig` 单例 + `mock/approve`）。点数包订单同样展示 `paymentConfig` 收款码，管理员在订单后台放行即入账点数。
- 资质（营业执照 + 商户号）就绪后再接真实 Provider，`kind` 分流与支付渠道无关，业务层零改动。

## 6. 前端改动清单

| 文件 | 改动 |
|---|---|
| `src/app/pricing/page.tsx` | 双区：Pro 订阅（月/季/年，未上线标“即将上线”）+ **语音点数包卡**（10/30/100 场，标注“每场约一场完整 AI 语音面试”，展示单价折合）；购买走现有下单流程，成功后提示已入账点数 |
| `src/app/settings/page.tsx` 会员卡 | 加「语音点数」余额、本月已用/额度（Pro）、「购买点数」入口 |
| 语音面试入口（模拟面试/题库起点） | 收到 `VOICE_NEEDS_CREDITS` → 弹层「本月免费 X 场已用完 · 购买点数包 / 升级 Pro」，替代现 429 干提示 |
| `src/components/layout/Sidebar.tsx` 可选 | 价格入口文案含“点数包” |

## 7. 涉及文件 + 测试 + 门禁

**Schema/数据**：`prisma/schema.prisma`（User.voiceCredits + VoiceCreditLog + 关系）
**后端**：`src/lib/tier.ts`、`src/lib/payment/types.ts`、`src/lib/payment/activate.ts`、`src/app/api/video-interview/start/route.ts`、`end/route.ts`、`src/app/api/subscription/route.ts`、（可选 `me`）
**前端**：pricing / settings / 语音入口
**测试**（TDD 先行，RED→GREEN）：
- `tests/unit/tier.test.ts`：重写视频配额组 —— owner / anon / pro 当月<N → pro_monthly / pro 当月=N → 走 credit / 无点数 → `VOICE_NEEDS_CREDITS`；断言查询为“当月窗口 type=video”，非“当日”
- `tests/unit/payment-activate.test.ts`（新增）：voice plan 入账 + 幂等不重复入账；subscription 分支不回归
- `tests/unit/voice-credit.test.ts`（新增，若建 lib 层扣点函数）：预扣/并发抢光/退款
- `tests/api-test.sh`：语音配额接口分支 + 点数包下单→approve→点数入账闭环（本地非生产可自助 mock approve）
- 门禁：`npx vitest run` → `npx tsc --noEmit` → `npx next build` → 重启 `next start` → `bash tests/api-test.sh` 全绿 → commit+push（GitHub Actions 自动部署）

## 8. 定价参数校准机制

- 上线后首月拉阿里云用量明细（IMS → AI 实时互动）+ 本地 `aiUsage`：
  - 平均单场语音时长 → 校正「成本/场」与点数包毛利假设；
  - Pro 用户人均语音场数 → 校正 `VOICE_MONTHLY_PRO_QUOTA`（若人均 < 3，说明送太狠，可降到 5–6；若贴顶说明 N 太小）；
  - 若单场均长 >25 分钟 → 评估改「按分钟扣点」或加场上限收紧。
- `docs/commercialization-roadmap.md` 决策记录追加本轮（2026-09-02）。

## 9. 上线分阶段

1. **本轮**：schema 变更 + 门禁改月度 + 点数包目录/激活/页面（纯代码 + 收款码冷启动），`prisma db push` + `generate` 随 cicd 自动执行。
2. **校准**：首月账单回填 §8 参数。
3. **资质后**：接微信/支付宝真实 Provider，自动回调 → 点数/会员即时到账。
4. **远期（P2 增长）**：年付折扣、注册赠送语音体验点（`grant` reason，拉新钩子）、B2B 批量账号与点数池。

## 10. 风险与未决

| 项 | 说明 |
|---|---|
| 成本估算误差 | “¥1.5–2/场”基于 ~15–20min/场假设；首月账单校准（§8）。若偏差大，点数包每场售价/Pro N 需上调 |
| 单场超长 | 30 分钟硬上界 + 现有 60s/5min 空跑护栏；需确认 ICE 侧支持定时自停，否则服务端兜底 |
| Pro 语音收窄 | 3 场/日 → 15 场/月是行为收窄，需 pricing/升级文案写清“月度额度”，避免客诉 |
| 试用语音 | 试用期 1 场/7 天（`VOICE_TRIAL_QUOTA`），额度用尽走点数包；注册拉新若要加语音钩子，走 `grant` 点数而非扩试用额度 |
| 扣点时机竞态 | 采用“创建前预扣 + 失败/no-show 退点”，并发以 `updateMany({gte:1})` 兜底 |
| 旧用例回归 | `VIDEO_DAILY_LIMIT` 相关测试整体重写，勿留按“日”旧断言 |
| 未决：N 与点数包价格最终值 | 规格给默认 **N=15**（用户试跑值）、¥29/10·¥69/30·¥199/100，待首月校准；N 成本贴近 ¥29 临界（§2），首月若 Pro 人均语音高，需下调 N 或上调订阅价；实施前如需改仅动常量与 PLANS |
