# AI 面师 微信小程序

基于 **Vant Weapp** 组件库 + 品牌靛蓝设计系统。本文件是新增页面/功能时必须遵守的约定。

## 环境接入

1. 依赖在 `miniprogram/package.json`（`@vant/weapp`），`node_modules` 不入库。
2. 新增/更新依赖后：微信开发者工具 → 工具 → **构建 npm**，生成 `miniprogram_npm/`。
3. `project.config.json` 已配 `packNpmManually: true` + `packNpmRelationList` 指向 `./package.json`。

## 设计 Token（app.wxss 顶部 `page`）

| Token | 值 | 用途 |
|-------|-----|------|
| `--brand-primary` | `#6366f1` | 主色（与 Web 端一致，柔和靛蓝） |
| `--brand-bg` | `#f8fafc` | 页面背景 |
| `--brand-card` | `#ffffff` | 卡片背景 |
| `--brand-text` | `#1e293b` | 主文字 |
| `--brand-muted-text` | `#64748b` | 次要文字 |
| `--brand-border` | `#e2e8f0` | 边框 |
| `--brand-primary-light` | `#eef2ff` | 主色浅底（评分圆等） |
| `--brand-danger` | `#ef4444` | 危险/删除 |
| `--brand-radius-lg/md/sm` | 24/16/12rpx | 圆角 |

Vant 主题通过 `--van-*` 变量映射（见 app.wxss），新增 Vant 组件如需定制色，优先改 app.wxss 的映射，不改组件内部。

**商业化预留**：换主题只需替换 app.wxss 顶部 token + `--van-*` 映射。

## 共享类（app.wxss，页面内直接复用）

`.page`（页面容器，24rpx 内边距+品牌背景）、`.card`、`.card-title`、`.section-title`、`.stats-grid`/`.stat-card`/`.stat-value`/`.stat-label`（统计卡）、`.score-circle`（评分圆）、`.empty-state`、`.loading`、`.msg-row`/`.msg-bubble`（聊天气泡）、`.tag`（徽章兜底）、`.mt-8/16/24/32`（间距）。

**页面专属样式放页级 `.wxss`，共享的必须进 app.wxss**，不要重复定义。

## 页面模式（新增页面照此模板）

1. `.json`：`usingComponents` 声明用到的 Vant 组件，路径 `@vant/weapp/xxx/index`。
2. `.wxml`：顶层 `<view class="page">`，禁用内联 `style=`；Vant 组件用 `bind:click`/`bind:confirm` 等冒号事件。
3. `.wxss`：新建页级文件，页面专属类用 rpx + 品牌变量。

### Vant 常用组件速查

```json
{ "van-button": "@vant/weapp/button/index", "van-field": "@vant/weapp/field/index", "van-cell": "@vant/weapp/cell/index", "van-cell-group": "@vant/weapp/cell-group/index", "van-tag": "@vant/weapp/tag/index", "van-loading": "@vant/weapp/loading/index", "van-empty": "@vant/weapp/empty/index", "van-popup": "@vant/weapp/popup/index", "van-picker": "@vant/weapp/picker/index", "van-dialog": "@vant/weapp/dialog/index" }
```

### van-picker（轮次选择）约定
- JS 持有 `roundTypes`（`{value,label}[]`）+ `roundColumns`（label 字符串数组）+ `showRoundPicker`。
- 触发：`<van-field readonly is-link value="{{roundTypeLabel}}" bind:click="openRoundPicker" />` + `<van-popup show position="bottom"><van-picker columns="{{roundColumns}}" bind:confirm="onRoundConfirm" bind:cancel="closeRoundPicker" /></van-popup>`。
- confirm 里用 `e.detail.index` 定位选项：`const rt = roundTypes[e.detail.index]`，更新 `roundType`/`roundTypeLabel`。

## 已实现功能（14 页）

**核心**：邮箱/微信登录、面试 CRUD、AI 复盘、模拟面试、录音转写（→保存面试）、面试日历
**AI**：AI 教练（对话）、面试押题、成长报告、深入分析（canvas 雷达/趋势/薄弱项/公司对比）
**资料**：简历文本（AI 复盘背景）、修改昵称、微信一键登录
**体验**：下拉刷新、列表分页、分享、暗色模式（跟随系统）、隐私授权

首页"更多功能"网格 + tabBar（总览/面试/练习/我的）为入口。

## 后端新增接口（小程序专用）

| 接口 | 用途 |
|------|------|
| `POST /api/auth/wx-login` | 微信一键登录（code→openid→建用户→发会话），需 `WX_APPID`/`WX_SECRET` |
| `POST /api/profile/resume-text` | 保存文本简历 |
| `POST /api/profile/name` | 修改昵称 |
| `POST /api/auth/mp-login` | 邮箱密码登录（返回 token+cookieName） |

## 体验约定

- **下拉刷新**：页面 `.json` 加 `"enablePullDownRefresh": true`，`onPullDownRefresh` 里 `loadData(true)` + `wx.stopPullDownRefresh()`。
- **分页**：列表页 `data` 用 `visible`/`visibleCount`（默认 20），`onReachBottom` 累加 `visibleCount` 后 `updateVisible()`。
- **分享**：页面定义 `onShareAppMessage()` 即启用分享菜单。
- **暗色模式**：`theme.json`（系统导航栏）+ app.wxss `@media (prefers-color-scheme: dark)` 覆盖 `--brand-*`/`--van-*` 变量。
- **隐私授权**：`app.json` `permission.scope.record` + `project.config.json` `__usePrivacyCheck__: true`；平台侧需在 mp.weixin.qq.com 配置"用户隐私保护指引"。

## AI 功能页约定（coach/prep/report）

- 后端接口：`POST /api/coach`（对话）、`POST /api/prep`（押题）、`POST /api/report`（成长报告），返回 **Markdown 文本**。
- `utils/markdown.js` 的 `parseMarkdown(text)` 把 Markdown 转成 `[{type:'h1'|'h2'|'h3'|'li'|'p', text}]` 块，页面用 `wx:for blocks` + `.md-*` 类渲染（app.wxss 已定义）。
- 新增 AI 页面时：JS 里 `parseMarkdown` 生成 blocks 存 data，WXML 只做三元/`===` 判断，不做方法调用。
- 首页"AI 智能"功能网格是入口（`pages/index`），新增功能在此加卡 + `goXxx` 导航。

## WXML 禁止事项

- ❌ 箭头函数（`=>`）、`.find()`/`.findIndex()`、`Math.*`、`util.*` —— WXML 模板不支持，一律在 JS 里预计算成 data 字段。
- ❌ 内联 `style="..."`（除非动态条件样式）。
- ✅ `.toFixed()`、`.length`、三元 `?:` 合法。

## 关键约定（沿用 Web 端）

- 用户可见文案中文；未登录回退 `userId: "default"`。
- 后端 basePath `/interview`，API 前缀在 `config.js` 的 `baseUrl` 里（含 `/interview`）。
- 登录用 `mp-login` 接口拿 `{ token, cookieName }`，请求带 `Cookie: <cookieName>=<token>`（见 `utils/api.js`）。
