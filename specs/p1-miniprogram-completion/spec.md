# P1 补齐小程序缺口 —— report 统计卡 + companies 公司看板

> 目标：把 Web 端已有、小程序缺失的两项能力补齐——成长报告页统计卡 + 公司看板页。
> 后端零改动（`/api/report` 的 `data` 字段、`/api/interviews` 均已就绪），只动 `miniprogram/pages/report/`、`miniprogram/pages/companies/`（新建）、`miniprogram/app.json`、`miniprogram/pages/index/`。

## 背景事实（已核实）

- Web 端参考实现：
  - report 统计卡：`src/app/report/page.tsx`（4 卡：总面试/平均分/通过率/能力维度）
  - companies 看板：`src/app/companies/page.tsx`（按 company 分组，卡片含场数 badge、平均分、前 3 场面试，点面试进详情）
- 后端数据已就绪：
  - `POST /api/report` → `{ report, data }`，`data` = ReportStats：`{ total, reviewed, avgScore, passRate, skillProfile, scoreTrend }`（见 `src/lib/ai-report.ts` `loadReportData`）。小程序 `api.generateReport()` 已返回，report.js 只用了 `data.report`，丢弃了 `data.data`。
  - `GET /api/interviews` → 每条含 `company` 对象（id/name/industry）。小程序 `api.getInterviews()` 已有，index 首页已在用。
- 小程序 report 页现状：无任何统计卡（banner → 说明卡 → 报告正文）。
- 小程序无 companies 页；index 首页 feature-grid 有 7 项，无「公司看板」入口。
- 全局样式类已备：`.stats-grid / .stat-card / .stat-value / .stat-label`（app.wxss，index 首页已在用）。

---

## 能力点

### R1 成长报告页统计卡

**Requirement**：report 页 banner 下方展示 4 张统计卡：总面试 / 已复盘 / 通过率 / 平均分。

**Scenario**：
- Given report 页打开
- When 点「生成成长报告」成功
- Then 统计卡随报告一并展示：
  - 总面试 = `data.data.total`
  - 已复盘 = `data.data.reviewed`
  - 通过率 = `data.data.passRate`%（后端已是整数百分比，直接渲染，不 ×100）
  - 平均分 = `data.data.avgScore`，null/0 时显示 `-`，否则保留 1 位小数
- Given 生成失败
- Then `wx.showToast` 提示「报告生成失败，请稍后再试」，统计卡保持隐藏

**验收**：`npm test` 通过；开发者工具生成报告后 4 卡正确显示。

### C1 公司看板页

**Requirement**：新增 `pages/companies/companies` 页，按公司维度展示面试表现。

**Scenario**：
- Given companies 页打开（onLoad）
- When 调 `api.getInterviews()`
- Then 按 `iv.company.id` 分组：
  - 每公司卡片展示公司名、行业（有则显示）、`N 场` badge
  - 平均分 = 已复盘场次（`overallScore` 非空）的均值，无已复盘则省略
  - 前 3 场面试：职位 + 评分（有则显示），点击 `wx.navigateTo` 跳 `interview-detail?id=`
  - 超过 3 场显示「还有 N 场面试」
- Given 无面试记录
- Then 显示 `van-empty`「还没有面试记录」
- Given 加载中
- Then 显示 `van-loading`「加载中...」

**验收**：`npm test` 通过；开发者工具从首页「公司看板」进入后分组正确、点面试可跳详情。

---

## 实现要点

- **report 统计卡**：report.js `data` 增 `stats: null`；`generate()` 成功回调里 `setData({ stats: data.data })`（data.data 可能为空则给默认对象兜底）。wxml banner 后插 `stats-grid`（`wx:if="{{ stats }}"`），复用全局类。
- **companies 页**：新建 `pages/companies/` 四件套。`companies.js` 内联分组（同 Web `companies/page.tsx` 逻辑），`companies.json` 注册 van-empty/van-loading，wxml 用 `.page` + `.banner` + 自定义 `.company-card`，wxss 用 `var(--brand-*)`。
- **入口**：`app.json` pages 追加 `"pages/companies/companies"`；index.js 加 `goCompanies()`；index.wxml feature-grid 追加 `🏢 公司看板` 卡。
- **数据源决策**：companies 用 `getInterviews()` 前端分组（而非 `getDeepAnalysis().companyComparison`）——后者缺每场面试的职位/评分列表，无法对齐 Web「点进面试详情」交互。

**不改**：后端全部（`src/`、`prisma/`）、`miniprogram/utils/api.js`。
