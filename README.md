# AI 面师 — 你的 AI 面试教练

> AI 驱动的面试复盘工具 — 记录面试 → AI 复盘 → 押题 → 成长报告 → 拿 Offer

**多端**：Web（[https://47.116.138.61/interview/](https://47.116.138.61/interview/)）+ 微信小程序「AI 面师」（14 页，微信审核中）

## 功能一览

### Web 端
| 功能 | 说明 |
|------|------|
| 🤖 **AI 复盘** | 逐题评分 + 优化回答 + 薄弱维度识别（多模型链） |
| 🎤 **录音转写** | 实时录音 / 文件上传 → AI 转写 + 提取问答 |
| 🎯 **AI 模拟面试** | 多轮对话式面试 → 评分报告 |
| 🧠 **AI 教练** | 对话式教练，记忆你的面试数据 |
| 📋 **面试押题** | 输公司/岗位 → AI 押题清单 + 练习计划 |
| 📈 **成长报告** | AI 基于面试趋势+能力画像生成阶段性总结 |
| 📊 **深入分析** | 能力雷达 / 薄弱项 / 跨公司对比 / 评分趋势 |
| 📁 **简历解析** | 上传 PDF → 复盘/押题作候选人背景 |
| 🗓️ **面试日历** | 月历视图，标记面试日期 |
| 📄 **CSV/PDF 导出** | 面试记录导出 |

### 微信小程序（14 页）
- 登录（邮箱 + **微信一键登录**）、面试 CRUD、AI 复盘、模拟面试、AI 教练、押题、成长报告、深入分析、录音转写、面试日历、简历文本、修改昵称
- UI：Vant Weapp + 品牌靛蓝设计系统；暗色模式 / 下拉刷新 / 分页 / 分享 / 热门选项点选

## 技术栈

Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui + PostgreSQL + Prisma + Auth.js + Vant Weapp

## AI 服务

- **复盘/教练/押题/报告**: DeepSeek → DashScope Qwen → Anthropic Claude → Mock
- **转写**: DashScope Qwen3-ASR-Flash
- **压缩**: FFmpeg（浏览器端 60s 分段）

## 生产环境

```
https://47.116.138.61/interview/  (Web)
https://47.116.138.61/interview/  (小程序后端, basePath=/interview)
Ubuntu + Nginx + PM2 + PostgreSQL
微信登录需 WX_APPID/WX_SECRET（已配置）
```

## 文档

| 文档 | 说明 |
|------|------|
| [产品需求文档](docs/PRD.md) | 产品定位、功能清单 |
| [产品功能规格](docs/product-specs.md) | 数据模型、API 设计 |
| [技术方案文档](docs/tech-architecture.md) | 架构、部署、数据流 |
| [部署事故复盘](docs/incident-review.md) | 多项目路径隔离、密钥管理等经验 |
| [小程序名称选型](docs/miniprogram-name-options.md) | 名称候选与决策 |
| [小程序设计约定](miniprogram/README.md) | 组件/样式/接口约定 |

## 本地开发

```bash
npm install
npx prisma generate
npm run dev       # http://localhost:3000
npm run build     # 构建
bash tests/api-test.sh  # 自动化测试（18项）
```

## 微信小程序开发

```bash
cd miniprogram
npm install       # @vant/weapp
# 微信开发者工具 → 构建 npm → 编译
# baseUrl 在 miniprogram/config.js（默认生产）
```

## Git 仓库

```
https://github.com/Drir1203/interview-coach
```
