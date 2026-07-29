# i面试 — 你的 AI 面试教练

> AI 驱动的面试复盘工具 — 记录面试 → AI 复盘 → 提升自己

## 功能一览

| 功能 | 说明 |
|------|------|
| 🤖 **AI 复盘** | 逐题评分 + 优化回答 + 薄弱维度识别（支持 Mock） |
| 🎤 **录音转写** | 实时录制 / 上传音频 → 自动提取问答 |
| 🎯 **AI 模拟面试** | 多轮对话式面试 → 评分报告 |
| 📊 **数据看板** | 统计卡片 + 雷达图 + 趋势图 |
| 🏢 **公司看板** | 按公司聚合面试表现 |
| 🔐 **多设备同步** | 注册登录 + PostgreSQL 云端存储 |

## 技术栈

Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui + PostgreSQL + Prisma + Auth.js

## 开发

```bash
npm run dev     # http://localhost:3000
npm run build   # 构建
```

## 文档

| 文档 | 说明 |
|------|------|
| [产品需求文档](docs/PRD.md) | 产品定位、功能清单、用户旅程 |
| [产品功能规格](docs/product-specs.md) | 数据模型、API 设计、枚举定义 |
| [技术方案文档](docs/tech-architecture.md) | 技术栈、架构图、目录结构、数据流 |

## 环境变量

```env
DATABASE_URL="postgresql://user@localhost:5432/interview_coach"
AUTH_SECRET="your-secret-here"
```

## 项目结构

```
src/
├── app/          # 页面 + API 路由
├── components/   # 组件
├── lib/          # 核心逻辑
├── auth.ts       # Auth.js 配置
└── middleware.ts # 路由保护
```
