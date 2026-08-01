import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { compare, hash } from "bcryptjs"
import prisma from "@/lib/db"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt" },
  trustHost: true,
  // 显式指定，避免 .env 中 NEXTAUTH_URL 带路径（/interview）被 Auth.js 当成 basePath，
  // 导致已剥掉 /interview 前缀的 /api/auth/session 请求解析失败（400 Bad request）
  basePath: "/api/auth",
  pages: {
    signIn: "/auth/login",
    newUser: "/auth/register",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email as string
        const password = credentials.password as string

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.passwordHash) return null

        const isValid = await compare(password, user.passwordHash)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id as string
      return session
    },
    async redirect({ url, baseUrl }) {
      // 确保登录后跳转到 /interview/（带 basePath）
      if (url === baseUrl || url === `${baseUrl}/` || url === "/") {
        return `${baseUrl}/interview/`
      }
      // 其他情况保持原 URL
      return url
    },
  },
})
