# ③ AI 复盘增强 —— 小程序 interview-detail 页

> 目标：把 Web 详情页（`src/app/interviews/[id]/page.tsx`）的复盘增强能力同步到小程序详情页
> （`miniprogram/pages/interview-detail/`）。
> 本轮只动 `miniprogram/` + `miniprogram/utils/api.js` + 测试基建（vitest）。不改 Web / 后端（后端 `/api/review` 已支持全部所需能力）。

## 背景事实（已核实）

- 后端 `POST /api/review` 已支持：`{ interviewId, mode?: "full"|"question", questionId?, instruction? }`。
  - `mode` 缺省 = 全量复盘；`mode: "question"` = 只重算单题（score/feedback/improvedAnswer/category/keyMistake）。
  - `instruction` 为自定义要求，空字符串视为未传。
- `aiReview` 返回含 `nextSteps`（教练下一步建议），但**不持久化**——只在 POST 响应里，刷新后消失（Web 同此行为）。
- 小程序 `api.js` 的 `review(interviewId)` 目前只传 `{ interviewId }` 且忽略响应，需要扩展。
- 小程序详情页 js 已解析 `weaknessAreas` 但 wxml 未渲染。
- `miniprogram/utils/util.js` 已有 `CATEGORY_LABELS`（technical→技术基础 等）可复用。

---

## 能力点

### C1 重新分析（全量复盘，支持自定义要求）

**Requirement**：已复盘（`ai_reviewed`）状态下，详情页提供「重新分析」入口；可带可选自定义要求重新调用全量 AI 复盘。

**Scenario**：
- Given 面试状态为 `ai_reviewed`
- When 用户点击「重新分析」
- Then 展开自定义要求输入区（可选），显示「取消」「重新分析」两个按钮
- When 用户点击「重新分析」（要求可为空）
- Then 调用 `POST /api/review` `{ interviewId, instruction }`；请求期间按钮 loading；成功刷新详情并展示新结果（含 C4 建议）；失败 toast「AI 复盘失败」

**验收**：`mode` 不传（默认 full）；`instruction` 为空时后端按未传处理。

### C2 单题重新生成（支持自定义要求）

**Requirement**：每条已 AI 评分的问题提供「重新生成」入口，可带自定义要求只重算该题分析。

**Scenario**：
- Given 某题存在 `aiFeedback`
- When 用户点击该题「重新生成」
- Then 展开自定义要求输入（可选）+「生成」「取消」按钮
- When 用户点击「生成」
- Then 调用 `POST /api/review` `{ interviewId, mode: "question", questionId, instruction }`；成功后刷新详情展示该题新评分/反馈；失败 toast「重新生成失败」

**验收**：同一时间只允许一个「重新生成」请求；`questionId` 必须为当前题目 id。

### C3 薄弱维度展示

**Requirement**：已复盘时展示薄弱维度（类别 + 进度条 + 分数）。

**Scenario**：
- Given `interview.weaknessAreas` 非空（数组，元素含 `category`/`score`）
- When 详情页渲染复盘结果
- Then 在「改进方向」下方显示「薄弱维度」区块，每条 = `CATEGORY_LABELS[category] || category` 标签 + 进度条（`width = score * 10%`）+ 分数数字
- Given `weaknessAreas` 为空/未解析
- Then 隐藏该区块

### C4 AI 教练下一步建议

**Requirement**：复盘/重新分析的 POST 响应含 `nextSteps` 时，展示高亮建议卡。

**Scenario**：
- Given `POST /api/review` 响应含非空 `nextSteps`
- Then 复盘结果区展示「AI 教练建议 · 接下来练什么」高亮卡片
- Given 响应不含 `nextSteps`（如历史数据刷新后）
- Then 不展示该卡片

### C5 单题详情增强：关键失误 + 优化回答

**Requirement**：每条已评分题目展示关键失误；有优化回答时提供查看/收起。

**Scenario**：
- Given 某题 `aiKeyMistake` 非空
- Then 在「AI 反馈」下方以警示色展示「关键失误：xxx」
- Given 某题 `aiImprovedAnswer` 非空
- When 用户点击「查看优化回答」
- Then 展开高亮「优化回答」卡片；再次点击收起
- Given `aiImprovedAnswer` 为空
- Then 不显示该入口

---

## 非目标（明确不做）

- 贡献面经入口 → 归入后续 ① 面经库
- PDF/CSV 导出 → 归入后续 ⑤
- Web 端任何改动
- 后端 `/api/review` 任何改动

## 测试计划

- **基建**：项目当前无单元测试运行器，按项目规则补 `vitest`，`package.json` 增加 `test` / `test:watch` 脚本。
- **单测**：`miniprogram/utils/api.js` 的 `review` 扩展——mock `wx` 环境，断言 `mode/questionId/instruction` 正确透传给 `request`。UI 胶水层（wxml/wxss 渲染）豁免测试，理由：纯展示逻辑无业务状态。
- **回归门禁**：`tests/api-test.sh`（14/14）必须保持通过。
