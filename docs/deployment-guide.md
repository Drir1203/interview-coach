# i面试 部署指南

## 架构

```
用户 → Vercel (Next.js) → Neon PostgreSQL
                ↓
          Claude API / Whisper API (可选)
```

## 部署步骤

### 1. 创建 GitHub 仓库

1. 打开 https://github.com/new
2. 仓库名：`interview-coach`
3. 描述：`i面试 - 你的 AI 面试教练`
4. 设为 Public
5. 创建后复制仓库 URL

### 2. 推送代码

```bash
cd D:/Project/interview-coach
git remote add origin https://github.com/你的用户名/interview-coach.git
git push -u origin main
```

### 3. 创建 PostgreSQL 数据库（推荐 Neon）

1. 打开 https://neon.tech 注册账号
2. 创建项目，选择区域（建议选新加坡或日本，离中国近）
3. 创建成功后复制连接字符串：
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/db?sslmode=require
   ```

### 4. 生成 AUTH_SECRET

```bash
# 在终端运行，生成一个随机密钥
openssl rand -base64 32
```

### 5. 部署到 Vercel

1. 打开 https://vercel.com 并登录（用 GitHub 账号）
2. 点击 **Add New → Project**
3. 导入刚创建的 `interview-coach` 仓库
4. 在 Environment Variables 中添加：

| 变量 | 值 |
|------|-----|
| `DATABASE_URL` | 从 Neon 复制的连接字符串 |
| `AUTH_SECRET` | 上一步生成的密钥 |

5. 点击 **Deploy**

### 6. 初始化数据库

部署成功后，在 Vercel 的 Terminal 或本地运行：

```bash
# 本地推 schema 到生产数据库（需要先配置 DATABASE_URL）
npx prisma db push

# 或者在 Vercel 的构建命令中已包含 prisma generate
```

Vercel 的 `vercel.json` 已配置构建时自动运行 `prisma generate`。

### 7. 配置自定义域名（可选）

在 Vercel 项目设置中绑定你自己的域名。

---

## 验证部署

部署完成后访问 `https://interview-coach.vercel.app`：

1. 注册一个账号
2. 创建一条面试记录
3. 点击「AI 复盘」测试 Mock 模式
4. 在设置页配置 Claude API Key 开启真实 AI 功能

---

## 环境变量说明

| 变量 | 必需 | 说明 |
|------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 连接字符串 |
| `AUTH_SECRET` | ✅ | Auth.js 加密密钥（生产必改） |

---

## 小程序接入生产环境

小程序需要配置生产 API 地址：

1. 在 `miniprogram/pages/settings/settings.js` 中将 `baseUrl` 改为你的 Vercel 域名
2. 在微信开发者工具中预览/上传

**注意**：小程序生产环境必须配置合法的 `request` 域名（在微信公众平台设置）。

---

## 升级维护

```bash
# 拉取最新代码
git pull

# 安装依赖
npm install

# 更新数据库
npx prisma db push

# 本地预览
npm run build && npm start

# 推送到 GitHub（自动触发 Vercel 部署）
git push
```
