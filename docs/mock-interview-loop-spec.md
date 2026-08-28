# 模拟面试闭环修复 — 行为规格（SDD）

> 状态：**已确认并实现** · 2026-08-28（门禁全绿：vitest 115/115 + api-test 49/49）
> 背景：见 `docs/commercialization-roadmap.md` P0-3 + `docs/ai-cost-metering-spec.md` 六、遗留面。模拟面试 `/api/mock` 有两个缺口：① 结果不落库，游离在「面试记录 → 复盘 → 能力画像 → 教练建议」闭环之外；② 硬编码直连 Anthropic、未接 `chatWithFallback`，当前无 ANTHROPIC key 时永远是规则 mock，且不计量/不限流/不分层（免费可白嫖）。

## 一、能力点（Capability Points）

- **CP1 结果落库**：模拟面试结束（respond 判结束 或 主动 end）后，把该场会话与总结写入 `Interview` 表（逐题写入 `InterviewQuestion`），打通闭环。状态直接标记 `ai_reviewed`（总结即 AI 评估，无需用户再点复盘；仍可对详情页重新 AI 复盘做深化）。
- **CP2 统一 AI 链**：`/api/mock` 的三处硬编码 `fetch(api.anthropic.com)` 全部改为 `chatWithFallback`，统一模型链（DeepSeek→Qwen→Anthropic→mock）、计量（`feature="mock"`）、分钟限流、模型分层（免费永不触 Claude）。
- **CP3 优雅降级**：会话中途（respond/end）若命中配额错误（当日/单次/限流），降级到规则 mock 继续/收尾，**不硬中断面试**；start 阶段的配额错误在开场前拦截。
- **CP4 免费场次一致**：mock 落库的 `Interview` 计入免费 5 场限额（与真实面试同表同计数）。start 时对已登录用户做 `assertInterviewQuota` 前置拦截（402 fail-fast）。
- **CP5 匿名桶不变**：匿名（`__anon__`/`default`）不落库（无 User 行）、豁免配额，走免费链 + 限流（chatWithFallback 已处理）——保持门禁 api-test 匿名链路行为不变。

## 二、需求场景（Requirement Scenarios）

- **S1** 用户完成一场模拟面试 → 面试记录页出现该场（含分数/优缺/逐题评分），能力画像与教练上下文同步更新
- **S2** 该场在面试详情页可「重新 AI 复盘」→ 深化分析并再次更新画像
- **S3** 用户中途点「结束面试」→ 同样落库（已作答的题目）
- **S4** 免费用户 mock 计入 5 场限额，满 5 场后再 start → 402「免费用户最多 5 场面试，升级 Pro 解锁无限」
- **S5** mock 的 AI 调用计入 admin 看板「今日 AI 调用 / token / 成本」（feature=mock）
- **S6** 匿名/未登录 mock 可正常练习、不落库、免费链 + 限流（行为不变）
- **S7** 会话中途 AI 配额耗尽/限流 → 该轮降级规则 mock，面试不中断，结束后仍落库
- **S8** 落库的 mock 面试带 `type="mock"` 标识，面试记录页显示「模拟」徽标，不与真实面试混淆

## 三、设计要点

- **新字段** `Interview.type`：`String @default("real")`，mock 写 `"mock"`。**新 lib** `src/lib/mock-persist.ts`：
  - `pairHistoryForMock(history)`：real-AI 会话的 `history`（assistant/user 交替）→ `[{question, answer}]`（纯函数）
  - `buildMockInterviewInput(session)`：`MockSession` → 可落库的 Interview create 数据（纯函数，可单测）。题目按 `session.questions` 全量落（含追问），分数按 `summary.questionScores` 以题目文本回查（有则填 `aiScore`，无则 `null`；`aiCategory` 用题目 `category`，与画像维度同词表）
  - `persistMockInterview(userId, session, db=prisma)`：find-or-create `Company`（按 name，同 `/api/interviews` 模式）→ create `Interview`（`type:"mock"`、`status:"ai_reviewed"`、`overallScore/strengths/improvementAreas`、`overallFeedback` 简短文案）→ create `questions` → `updateSkillProfile(userId, db)`。返回 interviewId 或 null（无题不入库）
- **`updateSkillProfile` 加可选 db 参**（`db: PrismaClient = prisma`，同 `getTier` 模式），供 `persistMockInterview` 注入 mock db 单测。
- **路由重构** `/api/mock/route.ts`：
  - `start`：已登录 → `assertInterviewQuota`（402 fail-fast）→ 建 session → `chatWithFallback(startPrompt)` 取首题（无 key/降级 → 规则 mock 首题）
  - `respond`：`chatWithFallback(respondPrompt)` → 含 `[END]` 或规则 mock 判结束 → 调 summary 并 `persistMockInterview`；中途命中 `AiQuotaError` → 该轮降级规则 mock
  - `end`：`chatWithFallback(summaryPrompt)` → 解析 JSON（失败降级 `generateMockSummary`）→ `persistMockInterview`；幂等用 `session.persisted` 标记
  - 会话内存 `Map` 保留（有状态会话无法落库后丢弃）
- **计量 feature**：`"mock"`，schema 注释同步。
- **画像闭环验证**：mock 题目 `category`（technical/behavioral/project_deep_dive/system_design/hr）与 `updateSkillProfile` 读取的 `aiCategory` 同词表 → 落库即进入画像。

## 四、TDD 计划

1. 单测 `tests/unit/mock-persist.test.ts`：
   - `pairHistoryForMock` 交替配对 / 悬挂尾巴丢弃
   - `buildMockInterviewInput`：mock 会话映射（题/分/类/优缺）、无作答题 score 为 null、无题返回 null
   - `persistMockInterview`（mock db）：company find-or-create、Interview+questions 创建、updateSkillProfile 被调
2. api-test 新增 6d：登录用户 mock start→respond→end → 断言 `Interview(type=mock)` 落库 + questions>0 + 画像 upsert；清理测试数据。
3. 门禁：vitest + api-test 全绿后再继续。

## 五、决策记录

- **D1 落库即 ai_reviewed**（2026-08-28）：总结本就是 AI 评估（真实链或规则 mock），直接标已复盘，闭环即时生效；用户可对详情页重新 AI 复盘深化。代价：规则 mock 质量低于全量复盘，但呈现的是用户屏幕上看到的同一份总结，诚实无虚标。
- **D2 免费场次计入 5 场限额**：与真实面试同表同计数，天然卡住免费层无限 AI 练习（成本安全），且与现有付费墙语义一致。已选方案 A（计入限额）；备选 B（mock 不计入、仅靠日 token 限额）更宽松但免费层可无限磨 AI，成本风险更高。
- **D3 中途配额错误降级而非硬 429**：mock 是有状态会话，中途 429 会打断面试。start 拦截（fail-fast），respond/end 降级规则 mock。与其它 AI 路由「直接 429」的差异是有意的，已在 CP3 说明。
- **D4 加 `Interview.type` 标识**：mock 不得伪装成真实面试（数据完整性）；面试记录页加「模拟」徽标。cost：一次 schema 变更 + 前端一处 badge。
- **D5 非目标**：`ai-review.ts` 独立链修复（roadmap 下一迭代）；阿里云语音面试落库（依赖开通，C4 降级设计内）。

## 六、已知边界

- 会话中途用户并发创建真实面试抢占免费名额的竞态：start 已拦截，end 直接落库（分钟级会话，竞态窗口可忽略，与应用非事务风格一致）。
- real-AI 模式下 `summary.questionScores` 与配对 history 的索引对齐为 best-effort（追问合并消息），无法对齐的题 `aiScore=null`，不进入画像统计。
- 会话存储仍为内存 `Map`：PM2 重启/多实例会丢会话（现有行为，不在本期修复范围）。
