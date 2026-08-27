# P0-1 AI 成本计量 + 限流 — 行为规格（SDD）

> 状态：**已实施** · 2026-08-28（门禁：vitest 104/104 + api-test 45/45）
> 背景：见 `docs/commercialization-roadmap.md` P0-1。免费层可无限调 AI → 成本随用户线性增长，规模即亏损。
> 咽喉点：所有 AI 文本调用汇聚 `src/lib/ai-coach.ts` 的 `chatWithFallback`（coach/report/prep/experience/application 5 入口），在此统一计量可一次覆盖。

## 一、能力点（Capability Points）

- **CP1 统一计量**：经 `chatWithFallback` 的每次 AI 调用，在返回前记录真实 token 用量（input+output）与 feature/model 标签。provider 返回值从 `string` 改为 `{ content, inputTokens, outputTokens }`（OpenAI 兼容读 `usage.prompt/completion_tokens`，Anthropic 读 `usage.input/output_tokens`）。
- **CP2 每日 token 限额**：按用户当日累计总 token 设上限；超限返回 429 + 中文提示。免费/Pro 不同档位。
- **CP3 单次请求限额**：单次 input+output token 超上限直接拒绝，防单次长上下文爆成本。
- **CP4 分钟限流**：每用户每分钟 AI 调用次数上限，超限 429。内存固定窗口 Map（同 `admin/login` 既有模式，单实例 PM2 fork 有效）。
- **CP5 匿名豁免**：匿名桶（`__anon__`/`default`）豁免计量，保持 api-test 门禁链路不变。**标注风险**：匿名滥用无法计量。
- **CP6 成本看板**（可选，见 D3）：admin 看板新增「今日 AI 成本」卡片，按 model/feature 聚合 token，换算估算金额。

## 二、需求场景（Requirement Scenarios）

- **S1** 免费用户当日 token 用尽后调教练 → 429「今日 AI 额度已用完，请升级 Pro 或明日再来」
- **S2** 免费用户单次请求超长（粘贴超长简历/历史）→ 429 单次超限提示
- **S3** 免费用户 1 分钟内连点多次 → 429 限流提示
- **S4** Pro 用户日常使用不受影响（高上限 + 高频次）
- **S5** 匿名/未登录链路（门禁 api-test 全流程）行为不变
- **S6**（若含 CP6）admin 看板可见今日 AI token 与估算成本

## 三、设计要点

- **新表** `AiUsage`：`userId String`、`feature String`、`model String`、`inputTokens Int`、`outputTokens Int`、`createdAt DateTime`；`@@index([userId, createdAt])`。当日用量 = 聚合 `sum(inputTokens+outputTokens) where userId + createdAt >= 今日零点`。
- **限额判定顺序**：先查当日累计（超 → 429）→ 再算本次预估（input 由消息序列估算，超 → 429）→ 调用 → 写入真实用量。
- **常量可调**（集中 `src/lib/payment/ai-quota.ts`）：
  - `FREE_DAILY_TOKEN_LIMIT` / `PRO_DAILY_TOKEN_LIMIT`（推荐值见 D1）
  - `SINGLE_REQUEST_TOKEN_LIMIT`
  - `AI_RATE_LIMIT_PER_MINUTE`
- **写入位置**：`chatWithFallback` 内包一层（quota guard），各调用方零改动。

## 四、TDD 计划

1. 单测：`ai-quota.test.ts` —— 每日限额判定、跨日重置、单次限额、限流窗口、usage 归一化（OpenAI vs Anthropic 字段）。
2. api-test 扩：新用户触发每日超限 → 429 场景（用测试专用低阈值 env 或直接查表造数据）。
3. 门禁：vitest + api-test 全绿后再继续。

## 五、决策记录

- **D1 限额档位**（2026-08-27 确认）：免费 每日 30k token / 单次 8k；Pro 每日 300k / 单次 64k；分钟限流 10 次/分钟。常量化集中 `ai-quota.ts`。
- **D2 匿名豁免**：默认豁免配额与计量（保持门禁链路），但**限流 + 免费链仍生效**（安全评审 C1 补丁：匿名永不触 Claude，堵退出登录白嫖最贵模型）。
- **D3 成本看板**：**本期做**。admin stats 加「今日 AI token + 估算成本」聚合，看板加卡片。
- **D4 模型分层**：**本期做**。Pro 链 = Claude → DeepSeek → Qwen → mock；免费链 = DeepSeek → Qwen → mock（免费不触 Claude，成本天然分层）。

## 六、已知遗留面（review 记录 2026-08-27）

- **`src/lib/ai-review.ts`（AI 复盘 `/api/review`）与 `src/app/api/mock/route.ts`（模拟面试）是独立 provider 链，未经 `chatWithFallback`**：本期未计量/未限流/未分层。其中 `/api/mock` 无 requirePro 拦截、接受匿名桶 `__anon__`，免费/未登录用户可直触 Anthropic 生成模拟面试 → 成本泄漏路径。已在 roadmap 排入下一迭代（给 `/api/mock` 挂计量或 Pro 门，ai-review 走统一入口）。
- **注册无防护 + 自动 7 天 Pro 试用**（安全评审 H2）：批量注册可换账号打穿按账号配额/限流，且新账号直接领 Pro 链（含 Claude）。修复需注册 IP 限流 + 邮箱验证后才发试用，属产品侧改动，排下一迭代。
- 每日限额为 check-then-write 软上限（非严格），并发在途请求可能小幅超发（M3，有 10/min 兜底，可接受）。
- 固定窗口限流在窗口边界允许 ~2 倍突发（M1，软护栏语义，可接受）。
- 单次预估对 ASCII/数字密集输入可能低估 ~4 倍（M4，输出侧 max_tokens:1500 封顶，成本有界）。
- 本评审已修复项：**C1**（匿名走免费链 + 限流）、**H1**（experiences 漏传 opts 计量）、**M2**（限流 Map 内存泄漏：周期性 sweep）、**M5**（AiUsage 加 createdAt 索引）、**L1**（日额度 off-by-one `>=`）。
