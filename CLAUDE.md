# i面试 项目规则

## 核心规则：改动必测

任何代码改动后，必须先运行自动化测试确保通过（14/14），再继续开发。

> 详情见 `.claude/skills/quality-gate/skill.md`

## 技术栈

- Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui
- PostgreSQL + Prisma（schema 在 `prisma/schema.prisma`）
- Auth.js (NextAuth)，basePath 为 `/interview`
- AI 多模型链：DeepSeek → DashScope Qwen → Anthropic Claude → Mock
  - 通用入口 `src/lib/ai-coach.ts` 的 `chatWithFallback(system, messages, mockFn)`
  - `buildUserContext(userId)` 加载用户面试历史+能力画像作为上下文

## 关键约定

- API Key 由平台配置（环境变量），用户无感知
- 用户可见文案用中文
- 未登录用户使用 `userId: "default"`
- **本目录是独立 git 仓库**（`d:\Project\interview-coach`），与父仓库 `d:\Project` 分开；在 VSCode 里要打开本目录才能看到本项目的 diff

## 已开发功能（部署在 https://47.116.138.61/interview/）

- **AI 教练** `/coach`：对话式教练，记忆用户面试数据
- **面试前押题** `/prep`：输公司/岗位 → AI 生成押题清单+练习计划
- **面试后自动闭环**：复盘自动更新能力画像 + 教练下一步建议
- **成长报告** `/report`：AI 生成阶段性成长总结
- **简历解析**：设置页上传 PDF → 复盘/押题作背景
- AI 复盘/录音转写/看板/分析/模拟面试/导出/日历

## 微信小程序（`miniprogram/`，品牌名「AI 面师」）

- **14 页**，覆盖 Web 全部核心功能：邮箱+**微信登录**、面试 CRUD、AI 复盘、模拟面试、AI 教练、押题、成长报告、深入分析、录音转写、面试日历、简历文本、修改昵称
- UI：Vant Weapp + 品牌靛蓝设计系统（app.wxss token + `--van-*` 映射），暗色模式/下拉刷新/分页/分享
- 微信登录：`/api/auth/wx-login`（需服务器 `WX_APPID`/`WX_SECRET`，已配）
- 生产部署已含小程序新接口（mp-login/wx-login/resume-text/profile-name/transcribe mime 兼容）；小程序 baseUrl 指向 `https://47.116.138.61/interview`
- 名称「AI 面师」微信审核中；上线前需：隐私保护指引（mp 后台）+ 合法 HTTPS 域名 + request 域名白名单

## 部署经验教训（必须遵守，详见 docs/incident-review.md）

1. **禁止在生产服务器跑完整 `npm install`**（ffmpeg-static 下载会超时）。改用 `npm install --ignore-scripts`。
2. **全量同步** `src/` + `prisma/schema.prisma` + `package.json`，避免遗漏旧文件导致页面 404/崩溃。
3. schema 变更必须：`npx prisma db push` + `npx prisma generate`。
4. 部署前备份服务器 `.env` + `ecosystem.config.cjs`；用 `~/.ssh/deploy_key` SSH。
5. 服务器 npm 用国内镜像，部分包可能解压残缺（如 lucide-react 缺 shared/），可从本地 tar 传输完整包修复。
