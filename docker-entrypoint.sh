#!/bin/sh
set -e

# 等待数据库就绪
echo "Waiting for PostgreSQL..."
until pg_isready -h postgres -U interview -d interview_coach 2>/dev/null; do
  sleep 1
done
echo "PostgreSQL is ready."

# 初始化数据库表
echo "Running database migrations..."
npx prisma db push --skip-generate

# 启动应用
echo "Starting i面试..."
exec npm start
