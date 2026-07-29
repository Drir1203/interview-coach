# i面试 - Production Dockerfile

FROM node:20-alpine AS builder

WORKDIR /app

# 系统依赖
RUN apk add --no-cache postgresql-client

# 安装 npm 依赖
COPY package.json package-lock.json ./
RUN npm ci

# 生成 Prisma Client
COPY prisma ./prisma
RUN npx prisma generate

# 构建应用
COPY . .
RUN npm run build

# 生产镜像
FROM node:20-alpine AS runner

WORKDIR /app

# 系统依赖
RUN apk add --no-cache postgresql-client

ENV NODE_ENV=production

# 复制构建产物
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/docker-entrypoint.sh /usr/local/bin/

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
