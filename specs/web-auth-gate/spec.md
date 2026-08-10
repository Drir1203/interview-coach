# Web 端未登录访问控制（登录墙 + API 写保护）

> 目标：堵住「未登录也能操作功能页」的洞。未登录访问功能页 → 重定向介绍首页（根路由 `/`，已有 LandingPage）；未登录对业务 API 的写操作 → 401。
> 原则：**不改各页面内部逻辑**（middleware 统一拦）；**不改小程序端**（小程序走同一 API，401 已由 `request()` 处理为登出）。

## 背景事实（已核实）

- `src/middleware.ts` 是空实现：`NextResponse.next()` + `matcher: []` → 所有功能页未登录可访问、可操作。
- 所有 API 路由 `session?.user?.id || "__anon__"`：读返回空（无 `__anon__` 用户），**写照常落共享 `__anon__` 桶** → 未登录可建/改/删 + 所有未登录访客数据互通。
- 根路由 `/`（实际路径 `/interview/`）已按登录态分流：未登录渲染 `LandingPage`（介绍首页，含登录/注册 CTA），登录渲染 `Dashboard`（`src/app/page.tsx:385-387`）。
- 登录/注册页：`/auth/login`、`/auth/register`。
- 14/14 门禁 `tests/api-test.sh` 目前**故意不带 cookie** 测未登录写操作（第 140 行注释「测试无 cookie 走 default」），会依赖未登录成功 → 拦写后必须同步更新门禁。
- `POST /api/auth/mp-login` 返回 `{ token, cookieName }` → 门禁可「注册 → mp-login → 带 Cookie」完成登录态，无需 CSRF 流程。
- `AUTH_SECRET` 已在 `.env`；`next-auth/jwt` 的 `encode` 已被 `wx-login` 使用，JWT 链路可用。

---

## 能力点

### C1 功能页登录墙（方案 A：直达登录页）

**Requirement**：未登录访问功能页时重定向到**本项目的**登录页（basePath 下 `/auth/login`），并携带 `callbackUrl=<原功能页完整路径>`（含 basePath）；登录成功后自动回跳原功能页。已登录正常访问。

> ⚠️ `callbackUrl` 必须含 basePath（`/interview/...`），登录页 `window.location.href = callbackUrl` 才能正确解析回本项目页面。

**Scenario**：
- Given 未登录
- When 访问 `/coach`、`/prep`、`/report`、`/analysis`、`/applications`、`/interviews`(含 `/new`、`/[id]`、`/[id]/edit`)、`/companies`、`/experiences`、`/practice`(含 `/session`)、`/settings`
- Then 302 重定向到 `/interview/auth/login?callbackUrl=<原功能页完整路径>`（如访问 `/coach` → `callbackUrl=/interview/coach`）
- Given 未登录
- When 访问 `/interview/`、`/auth/login`、`/auth/register`、`/api/*`
- Then 正常访问（登录页/注册页/API 公开，根路由 LandingPage 已处理未登录态）
- Given 已登录
- When 访问任一功能页
- Then 正常访问

**验收**：middleware 生效；跳转 URL 恒为 `/interview/auth/login?callbackUrl=<含 basePath 的原路径>`；公开路径白名单 = 本项目根路由 + `/auth/*` + `/api/*` + 静态资源。

### C1b 登录页功能提示（用户关怀：登录前知道要去哪）

**Requirement**：登录页从 `callbackUrl` 解析功能名，副标题显示「登录后继续使用「XX」」，让用户登录前就知道登录后回到哪个功能；登录成功回跳原功能页。

**Scenario**：
- Given 未登录点「面试押题」，被 middleware 带到 `/auth/login?callbackUrl=/interview/prep`
- When 登录页渲染
- Then 副标题显示「登录后继续使用「面试押题」」（`/prep`→面试押题；映射表：`/coach`→AI 教练、`/prep`→面试押题、`/report`→成长报告、`/analysis`→深入分析、`/applications`→投递管理、`/interviews`→面试记录、`/companies`→公司管理、`/experiences`→经历管理、`/practice`→模拟面试、`/settings`→设置；子路径如 `/interviews/new` 按前缀命中「面试记录」）
- Given 登录成功
- When 提交表单
- Then `window.location.href = /interview/prep`，自动回跳押题页
- Given 直接访问登录页（无 callbackUrl）
- When 渲染
- Then 保持原副标题「登录后可在多设备同步面试数据」

**验收**：带 callbackUrl 的登录页能明确提示对应功能；登录后回跳原功能页而非首页。

### C2 API 写操作保护

**Requirement**：未登录对非公开 API 的写操作（POST/PUT/PATCH/DELETE）返回 401；读保持返回空。

**Scenario**：
- Given 未登录
- When `POST /api/interviews`、`PUT /api/interviews/:id`、`DELETE /api/interviews/:id`、`POST /api/applications`、`POST /api/coach`、`POST /api/coach/conversations`、`POST /api/review`、`POST /api/mock` 等
- Then `401` + `{ error: "请先登录" }`
- Given 未登录
- When `GET` 任意业务 API
- Then 返回空数据（维持现状，不泄露任何用户数据）
- Given 未登录
- When `POST /api/auth/*`（register/login/mp-login/wx-login/session/csrf）
- Then 正常（认证接口必须公开）

**验收**：除 `/api/auth/*` 外，所有业务 API 的写方法对未登录一律 401。

### C3 门禁更新

**Requirement**：`tests/api-test.sh` 改为「先注册 + mp-login 登录 + 全程带 Cookie」，并新增未登录写 401 断言。

**Scenario**：
- Given 测试脚本
- When 注册新用户
- Then `POST /api/auth/mp-login` 拿 `token` + `cookieName`
- When 之后所有业务请求
- Then 带 `Cookie: <cookieName>=<token>` 头，期望与原断言一致（创建 201 / 更新 200 / 复盘 200 等）
- Given 未登录
- When `POST /api/interviews`
- Then 期望 `401`（新增断言）
- Given 未登录
- When `GET /api/interviews`
- Then 期望 `200`（空数组，读不受限）

**验收**：门禁全绿（计数按新断言重算），且覆盖「未登录写 401」。

---

## 非目标（明确不做）

- 不改任何功能页内部逻辑（middleware 统一拦，零页面改动）。
- 不改小程序端（小程序走同一 API；401 由 `request()` 触发登出）。
- 不做角色/权限分级（登录即全部功能可用）。
- 不引入管理员后台。

## 测试计划

- **回归门禁**：更新后跑 `bash tests/api-test.sh`（需本地/服务器 3000 起服）。
- **vitest**：middleware 涉及 `next/server`，Node 环境下单测价值低，以门禁 + 人工 curl 验证为准；既有 32 项 vitest 保持绿。
