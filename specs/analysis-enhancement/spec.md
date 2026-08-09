# ④ 深入分析页同步增强 —— 小程序 analysis 页

> 目标：修复小程序 analysis 页分数刻度 bug（5 分制 → 10 分制）+ 同步 Web 端薄弱项/趋势的展示增强。
> 本轮只动 `miniprogram/pages/analysis/` + `miniprogram/utils/util.js` + 单测。不改 Web / 后端。

## 背景事实（已核实）

- 后端 AI 评分为 **1-10 分制**：`src/lib/ai-review.ts` prompt 明确 `"score": <1-10>`；`aiScore`/`overallScore` 直存。
- Web 端全部按 10 分制渲染：`SkillRadar` `fullMark: 10`、`ScoreTrend` YAxis `domain: [0, 10]`、薄弱项进度条 `avgScore / 10 * 100%`。
- 小程序 analysis 页错误按 5 分制：`drawRadarOn` 的 `scoreAt` clamp `(0,5)` + 比例 `/5`、薄弱项进度条 `avgScore / 5 * 100%`、趋势图 y 轴 `0-5`、认证卡底部分数 clamp `5`。→ 真实 10 分被顶格/溢出。
- 后端 `GET /api/analysis/deep` 已返回 `weaknessTracking`（含 `count`/`trend:[{date,score}]`）和 `trendData`（含 `date/company/position/score`）——小程序 js 已取到字段，仅未渲染。
- `miniprogram/utils/util.js` 为纯 CommonJS 模块，已有 `CATEGORY_LABELS`，适合扩展可测纯函数。
- 注意：昨日的 interview-detail 页 C3 已用 `score * 10%`（10 分制，正确），与 analysis 页 5 分制相反，勿回改。

---

## 能力点

### B1 分数刻度修正为 10 分制

**Requirement**：小程序 analysis 页所有分数刻度（雷达/进度条/趋势/认证卡）按 10 分制渲染。

**Scenario**：
- Given 后端返回分数 `score ∈ [0, 10]`
- When `drawRadarOn` 绘制数据多边形
- Then `scoreAt = clamp(score, 0, 10)`，顶点比例 `scoreAt / 10`（网格环 4 层保持不变）
- When 渲染薄弱项进度条
- Then 宽度 `barPercent(avgScore) = clamp(avgScore / 10 * 100, 0, 100)`%
- When `drawTrend` 绘制折线
- Then y 轴范围 `[0, 10]`，横网格步长 2（0/2/4/6/8/10），`yOf = clamp(score, 0, 10) / 10 * plotH`
- When 生成认证卡
- Then 雷达复用 `drawRadarOn`（自动修正），底部分数 clamp `(0, 10)`

**验收**：`score = 10` 时雷达顶点在最外圈、进度条 100%、趋势线在最高点；`score = 5` 时恰好一半（此前 5 分制下已顶格）。

### B2 薄弱项增强：题数 + 走势序列

**Requirement**：每条薄弱项展示累计题数；≥2 场时展示最近走势分数序列。

**Scenario**：
- Given `weaknessTracking` 项含 `count` 和 `trend:[{date, score}]`
- When 渲染薄弱项头部
- Then 显示 `{{ count }} 题`
- When `trend.length >= 2`
- Then 进度条下方显示 `最近 N 场：7 → 8 → 9`（`trendText`，分数四舍五入取整，`→` 连接）
- Given `trend.length < 2`
- Then 不显示走势文本

**验收**：`trendText` 为 util 纯函数，空/单场返回 `""`。

### B3 趋势数据明细列表

**Requirement**：趋势折线下方展示每场面试的数据明细（日期/公司/岗位/分数），最新在前。

**Scenario**：
- Given `trendData` 非空
- When 渲染趋势区
- Then 折线图下方列表逐条展示：日期 + 公司 + 岗位 + 分数（`toFixed(1)`），按日期倒序（最新在前）
- Given `trendData` 为空
- Then 不展示明细列表

**验收**：canvas 折线用正序 `trend`（时间从左到右），列表用倒序副本；仅当趋势图存在时展示。

### C1 跨公司对比增强：维度得分明细

**Requirement**：每家公司卡片下方展示各能力维度得分明细（中文标签 + 进度条 + 分数）。

**Scenario**：
- Given `companyComparison` 项含 `skillProfile:[{category, score}]` 且非空
- When 渲染该公司行
- Then 行内展开各维度：`CATEGORY_LABELS[category] || category` 标签 + 进度条（`barPercent(score)`）+ 分数（`toFixed(1)`）
- Given `skillProfile` 为空
- Then 不展示明细

**验收**：`score` 同为 10 分制，复用 `barPercent`；不做每公司独立雷达 canvas（多实例性能差，以进度条明细替代）。

### C2 趋势公司筛选

**Requirement**：趋势区提供公司筛选器（picker），切换后折线与明细联动刷新。

**Scenario**：
- Given 用户选择「全部公司」或某公司
- When 切换筛选
- Then 折线 `scoreTrend` 与明细 `trendDetail` 均按 `filterTrend(trendData, company)` 过滤后重绘（canvas 用正序，明细用倒序）
- Given 过滤后无数据
- Then 显示「暂无趋势数据」占位，不绘制 canvas

**验收**：`filterTrend` 为 util 纯函数；筛选状态不持久化，重进页面回到「全部公司」。

---

## 非目标（明确不做）

- 每公司独立雷达 canvas → 以维度明细+进度条替代（避免多 canvas 性能/复杂度）
- Web 端任何改动
- 后端 `/api/analysis/*` 任何改动

## 测试计划

- **纯函数**（`miniprogram/utils/util.js`，可测）：
  - `clampScore(score, max = 10)` — clamp `[0, max]`，非数字返回 0
  - `barPercent(score, max = 10)` — 进度条百分比 `clamp(score/max*100, 0, 100)`，保留整数
  - `trendText(trend)` — `trend.length >= 2` 时返回 `"7 → 8 → 9"`，否则 `""`
  - `filterTrend(trend, company)` — `company` 空/`"all"` 返回原数组，否则过滤该公司的面试；非法输入返回 `[]`
- **单测**：`miniprogram/utils/util.test.js`（vitest），覆盖上述边界：越界/非法输入/单场/空筛选/非法输入。
- **UI 胶水层**（wxml/wxss/canvas 绘制）豁免测试，理由：纯展示逻辑，业务状态均收敛于 util 纯函数。
- **回归门禁**：本轮不动 Web/后端，以 vitest 为门禁（沿用昨日决策）。
