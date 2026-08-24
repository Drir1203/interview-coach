// 创建管理员账号（AdminUser）：node scripts/create-admin.js <用户名> <密码>
// - 纯 Node 运行（CJS），不依赖 tsx/编译
// - 从 cwd 的 .env 读 DATABASE_URL（服务器部署后 cd /opt/interview-coach 执行）
// - 幂等：用户名已存在则提示，不覆盖
require("dotenv").config()
const { PrismaClient } = require("../src/generated/prisma")
const { hash } = require("bcryptjs")

async function main() {
  const [username, password] = process.argv.slice(2)
  if (!username || !password) {
    console.error("用法: node scripts/create-admin.js <用户名> <密码>")
    process.exit(1)
  }

  const prisma = new PrismaClient()
  try {
    const existing = await prisma.adminUser.findUnique({ where: { username } })
    if (existing) {
      console.log(`管理员「${username}」已存在，跳过（如需重置密码请先删除该行再运行）`)
      return
    }
    const passwordHash = await hash(password, 10)
    await prisma.adminUser.create({ data: { username, passwordHash } })
    console.log(`✅ 已创建管理员「${username}」`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error("创建失败:", err.message)
  process.exit(1)
})
