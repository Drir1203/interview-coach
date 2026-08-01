# 全栈开发面试 — 项目部署与后端知识总结

> 用 i面试 项目讲解 GitHub 代码上云、后端架构、服务器部署

## 一、代码部署上云流程

### 1. 整体流程
```
本地开发 → GitHub 仓库 → 云服务器 → Nginx 反向代理 → 用户访问
```

### 2. 具体步骤
```bash
# ① 本地开发完提交到 GitHub
git add -A && git commit -m "功能说明"
git push origin main

# ② 登录云服务器
ssh root@47.116.138.61

# ③ 拉取代码
cd /opt/interview-coach
git pull origin main

# ④ 安装依赖 + 构建
npm install
npm run build

# ⑤ 用 PM2 启动（守护进程）
pm2 start ecosystem.config.cjs
pm2 save  # 保存进程列表，开机自启
```

### 3. PM2 的作用
| 特点 | 说明 |
|------|------|
| 守护进程 | 崩溃自动重启 |
| 日志管理 | `pm2 logs` 查看运行日志 |
| 负载均衡 | 可开多实例 |
| 开机自启 | `pm2 startup` |

### 4. 常用命令
```bash
pm2 ls              # 查看进程
pm2 logs i面试       # 查看日志
pm2 restart i面试    # 重启
pm2 delete i面试     # 删除
```

---

## 二、服务器架构

```
用户浏览器
    │
    ▼ HTTPS (443)
Nginx（反向代理）
    ├── /interview/ → localhost:3000（Next.js）
    ├── /api/       → localhost:8000（另一个后端）
    └── /           → 静态文件（Vue/React SPA）
    │
    ▼
Next.js 应用
    ├── PostgreSQL（数据库，端口5432）
    ├── DeepSeek API（AI）
    └── DashScope API（语音）
```

### 关键概念
- **反向代理**：Nginx 把请求转发到不同后端，隐藏真实服务，一个域名多应用
- **端口隔离**：3000(Next.js) / 8000(FastAPI) / 5432(PostgreSQL)
- **HTTPS/SSL**：Let's Encrypt 免费证书 + 自动续期 cron
- **basePath**：`/interview/` 前缀，多个应用共存一台服务器
- **反向代理 vs 正向代理**：正向代理替客户端访问（VPN），反向代理替服务端接收请求

---

## 三、后端技术点

### 1. RESTful API 设计
```typescript
// 资源导向的 URL
GET    /api/interviews       // 获取列表
POST   /api/interviews       // 创建
GET    /api/interviews/:id   // 获取单个
PUT    /api/interviews/:id   // 更新
DELETE /api/interviews/:id   // 删除
```

### 2. JWT 认证流程
```
1. 用户注册 → 密码 bcrypt 加密 → 存数据库
2. 用户登录 → 服务端验证密码 → 签发 JWT
3. JWT 存 cookie（HttpOnly）→ 前端每次请求自动带上
4. 服务端解密验证身份 → 返回数据
```

### 3. Prisma ORM
```typescript
// 类型安全，编译期发现错误
const user = await prisma.user.findUnique({
  where: { email }
})
// 外键关联查询
const interviews = await prisma.interview.findMany({
  include: { company: true, questions: true }
})
```
- Schema 驱动：`prisma/schema.prisma` 定义表结构
- 迁移：`prisma db push` 同步到数据库

### 4. AI 多模型集成
```
DeepSeek API → 失败降级 → Qwen → 失败 → Claude → 失败 → Mock
```
```typescript
// OpenAI 兼容格式
const res = await fetch(`${url}/chat/completions`, {
  body: JSON.stringify({
    model: "deepseek-chat",
    messages: [{ role: "user", content: prompt }]
  })
})
```

### 5. 语音转写
```
浏览器 FFmpeg.wasm 压缩（16kHz mono 32kbps MP3）
  → 分段 60秒
  → DashScope ASR → base64 → 转写文本
  → AI 提取问答对
```

---

## 四、数据库设计

```
User ──┬── Interview ──┬── Company
       │               ├── InterviewQuestion
       │               ├── AudioRecording
       │               └── Tag (多对多)
       └── UserSkillProfile
```

### 设计要点
- 主键用 cuid（无序字符串，比自增安全）
- 外键 + 级联删除（onDelete: Cascade）
- JSON 字段存储 AI 分析结果（strengths, weaknessAreas）
- 索引优化查询（userId, companyId, date）

---

## 五、安全实践

| 措施 | 说明 |
|------|------|
| 密码加密 | bcrypt（加盐哈希，防彩虹表） |
| JWT 认证 | 无状态，token 签名防篡改 |
| 参数化查询 | Prisma 自动转义，防 SQL 注入 |
| HTTPS | TLS 加密传输，防中间人 |
| API Key 服务端管理 | 不暴露给前端用户 |
| CORS | 配置允许的来源域名 |
| Cookie HttpOnly | 前端 JS 无法读取，防 XSS 窃取 |

---

## 六、面试常见问题与答案

**Q: 项目怎么部署的？**
> 代码推到 GitHub，云服务器（Ubuntu）上 `git pull`，用 PM2 跑 Next.js 生产构建，Nginx 做反向代理 + HTTPS。多应用通过 basePath 区分。

**Q: 前后端怎么通信？**
> RESTful API，前端用 fetch 调用 `/api/...`，后端返回 JSON。认证用 JWT + HttpOnly cookie。

**Q: 数据库怎么设计的？**
> 用户/公司/面试/问题/标签 五张核心表，用 Prisma 管理，外键关联 + 级联删除，索引优化查询。

**Q: 做过性能优化吗？**
> Next.js 静态页面预渲染 + 增量缓存；CDN 缓存静态资源；数据库索引。

**Q: 怎么保证 API Key 安全？**
> 服务端环境变量存储（`.env`，gitignored），前端用户无感知，平台统一管理。

**Q: 遇到线上故障怎么办？**
> `pm2 logs` 查日志 → 定位错误 → 修复 → `git pull && npm run build && pm2 restart`。

**Q: 多模型 AI 怎么设计降级？**
> 配置多个 Provider（DeepSeek → Qwen → Claude），按优先级调用，失败自动降级到下一个，最后兜底 Mock。

---

## 七、本项目亮点（面试加分项）

1. **AI 多模型降级** — 体现架构设计能力
2. **浏览器端 FFmpeg.wasm** — 解决大文件上传限制，体现性能思维
3. **多端支持** — Web + 微信小程序共用一套 API
4. **完整 CI/CD** — GitHub + PM2 + Nginx 自动化部署
5. **云原生** — PostgreSQL 云端存储，多设备同步
6. **产品思维** — 从 0 到 1 做了市场调研、PRD、MVP、商业化路径
