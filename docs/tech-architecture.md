# 技术方案文档

## 1. 技术栈

| 层 | 选型 | 版本 |
|---|------|------|
| 框架 | Next.js | 16.2.12 |
| 语言 | TypeScript | 5.x |
| 样式 | Tailwind CSS | 4.x |
| UI 组件 | shadcn/ui (Base UI) | — |
| 图标 | lucide-react | — |
| 图表 | recharts | — |
| 数据库 | PostgreSQL | 16 |
| ORM | Prisma | 5.22.0 |
| 认证 | Auth.js (NextAuth) | 5.0.0-beta.32 |
| 密码 | bcryptjs | — |
| AI 引擎 | DeepSeek / DashScope Qwen / Anthropic Claude | — |
| 语音转写 | DashScope Qwen3-ASR-Flash | — |
| 浏览器压缩 | FFmpeg.wasm | 0.12.10 |
| 部署 | Ubuntu + Nginx + PM2 | — |

## 2. 生产环境架构

```
外网用户 → http://47.116.138.61/interview/
              │
              ▼ Nginx（SSL 反向代理）
         ┌────┴────┐
         │         │
   /interview/    /api/
   localhost:3000  localhost:3000/interview
   (i面试)        (i面试 API)
         │
         ├── PostgreSQL（本地）
         ├── DeepSeek API（AI 复盘）
         └── DashScope API（语音转写）
```

## 3. 部署详情

| 组件 | 详情 |
|------|------|
| 服务器 | Ubuntu 24.04 LTS, 4GB RAM, 49GB disk |
| 进程管理 | PM2（`ecosystem.config.cjs`） |
| Web 服务器 | Nginx 1.24 |
| 监听端口 | 80/443（Nginx）, 3000（Next.js）, 5432（PostgreSQL）|
| 域名 | veyaship.com（SSL via Let's Encrypt）|
| 路径 | `/interview/` basePath |
| 代码路径 | `/opt/interview-coach` |
| Git 仓库 | `github.com/Drir1203/interview-coach` |

### Nginx 配置要点

```
IP 访问（47.116.138.61）:
  /interview/ → localhost:3000（i面试页面）
  /api/       → localhost:3000/interview（i面试 API，含 basePath）
  /           → /var/www/veyaship（crossborder-ai 前端）

域名访问（veyaship.com）:
  /interview/ → localhost:3000（i面试页面）
  /api/       → localhost:8000（crossborder-ai 后端）
  /           → /var/www/veyaship（crossborder-ai 前端）
```

## 4. AI 服务链

```
AI 复盘：
  DeepSeek API（sk-...）→ 成功则返回
  ↓ 失败
  DashScope Qwen  → 成功则返回
  ↓ 失败
  Anthropic Claude → 成功则返回
  ↓ 失败
  Mock 模式（本地模拟数据）

语音转写：
  DashScope Qwen3-ASR-Flash（DASHSCOPE_API_KEY）
  → base64 → chat/completions 接口
  → 60s 分段处理（FFmpeg.wasm 浏览器端分割）
```

## 5. 目录结构

```
interview-coach/
├── prisma/schema.prisma           # 数据模型
├── src/
│   ├── app/
│   │   ├── page.tsx               # Dashboard
│   │   ├── layout.tsx             # 根布局
│   │   ├── providers.tsx          # SessionProvider
│   │   ├── middleware.ts          # 空中间件（路由保护由页面自处理）
│   │   ├── auth/login/ & register/
│   │   ├── interviews/            # 列表/新建/详情/编辑
│   │   ├── companies/             # 公司看板
│   │   ├── analysis/              # 深入分析
│   │   ├── practice/              # 模拟面试
│   │   ├── settings/              # 设置
│   │   └── api/                   # auth/interviews/review/transcribe/analysis/mock/ffmpeg-core
│   ├── components/
│   │   ├── ui/                    # shadcn 组件
│   │   ├── layout/Sidebar.tsx
│   │   ├── AudioRecorder.tsx      # FFmpeg.wasm 压缩+分段
│   │   ├── SkillRadar.tsx / ScoreTrend.tsx
│   │   ├── InterviewCalendar.tsx
│   │   ├── ThemeToggle.tsx
│   │   └── Logo.tsx
│   ├── lib/
│   │   ├── db.ts / auth.ts / utils.ts
│   │   ├── ai-review.ts / ai-mock.ts
│   │   └── transcribe.ts
│   └── types/index.ts
├── ecosystem.config.cjs           # PM2 配置
├── next.config.ts                 # basePath: "/interview"
├── docker-compose.yml / Dockerfile
├── nginx/nginx.conf
├── miniprogram/                   # 微信小程序
└── docs/
```

## 6. 核心数据流

### 录音转写

```
浏览器上传/录制原始音频
    │
    ▼ FFmpeg.wasm（浏览器）
压缩 16kHz mono 32kbps MP3
分割 60 秒一段
    │
    ▼ POST /api/transcribe → 服务端
逐段 base64 → DashScope chat/completions
    │
    ▼ 拼接转写结果
    ▼ AI 提取 QA 对（DeepSeek → DashScope）
```

### AI 复盘

```
POST /api/review { interviewId }
    │
    ▼ 加载面试 + 问题列表
    ▼ aiReview(input)
       ├── reviewWithDeepSeek()
       ├── reviewWithQwen()
       ├── reviewWithAnthropic()
       └── generateMockReview()
    │
    ▼ 保存评分到数据库
    ▼ 未覆盖的问题补默认分值
```

## 7. 环境变量

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/interview_coach"
AUTH_SECRET="your-secret"
DASHSCOPE_API_KEY="sk-..."      # 语音转写
DEEPSEEK_API_KEY="sk-..."       # AI 复盘首选
ANTHROPIC_API_KEY="sk-..."      # AI 复盘备选
```

## 8. 部署命令

```bash
# 首次部署
npm install && npx prisma generate && npm run build
pm2 start ecosystem.config.cjs

# 更新
git pull && npm install && npm run build && pm2 restart

# 查看
pm2 logs "i面试"
pm2 ls
```
