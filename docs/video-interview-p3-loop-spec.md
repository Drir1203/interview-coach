# AI 语音面试闭环（P3）— 行为规格（SDD）

> 状态：**已确认** · 2026-08-28（D1=draft+手动复盘；D3=场次+通话时长估算）
> 背景：`docs/video-interview-spec.md` P3「优化：免费用户场次限制 / 成本监控 / 面试历史归档展示」。
> 现状：阿里云 AI 语音面试（`/api/video-interview/start|status|end`）**零 Prisma 交互** —— 结束只把转写返回前端展示，不落库、不计费、不限次。免费用户可无限开阿里云通话（¥/分钟成本），面试历史里也看不到语音面试。

## 一、能力点（Capability Points）

- **CP1 语音面试落库**：`end` 成功后把转写写入 `Interview` 表（`type="video"` + 原始转写 `transcript` + 从转写解析出的逐题 Q&A），打通「面试记录 → 复盘 → 能力画像 → 教练建议」闭环。
- **CP2 免费场次一致**：视频场次与真实/模拟同表同计数（`type="video"` 计入免费 5 场）。`start` 对已登录用户做 `assertInterviewQuota` 前置拦截（402 fail-fast，在创建阿里云实例**之前**）。
- **CP3 成本计量（站内按场次+时长）**：视频面试是阿里云 IMS 按分钟计费，与 token 计价不同模型，**不写 AiUsage**（避免污染 token 成本估算）。站内以「视频面试场次 + 通话时长」入 Interview（`durationSec`）+ admin 看板新增「视频面试场次（今日/累计）+ 总时长（估算成本）」；免费层由配额门禁兜底。精确账单在阿里云 IMS 控制台。
- **CP4 降级不破坏**：未开通阿里云（`resolveProvider()=null`）→ start 返回 `{mode:"text"}`、end 返回 503 —— 现有 C4 降级行为不变；文字 mock 闭环已在前一迭代闭环。

## 二、需求场景（Requirement Scenarios）

- **S1** 用户结束一场语音面试 → 面试记录页出现该场（「视频」徽标 + 原始转写 + 解析出的逐题问答）
- **S2** 该场在详情页可「AI 复盘」→ 深度评估 + 更新能力画像（复用现有 `/api/review` 链，无需新 AI 调用设计）
- **S3** 免费用户视频面试计入 5 场限额：满 5 场后再 start → 402「免费用户最多 5 场面试，升级 Pro 解锁无限」（前端直接透出，不静默降级到文字 mock）
- **S4** admin 看板显示「视频面试场次（今日/累计）」，运营可见语音面试用量
- **S5** 转写为空（通话失败/异常）→ 不落库，用户可重开且**不消耗**免费场次（场次以落库为准）
- **S6** 未开通阿里云 → 语音面试降级文字 mock，落库/配额行为与现有文字闭环一致（回归不变）

## 三、设计要点

### 3.1 落库元数据来源（前端回传 + auth 属主，实现定稿）

> **实现决策**：初稿用内存 `videoSessions` Map（key = `imsSessionId`），实现时改为 **`end` body 由前端回传 `company/position/roundType/durationSec`，属主 = 登录用户（`auth()` → `Interview.userId`），`type/status` 服务端写死**。
>
> 理由：① Map 在 PM2 重启/多实例时丢失（end 时查不到 → 无法落库），前端回传可存活；② 公司/岗位本就是用户展示字段，与手动录入面试同信任级别；③ 完整性关键字段（type="video"、status="draft"、userId=登录者）不由客户端决定，不可伪造/越权。

`end` 需 `company && position` 才落库；空转写 → `persistVideoInterview` 返回 `null`（不落库、不计数，S5）。

### 3.2 新 lib `src/lib/video-persist.ts`

- `parseVideoTranscript(transcript)`（纯函数）：把 `面试官：…`/`候选人：…` 逐行转写配对为 `[{question, answer}]`：
  - 每条「面试官」行开新题；其后连续的「候选人」行合并为该题 answer（可多轮）
  - 无「面试官」行 → `[]`（转写仍在 Interview.transcript 原样保留）
- `persistVideoInterview(userId, meta, db=prisma)`：
  - `meta = {company, position, roundType, transcript, durationSec?}`
  - find-or-create `Company` → create `Interview`（`type:"video"`、`status:"draft"`、`transcript`、`position/roundType`）→ create `questions`（解析出的 Q&A，`order` 递增，`userAnswer` 填 answer）
  - 转写为空 → 返回 `null` 不落库（S5）；否则返回 interviewId
  - **不调 `updateSkillProfile`**：draft 无 aiScore，画像由后续「AI 复盘」驱动（与手动面试「draft → 复盘 → ai_reviewed → 画像」一致）

### 3.3 路由改动

- **`start/route.ts`**：401 后、`buildUserContext`/`provider.start` **之前**插 `assertVideoQuota(userId)`（CP2，fail-fast）——免费 5 场总限走 `assertInterviewQuota` → 402；Pro 每日 3 场视频走 `assertVideoQuota` 日限 → 429 `VIDEO_DAILY_LIMIT`。拦截直接返回原因，前端不降级文字 mock（CP1）。**门禁仅在 `resolveProvider()` 可用（真的会创建计费实例）时生效**：未配置/不可用 → 交回 `startInterview` 降级文字（C4/S6，不消耗视频配额，避免「阿里云挂了还拿日限挡文字 mock」）。
- **`end/route.ts`**：body 接收 `company/position/roundType/durationSec`；`provider.end(...)` 返回转写后 → `persistVideoInterview(userId, meta)` → 返回 `{sessionId, transcript, interviewId?}`。`durationSec` 做 `clampDuration`（0–7200s 防伪上限）。`resolveProvider()=null` 的 503 分支不变。
- **`status/route.ts`**：不动（前端未轮询，现状保留）。

### 3.4 Schema 变更

`Interview` 增：
- `transcript String? @db.Text` —— 本场原始转写（语音面试归档；语义精确，不复用 userNotes）
- `durationSec Int?` —— 语音面试通话时长（秒，前端 `elapsed` 上报；成本估算参考，非阿里云计费口径）

`type` 注释补 `| video`（`String @default("real") // real | mock | video`）。

### 3.5 前端

- **`practice/session/page.tsx`**：
  - video start 遇 **402** → 直接透出 `b.error`（现 `!vres.ok → setDegraded(true)` 会静默降级文字 mock，文字 mock 也 402 才报错 —— 改成立即透出，少一次 API 调用、文案准确）
  - 结束页：拿到 `interviewId` 后加「查看面试记录」入口（跳详情页）
- **`video-interview-call.tsx`**：end body 追加 `durationSec`（通话计时已有 `elapsed`，传给后端落库，供成本估算）
- **`interviews/page.tsx`**：`type==="video"` 显示「视频」徽标（复用 mock 的 Badge 模式）
- **`interviews/[id]/page.tsx`**（详情页）：有 `transcript` 时折叠展示「原始转写」区块

### 3.6 Admin 看板

`stats/route.ts` 加 `videoInterviewsToday` + `videoInterviewsTotal`（`count where type="video"`，today = `createdAt >= todayStart`）+ 今日/累计 `videoSeconds`（`_sum durationSec`）；`stats-panel.tsx` 加统计卡，按常量单价（¥/分钟）估算成本并标注「估算」。

## 四、TDD 计划

1. 单测 `tests/unit/video-persist.test.ts`：
   - `parseVideoTranscript`：面试官/候选人交替配对、多轮回答合并、无面试官行、空串
   - `persistVideoInterview`（mock db）：company find-or-create、Interview(type=video/transcript) + questions 落库、空 transcript 返回 null
2. api-test：**视频路由依赖阿里云凭据，无法无凭据 e2e**（`resolveProvider()=null` 时 start 只返回 text、end 返回 503，均无新增覆盖面）；既有 14/14 门禁全量回归保证文字 mock 链路不受影响。新增覆盖全部落在单测。
3. 门禁：vitest + api-test 全绿后再继续。

## 五、决策记录（待确认）

- **D1 落库状态 = draft（原始归档）**（用户已确认）：转写是原始材料，不是评估结果。落库为 `status:"draft"`，用户详情页手动「AI 复盘」→ `ai_reviewed` + 画像。与手动面试「draft → 复盘」一致，诚实无虚标，零额外 AI 调用。
- **D2 逐题解析转写**：`面试官/候选人` 配对 → `InterviewQuestion`，复盘/画像/教练上下文由此可用。不解析则视频游离闭环（复盘链要求 `questions.length>0`）。
- **D3 成本监控形态 = 场次 + 通话时长估算**（用户已确认）：`durationSec Int?` 字段记录通话时长，看板显示场次 + 总分钟 + ¥/min 估算成本。挂钟时长 ≠ 阿里云计费口径，看板标注「估算」。
- **D4 视频计入 5 场限额**：与 mock 同语义（用户已确认计入）。视频按分钟计费成本更高，无理由放宽。
- **D5 非目标**：P2 数字人形象（依赖阿里云 VideoAgent 开通）；阿里云账单 API 对账（依赖账单接口，本期不做）。

## 六、已知边界

- 会话落库元数据由前端回传（与手动录入面试同信任级别）；完整性由服务端保证（`type/status/userId` 写死，`durationSec` clamp）。无内存态，PM2 重启/多实例不丢。
- 转写解析为 best-effort：ASR 转写可能有 面试官/候选人 标签错位，错位的行并入相邻题或丢弃，原始转写全文仍保留在 `Interview.transcript`，无数据损失。
- 配额以落库为准（S5）：用户可开一场视频面试中途放弃 → 不落库不计数。阿里云侧实例有 `userOnlineTimeout:60s / maxIdleTime:5min` 成本护栏兜底。
- **start 配额为 count-then-create**：并发开台存在竞态（两个并发请求可能同时通过计数检查各开一台），无服务端并发锁；由阿里云侧实例超时兜底，已接受为残余风险（用户并发自损成本，非越权）。
- **end 无会话属主校验**（区别于 mock 的 `assertSessionOwner`）：语音会话无服务端内存态（PM2 重启即失），属主 = 登录用户（`auth()`）。持有他人随机 `sessionId/imsSessionId` 的调用方可读其转写并复制归到自己名下（复制自伤，非越权窃取），id 不可猜测，已接受为残余风险。
- `durationSec` 计的是前端通话挂钟时长（`elapsed`），非阿里云计费口径（以实例生命周期为准），仅作估算参考，看板标注「估算」。
