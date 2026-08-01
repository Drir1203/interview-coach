# 生产事故复盘报告

## 事故编号
INC-2026-0801-001

## 一、事故概述

**时间**：2026-07-31 至 2026-08-01

**影响**：crossborder-ai（VeyaShip）生产 API 被 i面试 应用劫持。用户在 crossborder-ai 调用 `/api/v1/agent/run` 时，返回的是 i面试 首页 HTML，导致 crossborder-ai 的核心 Agent 功能不可用。

**严重程度**：严重（P1）— 影响线上业务，涉及多项目共享基础设施。

---

## 二、事故经过（时间线）

| 时间 | 事件 |
|------|------|
| 07-31 | 部署 i面试 到共享服务器，设置 Nginx 代理 |
| 07-31 | 为修复 i面试 API 请求 404，将 Nginx `/api/` 路由从 crossborder-ai(8000) 改为 i面试(3000) |
| 07-31 | 用户发现 crossborder-ai `/api/v1/agent/run` 返回 i面试 首页 HTML |
| 08-01 | 确认根因：Nginx `/api/` 路由被劫持 |
| 08-01 | 修复：`/api/` 恢复给 crossborder-ai，新增 `/interview/api/` 给 i面试 |
| 08-01 | 更新 i面试 前端所有 API 调用为 `/interview/api/...` 前缀 |
| 08-01 | 发现并修复密钥泄露问题（.env 已提交到 git） |

---

## 三、根因分析

### 根因 1：共享 Nginx 路由冲突（主因）

两个项目都使用 `/api/` 路径前缀：

```
crossborder-ai:  /api/v1/agent/run  → 8000 端口
i面试:           /api/review        → 3000 端口
```

修改 Nginx 时，将 `/api/` 直接指到 i面试(3000)，没有意识到会劫持 crossborder-ai 的 API。

**本质**：多项目共享一台服务器时，缺少**路径隔离策略**，导致路由冲突。

### 根因 2：缺少变更影响评估

修改 Nginx 前没有检查：
- crossborder-ai 是否使用相同的 URL 前缀
- 改动会影响到哪些既有服务
- 没有先在测试环境验证

### 根因 3：密钥泄露（次生问题）

`.env` 和 `ecosystem.config.cjs` 包含 API 密钥，被提交并推送到 GitHub 公开仓库。

---

## 四、影响范围

| 项目 | 影响 |
|------|------|
| crossborder-ai | `/api/*` 全部被劫持，Agent/产品/内容等核心 API 不可用 |
| i面试 | API 请求路径混乱（早期 `/api/` 能通，改后 `/interview/api/`） |
| 安全 | API 密钥、数据库密码、JWT 密钥已提交到公开 GitHub 仓库 |

---

## 五、修复措施

### 5.1 路由隔离（已完成）
```nginx
# crossborder-ai API（恢复）
location /api/ { proxy_pass http://localhost:8000; }

# i面试 API（专属前缀）
location /interview/api/ { proxy_pass http://localhost:3000; }

# i面试 页面
location /interview/ { proxy_pass http://localhost:3000; }
```

### 5.2 前端路径更新（已完成）
i面试 所有前端 fetch 调用改为 `/interview/api/...`：
- `/interview/api/review`
- `/interview/api/interviews`
- `/interview/api/analysis`
- `/interview/api/auth/...`
- `/interview/api/ffmpeg-core`

### 5.3 密钥安全（已完成）
- `.env` 从 git 跟踪移除（`git rm --cached .env`）
- `ecosystem.config.cjs` 移除硬编码密钥
- `.gitignore` 添加 `.env`、`ecosystem.config.cjs`、`logs/`

### 5.4 环境变量加载（已完成）
- `ecosystem.config.cjs` 使用 `dotenv` 从 `.env` 加载密钥
- 修复服务器 `.env` 的 DATABASE_URL（补全数据库密码）

---

## 六、验证结果

| 请求 | 修复前 | 修复后 |
|------|--------|--------|
| crossborder-ai `/api/v1/agent/run` | ❌ i面试 HTML | ✅ 401（到达后端需认证） |
| crossborder-ai `/health` | — | ✅ 200 |
| crossborder-ai `/` 前端 | — | ✅ 200 |
| i面试 `/interview/` | ✅ | ✅ 200 |
| i面试 `/interview/api/auth/session` | — | ✅ 200 |
| i面试 登录流程 | — | ✅ Session 正常 |
| i面试 自动化测试 | — | ✅ 14/14 |

---

## 七、防范措施（重点）

### 1. 多项目路径隔离原则（必须执行）

```
规则：共享服务器的每个项目必须有唯一路径前缀，禁止共用根路径。
├── crossborder-ai:  /、/api/
└── i面试:           /interview/、/interview/api/
```

**任何新项目部署前，必须确认：**
- [ ] 该项目的 URL 前缀不与现有项目冲突
- [ ] Nginx 改动不会影响其他项目的 location 匹配

### 2. Nginx 变更流程（必须执行）

修改 Nginx 前：
```
1. 列出所有 server_name 和 location 路由
2. 检查是否与其他项目冲突
3. 备份当前配置 (cp veyaship.conf veyaship.conf.bak)
4. 修改后先 nginx -t 校验
5. reload 后立即验证所有受影响的项目
```

### 3. 生产验证清单（每次部署后）

```bash
# 验证所有共享项目（不只验证自己改的那个）
curl -k https://47.116.138.61/health                  # crossborder-ai 健康
curl -k https://47.116.138.61/interview/auth/login     # i面试 登录页
curl -k https://47.116.138.61/api/v1/agent/run          # crossborder-ai API（必须不是HTML）
```

**判断标准**：其他项目 API 返回 JSON/合理错误码（如401），而不是 HTML 页面。

### 4. 密钥管理规范

| 禁止 | 替代方案 |
|------|---------|
| ❌ 密钥写入 `ecosystem.config.cjs` | ✅ 写入 `.env`（已 gitignore） |
| ❌ `.env` 提交 git | ✅ `.env.example` 提交模板 |
| ❌ 部署时用本地 `.env` 覆盖服务器 | ✅ 部署排除 `.env`，服务器单独配置 |
| ❌ 密钥写死在前端代码 | ✅ 后端环境变量读取 |

### 5. 自动化测试增强

每次改动后必须运行：
1. `bash tests/api-test.sh`（i面试 14 项）
2. **跨项目测试**（新增）：
   ```bash
   # 确认 crossborder-ai 未被影响
   curl -k -o /dev/null -w "%{http_code}" https://47.116.138.61/health
   curl -k -X POST https://47.116.138.61/api/v1/agent/run -d '{}'
   # 期望: 200 或 401（JSON响应），绝不能是 i面试 HTML
   ```

### 6. 密钥泄露处置（紧急）

⚠️ **当前密钥已泄露到公开 GitHub 仓库，必须立即更换：**
- [ ] 更换 DeepSeek API Key
- [ ] 更换 DashScope API Key
- [ ] 更换 AUTH_SECRET
- [ ] 更换数据库密码
- [ ] 删除 GitHub 仓库历史中的密钥（或考虑私有化仓库）

---

## 八、经验教训

1. **共享基础设施变更，影响面是全部的，不是局部的** — 改 Nginx 前必须考虑所有项目
2. **路径前缀是隔离边界** — 多项目共服时这是第一道防线
3. **密钥管理是底线** — 任何密钥不得进 git，进了就要当泄露处理
4. **验证要覆盖全，不只验证自己改的** — 改 A 项目要确保 B 项目不挂
5. **操作要有备份和回滚** — 改配置前备份，出问题能立即回滚

---

## 九、后续改进项

- [ ] 使用独立子域名隔离项目（`veyaship.com` / `interview.veyaship.com`）替代路径前缀，从根上避免冲突
- [ ] 建立部署配置版本管理（Nginx 配置纳入 git）
- [ ] 配置自动化健康检查脚本，定期巡检所有服务
- [ ] 密钥轮换机制

---

## 报告信息

- 报告人：DevOps/全栈工程师
- 日期：2026-08-01
- 状态：已修复，待密钥轮换
