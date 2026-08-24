#!/bin/bash
# ============================================================
# 生产部署脚本（零损坏：停服→构建→启动）
# 用法: bash scripts/deploy.sh
#
# 关键：必须在「停服后」构建，禁止边构建边服务——
# 否则 npm run build 覆盖 .next 时，运行中的 next start 读到损坏的 manifest → 500
# ============================================================
set -e
SERVER="ubuntu@43.129.23.197"   # 腾讯云香港（免备案，2026-08-17 迁移）
KEY="$HOME/.ssh/deploy_key"
DIR="/opt/interview-coach"

echo "=== 1/8 备份服务器配置 ==="
ssh -i "$KEY" "$SERVER" "cd $DIR && cp .env .env.bak.\$(date +%Y%m%d%H%M) && cp ecosystem.config.cjs ecosystem.config.cjs.bak.\$(date +%Y%m%d%H%M)" 2>/dev/null

echo "=== 2/8 同步代码（排除 node_modules/.next/.env/miniprogram 等）==="
tar czf - \
  --exclude='node_modules' --exclude='.next' --exclude='.env' --exclude='.env.*' \
  --exclude='logs' --exclude='.git' --exclude='miniprogram' --exclude='miniprogram_npm' \
  --exclude='dev.db' --exclude='.pdf-repro' --exclude='src/generated' \
  --exclude='bash.exe.stackdump' --exclude='*.tsbuildinfo' --exclude='.claude' \
  . | ssh -i "$KEY" "$SERVER" "cd $DIR && tar xzf -"

echo "=== 3/8 停服（关键：防止边构建边服务损坏 .next）==="
# 幂等：进程表可能已丢失（pm2 list 空），stop/delete 失败不中断；delete 清掉旧注册，避免 start 重复
ssh -i "$KEY" "$SERVER" "cd $DIR && pm2 stop i面试 2>/dev/null; pm2 delete i面试 2>/dev/null; true"

echo "=== 4/8 更新数据库 ==="
ssh -i "$KEY" "$SERVER" "cd $DIR && npx prisma db push --accept-data-loss 2>&1 | tail -1; npx prisma generate 2>&1 | grep Generated"

echo "=== 5/8 安装依赖 + 构建（服务器已停）==="
ssh -i "$KEY" "$SERVER" "cd $DIR && npm install --ignore-scripts 2>&1 | tail -1 && npm run build 2>&1 | grep -E 'error|Compiled' | head -1"

echo "=== 6/8 启动（用 ecosystem 配置文件，不依赖 PM2 进程表）+ 保存进程表 ==="
ssh -i "$KEY" "$SERVER" "cd $DIR && pm2 start ecosystem.config.cjs && pm2 save"

echo "=== 7/8 同步 Nginx 配置（admin 子域名；需已 certbot 签 admin.mianshi.pro 证书）==="
# 容错：证书未签 / 无 sudo 权限时不阻断主流程，仅提示手动执行
scp -i "$KEY" deploy/nginx-admin.conf "$SERVER":/tmp/nginx-admin.conf
ssh -i "$KEY" "$SERVER" "sudo -n cp /tmp/nginx-admin.conf /etc/nginx/sites-enabled/nginx-admin.conf 2>/dev/null && sudo -n nginx -t 2>&1 | tail -1 && sudo -n nginx -s reload 2>&1 | tail -1 || echo '⚠️  Nginx 配置未生效：请先 sudo certbot --nginx -d admin.mianshi.pro，再 sudo nginx -t && sudo nginx -s reload'"

echo "=== 8/8 验证 ==="
sleep 4
curl -s -L -o /dev/null -w "AI面师面板: %{http_code}\n" --max-time 15 "https://mianshi.pro/interview/"
echo "✅ 部署完成"
