#!/bin/bash
# ============================================================
# 生产部署脚本（零损坏：停服→构建→启动）
# 用法: bash scripts/deploy.sh
#
# 关键：必须在「停服后」构建，禁止边构建边服务——
# 否则 npm run build 覆盖 .next 时，运行中的 next start 读到损坏的 manifest → 500
# ============================================================
set -e
SERVER="root@47.116.138.61"
KEY="$HOME/.ssh/deploy_key"
DIR="/opt/interview-coach"

echo "=== 1/7 备份服务器配置 ==="
ssh -i "$KEY" "$SERVER" "cd $DIR && cp .env .env.bak.\$(date +%Y%m%d%H%M) && cp ecosystem.config.cjs ecosystem.config.cjs.bak.\$(date +%Y%m%d%H%M)" 2>/dev/null

echo "=== 2/7 同步代码（排除 node_modules/.next/.env/miniprogram 等）==="
tar czf - \
  --exclude='node_modules' --exclude='.next' --exclude='.env' --exclude='.env.*' \
  --exclude='logs' --exclude='.git' --exclude='miniprogram' --exclude='miniprogram_npm' \
  --exclude='dev.db' --exclude='.pdf-repro' --exclude='src/generated' \
  --exclude='bash.exe.stackdump' --exclude='*.tsbuildinfo' --exclude='.claude' \
  . | ssh -i "$KEY" "$SERVER" "cd $DIR && tar xzf -"

echo "=== 3/7 停服（关键：防止边构建边服务损坏 .next）==="
ssh -i "$KEY" "$SERVER" "cd $DIR && pm2 stop i面试"

echo "=== 4/7 更新数据库 ==="
ssh -i "$KEY" "$SERVER" "cd $DIR && npx prisma db push --accept-data-loss 2>&1 | tail -1; npx prisma generate 2>&1 | grep Generated"

echo "=== 5/7 安装依赖 + 构建（服务器已停）==="
ssh -i "$KEY" "$SERVER" "cd $DIR && npm install --ignore-scripts 2>&1 | tail -1 && npm run build 2>&1 | grep -E 'error|Compiled' | head -1"

echo "=== 6/7 启动 ==="
ssh -i "$KEY" "$SERVER" "cd $DIR && pm2 start i面试"

echo "=== 7/7 验证 ==="
sleep 4
curl -s -k -L -o /dev/null -w "i面试面板: %{http_code}\n" --max-time 15 "https://47.116.138.61/interview/"
curl -s -k -o /dev/null -w "crossborder health: %{http_code}\n" --max-time 10 "https://47.116.138.61/health"
echo "✅ 部署完成"
