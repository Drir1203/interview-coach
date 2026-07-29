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
| AI API | Anthropic Claude | — |
| 语音 | OpenAI Whisper API | — |
| 部署 | Vercel | — |

## 2. 架构图

```
┌──────────────────────────────────────────────────┐
│               Browser (Next.js App)               │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Pages    │  │  API      │  │  Auth.js       │  │
│  │ (RSC/CSR) │  │  Routes   │  │  (Session)     │  │
│  └──────────┘  └─────┬─────┘  └────────────────┘  │
│                      │                            │
└──────────────────────┼────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
   ┌──────┴──────┐ ┌───┴────┐ ┌───┴──────┐
   │  Prisma +   │ │ Claude │ │ Whisper  │
   │ PostgreSQL  │ │  API   │ │   API    │
   └─────────────┘ └────────┘ └──────────┘
```

## 3. 目录结构

```
interview-coach/
├── prisma/
│   └── schema.prisma              # 数据模型
├── src/
│   ├── app/
│   │   ├── page.tsx               # Dashboard
│   │   ├── layout.tsx             # 根布局 + Providers
│   │   ├── providers.tsx          # SessionProvider
│   │   ├── auth/
│   │   │   ├── login/page.tsx     # 登录页
│   │   │   └── register/page.tsx  # 注册页
│   │   ├── interviews/
│   │   │   ├── page.tsx           # 面试列表
│   │   │   ├── new/page.tsx       # 新建面试
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # 面试详情（AI复盘 + 结果标注）
│   │   │       └── edit/page.tsx  # 编辑面试
│   │   ├── companies/page.tsx     # 公司看板
│   │   ├── practice/
│   │   │   ├── page.tsx           # 模拟面试配置
│   │   │   └── session/page.tsx   # 模拟面试对话
│   │   ├── settings/page.tsx      # 设置
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── [...nextauth]/route.ts
│   │       │   └── register/route.ts
│   │       ├── interviews/route.ts & [id]/route.ts
│   │       ├── review/route.ts
│   │       ├── transcribe/route.ts
│   │       ├── analysis/route.ts
│   │       └── mock/route.ts
│   ├── components/
│   │   ├── ui/                    # shadcn 组件（14个）
│   │   ├── layout/Sidebar.tsx     # 侧边导航
│   │   ├── AudioRecorder.tsx      # 录音 + 文件上传
│   │   ├── SkillRadar.tsx         # 雷达图
│   │   └── ScoreTrend.tsx         # 趋势图
│   ├── lib/
│   │   ├── db.ts                  # Prisma 客户端
│   │   ├── auth.ts                # Auth.js 配置
│   │   ├── ai-review.ts           # AI 复盘逻辑
│   │   ├── ai-mock.ts             # 模拟面试逻辑
│   │   ├── transcribe.ts          # 录音转写 + QA 提取
│   │   └── utils.ts               # 工具函数
│   │── middleware.ts              # 路由保护
│   └── types/index.ts             # 类型定义
├── .env                           # 环境变量
└── docs/
    ├── PRD.md
    ├── product-specs.md
    └── tech-architecture.md
```

## 4. 核心数据流

### 面试录入 + AI 复盘
```
用户填表 → POST /api/interviews → Prisma 写入 PG
                                └→ 可选：POST /api/review
                                       └→ Claude API / Mock
                                       └→ 写回 AI 评分
```

### 录音转写
```
MediaRecorder / FileUpload → POST /api/transcribe
                              └→ Whisper API / Mock
                              └→ 提取 QA 对 → 填充问题列表
```

### 模拟面试
```
配置信息 → POST /api/mock (start)
           └→ 返回首题
用户回答 → POST /api/mock (respond)
           └→ AI 反馈 + 追问 / 下题
用户结束 → POST /api/mock (end)
           └→ 生成总结报告
```

## 5. AI 调用方式

### Mock 模式（无 API Key）
- 所有 AI 功能内置本地 mock 数据
- AI 复盘：返回预设评分和反馈
- 录音转写：返回模拟 QA 对
- 模拟面试：从题库出题 + 模拟评分

### 真实模式（配置 API Key）
- 复盘：调用 Claude Sonnet 4
- 转写：调用 Whisper API + Claude 提取 QA
- 模拟面试：Claude 多轮对话

## 6. 成本估算

| 操作 | Mock | Claude API | Whisper API |
|------|------|-----------|-------------|
| AI 复盘 | $0 | ~$0.01/次 | — |
| 录音转写 | $0 | ~$0.005/次 | $0.006/分钟 |
| 模拟面试 | $0 | ~$0.03/场 | — |

## 7. 开发路线

| Phase | 内容 | 状态 |
|-------|------|------|
| 0 | 项目初始化 + CRUD + shadcn/ui | ✅ |
| 1 | AI 复盘（Mock + Claude） | ✅ |
| 2 | 数据可视化（雷达图 + 趋势图） | ✅ |
| 3 | 录音转写 + QA 提取 | ✅ |
| 4 | PostgreSQL + 用户认证 | ✅ |
| 5 | AI 模拟面试 | ✅ |
| 6 | 面试结果标注 | ✅ |
| 7 | 多端化（API 后端 / App / 小程序） | ❌ |
| 8 | 数据分析深化（对比/追踪/下钻） | ❌ |
| 9 | 体验完善（导出/日历/移动端/暗色） | ❌ |

## 8. 环境变量

```env
DATABASE_URL="postgresql://crossborder@localhost:5432/interview_coach"
AUTH_SECRET="your-secret-here"
```
