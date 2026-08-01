# i面试 项目规则

## 核心规则：改动必测

任何代码改动后，必须先运行自动化测试确保通过（14/14），再继续开发。

> 详情见 `.claude/skills/quality-gate/skill.md`

## 技术栈

- Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui
- PostgreSQL + Prisma
- Auth.js (NextAuth)
- AI: DeepSeek / DashScope Qwen / Anthropic Claude

## 关键约定

- API Key 由平台配置（环境变量），用户无感知
- 用户可见文案用中文
- 未登录用户使用 `userId: "default"`
