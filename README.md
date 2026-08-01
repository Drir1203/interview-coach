# i面试 — 你的 AI 面试教练

> AI 驱动的面试复盘工具 — 记录面试 → AI 复盘 → 提升自己

## 功能一览

| 功能 | 说明 |
|------|------|
| 🤖 **AI 复盘** | 逐题评分 + 优化回答 + 薄弱维度识别 |
| 🎤 **录音转写** | 浏览器 FFmpeg.wasm 压缩 + DashScope ASR |
| 🎯 **AI 模拟面试** | 多轮对话式面试 → 评分报告 |
| 📊 **数据看板** | 统计卡片 + 雷达图 + 趋势图 |
| 🏢 **公司看板** | 按公司聚合面试表现 |
| 🔐 **多设备同步** | 注册登录 + PostgreSQL 云端存储 |
| 📁 **CSV 导出** | 面试记录含问题/AI评分导出 |

## 技术栈

Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui + PostgreSQL + Prisma + Auth.js

## AI 服务

- **复盘**: DeepSeek → DashScope Qwen → Anthropic Claude → Mock
- **转写**: DashScope Qwen3-ASR-Flash
- **压缩**: FFmpeg.wasm（浏览器端 60s 分段）

## 生产环境

```
http://47.116.138.61/interview/
Ubuntu + Nginx + PM2 + PostgreSQL
```

## 文档

| 文档 | 说明 |
|------|------|
| [产品需求文档](docs/PRD.md) | 产品定位、功能清单 |
| [产品功能规格](docs/product-specs.md) | 数据模型、API 设计 |
| [技术方案文档](docs/tech-architecture.md) | 架构、部署、数据流 |

## 本地开发

```bash
npm install
npx prisma generate
npm run dev       # http://localhost:3000
npm run build     # 构建
bash tests/api-test.sh  # 自动化测试（14项）
```

## Git 仓库

```
https://github.com/Drir1203/interview-coach
```
