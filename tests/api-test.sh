#!/bin/bash
# i面试 API 自动化测试

# next.config 设了 basePath="/interview"，API 实际路径带此前缀
BASE_URL="http://localhost:3000/interview"
PASS=0
FAIL=0

RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'

test() {
  local name="$1"; local method="$2"; local url="$3"; local data="$4"
  local expect_status="$5"; local expect_contains="$6"

  echo -n "  $name ... "
  if [ -n "$data" ]; then
    RESP=$(curl -s -L -w "\n%{http_code}" -X "$method" "$BASE_URL$url" \
      -H "Content-Type: application/json" -d "$data" 2>/dev/null)
  else
    RESP=$(curl -s -L -w "\n%{http_code}" -X "$method" "$BASE_URL$url" 2>/dev/null)
  fi

  HTTP_CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')

  if [ "$HTTP_CODE" = "$expect_status" ]; then
    if [ -n "$expect_contains" ]; then
      echo "$BODY" | grep -q "$expect_contains" && \
        echo -e "${GREEN}✅${NC}" || echo -e "${RED}❌ (缺少'$expect_contains')${NC}"
      if echo "$BODY" | grep -q "$expect_contains"; then
        PASS=$((PASS + 1))
      else
        FAIL=$((FAIL + 1))
      fi
    else
      echo -e "${GREEN}✅${NC}"; PASS=$((PASS + 1))
    fi
  else
    echo -e "${RED}❌ (期望 $expect_status, 得到 $HTTP_CODE)${NC}"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "===================================="
echo "  i面试 API 自动化测试"
echo "===================================="
echo ""

# ─── 1. 页面可达性 ───
echo "[1/6] 页面可达性"
test "首页" "GET" "/" "" "200" "面试"
test "登录页" "GET" "/auth/login" "" "200" "登录"
test "注册页" "GET" "/auth/register" "" "200" "注册"

# ─── 2. 注册用户 ───
echo ""
echo "[2/6] 用户注册"
TEST_EMAIL="test-$(date +%s)@test.com"
TEST_PASS="test123456"

REG_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"测试用户\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}")
REG_CODE=$(echo "$REG_RESP" | tail -1)

if [ "$REG_CODE" = "200" ]; then
  echo -e "  注册新用户: ${GREEN}✅${NC}"; PASS=$((PASS + 1))
else
  echo -e "  注册新用户: ${RED}❌ (HTTP $REG_CODE)${NC}"; FAIL=$((FAIL + 1))
fi

# ─── 3. API 接口 ───
echo ""
echo "[3/6] API 接口"

# 创建面试
IV_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/interviews" \
  -H "Content-Type: application/json" \
  -d '{"companyName":"测试公司","position":"后端开发","roundType":"first","questions":[{"order":1,"questionText":"请自我介绍","userAnswer":"我有3年后端经验"}]}')
IV_CODE=$(echo "$IV_RESP" | tail -1)
IV_BODY=$(echo "$IV_RESP" | sed '$d')

if [ "$IV_CODE" = "201" ]; then
  echo -e "  创建面试: ${GREEN}✅${NC}"; PASS=$((PASS + 1))
  IV_ID=$(echo "$IV_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
else
  echo -e "  创建面试: ${RED}❌ (HTTP $IV_CODE)${NC}"; FAIL=$((FAIL + 1))
fi

if [ -n "$IV_ID" ]; then
  test "获取面试详情" "GET" "/api/interviews/$IV_ID" "" "200" "company"
  test "更新面试结果" "PUT" "/api/interviews/$IV_ID" \
    '{"result":"pass"}' "200" ""

  # ── 简历（用户级）: 先设置简历，AI 复盘会结合简历背景 ──
  test "保存简历文本" "PUT" "/api/profile/resume" \
    '{"resumeText":"张三，5年后端开发经验，精通Java和Go，主导过订单系统"}' "200" "resumeText"
  test "获取简历" "GET" "/api/profile/resume" "" "200" "resumeText"

  # 上传 PDF 简历并解析
  RESUME_PDF="test-resume.pdf"
  node -e "
const fs = require('fs');
const objs = [];
objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
objs[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>';
const stream = 'BT /F1 24 Tf 100 700 Td (Resume Test Content) Tj ET';
objs[4] = '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream';
objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
let pdf = '%PDF-1.4\n';
const offsets = [0];
for (let i = 1; i <= 5; i++) { offsets[i] = Buffer.byteLength(pdf, 'utf8'); pdf += i + ' 0 obj\n' + objs[i] + '\nendobj\n'; }
const xrefPos = Buffer.byteLength(pdf, 'utf8');
let xref = 'xref\n0 6\n0000000000 65535 f \n';
for (let i = 1; i <= 5; i++) xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
pdf += xref + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF\n';
fs.writeFileSync('$RESUME_PDF', pdf, 'utf8');
console.log('OK');
"
  PDF_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/profile/resume" \
    -F "resume=@$RESUME_PDF;type=application/pdf")
  PDF_CODE=$(echo "$PDF_RESP" | tail -1)
  PDF_BODY=$(echo "$PDF_RESP" | sed '$d')
  rm -f "$RESUME_PDF"
  if [ "$PDF_CODE" = "200" ] && echo "$PDF_BODY" | grep -q "Resume"; then
    echo -e "  上传PDF简历解析: ${GREEN}✅${NC}"; PASS=$((PASS + 1))
  else
    echo -e "  上传PDF简历解析: ${RED}❌ (HTTP $PDF_CODE)${NC}"; FAIL=$((FAIL + 1))
  fi

  # AI 复盘（此时简历为测试内容，复盘会结合简历背景）
  test "AI 复盘" "POST" "/api/review" \
    "{\"interviewId\":\"$IV_ID\"}" "200" "overallScore"

  echo "  等待 AI 复盘完成..."
  sleep 1

  # 清理测试简历（避免污染 default 用户，测试无 cookie 走 default）
  test "清理测试简历" "PUT" "/api/profile/resume" '{"resumeText":""}' "200" ""

  # 数据分析
  test "数据分析" "GET" "/api/analysis" "" "200" ""

  # 删除
  DEL_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/api/interviews/$IV_ID")
  if [ "$DEL_RESP" = "200" ]; then
    echo -e "  删除面试: ${GREEN}✅${NC}"; PASS=$((PASS + 1))
  else
    echo -e "  删除面试: ${RED}❌ (HTTP $DEL_RESP)${NC}"; FAIL=$((FAIL + 1))
  fi
fi

# ─── 4. 模拟面试 ───
echo ""
echo "[4/6] 模拟面试"

MOCK_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/mock" \
  -H "Content-Type: application/json" \
  -d '{"action":"start","company":"字节跳动","position":"后端开发","roundType":"first"}')
MOCK_CODE=$(echo "$MOCK_RESP" | tail -1)
MOCK_BODY=$(echo "$MOCK_RESP" | sed '$d')

if [ "$MOCK_CODE" = "200" ]; then
  MOCK_ID=$(echo "$MOCK_BODY" | grep -o '"sessionId":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$MOCK_ID" ]; then
    echo -e "  模拟面试启动: ${GREEN}✅${NC}"; PASS=$((PASS + 1))
    test "模拟回答" "POST" "/api/mock" \
      "{\"action\":\"respond\",\"sessionId\":\"$MOCK_ID\",\"answer\":\"我有5年后端开发经验，精通Java和Go\"}" \
      "200" ""
    test "结束模拟" "POST" "/api/mock" \
      "{\"action\":\"end\",\"sessionId\":\"$MOCK_ID\"}" \
      "200" "overallScore"
  else
    echo -e "  模拟面试启动: ${RED}❌ (无sessionId)${NC}"; FAIL=$((FAIL + 1))
  fi
else
  echo -e "  模拟面试启动: ${RED}❌ (HTTP $MOCK_CODE)${NC}"; FAIL=$((FAIL + 1))
fi

# ─── 5. 转写接口 ───
echo ""
echo "[5/6] 音频转写"

# 生成测试音频文件
TEST_AUDIO="test-audio.wav"
node -e "
const fs = require('fs');
const sr = 16000, dur = 2, len = sr * dur;
const buf = Buffer.alloc(44 + len * 2);
buf.write('RIFF', 0, 'ascii'); buf.writeUInt32LE(36 + len * 2, 4);
buf.write('WAVE', 8, 'ascii'); buf.write('fmt ', 12, 'ascii');
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24);
buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34); buf.write('data', 36, 'ascii');
buf.writeUInt32LE(len * 2, 40);
for (let i = 0; i < len; i++)
  buf.writeInt16LE(Math.round(Math.sin(2*Math.PI*440*i/sr)*0.9*32767), 44+i*2);
fs.writeFileSync('$TEST_AUDIO', buf);
console.log('OK');
"

TRANS_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/transcribe" \
  -F "audio=@$TEST_AUDIO;type=audio/wav" \
  -F "duration=2")
TRANS_CODE=$(echo "$TRANS_RESP" | tail -1)
TRANS_BODY=$(echo "$TRANS_RESP" | sed '$d')

rm -f "$TEST_AUDIO"

if [ "$TRANS_CODE" = "200" ]; then
  echo -e "  音频转写: ${GREEN}✅${NC}"; PASS=$((PASS + 1))
else
  echo -e "  音频转写: ${RED}❌ (HTTP $TRANS_CODE)${NC}"
  echo "  Error: $TRANS_BODY"
  FAIL=$((FAIL + 1))
fi

# ─── 6. 管理后台（管理员会话） ───
echo ""
echo "[6/6] 管理后台"

ADMIN_USER="admin-test-$(date +%s)"
ADMIN_PASS="admin-test-pass-1"
node scripts/create-admin.js "$ADMIN_USER" "$ADMIN_PASS" >/dev/null 2>&1

# 未登录访问管理端 → 一律 401
test "未登录 stats" "GET" "/api/admin/stats" "" "401" ""
test "未登录 users" "GET" "/api/admin/users" "" "401" ""
test "未登录 orders 筛选" "GET" "/api/payment/admin/orders?status=pending" "" "401" ""
test "未登录 grant" "POST" "/api/admin/users/foo/grant" '{"plan":"month"}' "401" ""
test "未登录 revoke" "POST" "/api/admin/users/foo/revoke" '{}' "401" ""
test "未登录 reset-trial" "POST" "/api/admin/users/foo/reset-trial" '{}' "401" ""

# 登录管理员。注意：生产构建 cookie 带 Secure，http://localhost 下 curl 不会自动回带 →
# 手动从 Set-Cookie 头提取 admin_session 值，用 Cookie 头显式携带（绕过 Secure 限制）。
ADMIN_TOKEN=$(curl -s -D - -o /dev/null -X POST "$BASE_URL/api/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" | \
  grep -i '^set-cookie: admin_session=' | head -1 | sed 's/^[Ss]et-[Cc]ookie: admin_session=//; s/;.*//')

if [ -n "$ADMIN_TOKEN" ]; then
  echo -e "  管理员登录: ${GREEN}✅${NC}"; PASS=$((PASS + 1))
else
  echo -e "  管理员登录: ${RED}❌ (无 cookie)${NC}"; FAIL=$((FAIL + 1))
fi

# 带管理员会话的请求
admin_test() {
  local name="$1"; local method="$2"; local url="$3"; local data="$4"
  local expect_status="$5"; local expect_contains="$6"
  echo -n "  $name ... "
  local RESP
  if [ -n "$data" ]; then
    RESP=$(curl -s -H "Cookie: admin_session=$ADMIN_TOKEN" -w "\n%{http_code}" -X "$method" "$BASE_URL$url" \
      -H "Content-Type: application/json" -d "$data" 2>/dev/null)
  else
    RESP=$(curl -s -H "Cookie: admin_session=$ADMIN_TOKEN" -w "\n%{http_code}" -X "$method" "$BASE_URL$url" 2>/dev/null)
  fi
  local HTTP_CODE BODY
  HTTP_CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')
  if [ "$HTTP_CODE" = "$expect_status" ]; then
    if [ -n "$expect_contains" ] && ! echo "$BODY" | grep -q "$expect_contains"; then
      echo -e "${RED}❌ (缺少'$expect_contains')${NC}"; FAIL=$((FAIL + 1)); return
    fi
    echo -e "${GREEN}✅${NC}"; PASS=$((PASS + 1))
  else
    echo -e "${RED}❌ (期望 $expect_status, 得到 $HTTP_CODE)${NC}"; FAIL=$((FAIL + 1))
  fi
}

admin_test "stats 概览" "GET" "/api/admin/stats" "" "200" "totalUsers"
admin_test "用户搜索" "GET" "/api/admin/users?q=$TEST_EMAIL" "" "200" "email"

# 用搜索拿到本次注册的测试用户 id → 跑 grant / revoke / reset-trial 全流程
U_RESP=$(curl -s -H "Cookie: admin_session=$ADMIN_TOKEN" "$BASE_URL/api/admin/users?q=$TEST_EMAIL")
TEST_UID=$(echo "$U_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$TEST_UID" ]; then
  admin_test "手动开通 Pro" "POST" "/api/admin/users/$TEST_UID/grant" '{"plan":"month"}' "200" "proExpiresAt"
  admin_test "订单筛选 source=admin" "GET" "/api/payment/admin/orders?status=paid&source=admin" "" "200" "admin"
  admin_test "订单筛选非法状态 400" "GET" "/api/payment/admin/orders?status=bogus" "" "400" "状态"
  admin_test "撤销 Pro" "POST" "/api/admin/users/$TEST_UID/revoke" '{}' "200" "ok"
  admin_test "重置试用" "POST" "/api/admin/users/$TEST_UID/reset-trial" '{}' "200" "ok"
else
  echo -e "  获取测试用户 id: ${RED}❌${NC}"; FAIL=$((FAIL + 1))
fi

# ─── 6b. 支付收款码 / 人工确认（notify + 收款设置） ───
echo ""
echo "── 6b. 支付收款码 / 人工确认 ──"

# 未登录声明「我已转账」 → 401
test "未登录 notify" "POST" "/api/payment/order/foo/notify" '{}' "401" ""

# 管理端收款设置：保存 / 非法URL / 读取
admin_test "保存收款设置" "PUT" "/api/admin/payment-config" \
  '{"wechatQrUrl":"https://cdn.example.com/wechat.png","alipayQrUrl":"https://cdn.example.com/alipay.png","accountHint":"张三"}' \
  "200" "wechatQrUrl"
admin_test "收款设置非法URL 400" "PUT" "/api/admin/payment-config" \
  '{"wechatQrUrl":"javascript:alert(1)"}' "400" "http"
admin_test "读取收款设置" "GET" "/api/admin/payment-config" "" "200" "alipayQrUrl"

# 用户登录（NextAuth credentials）→ 下单 → 我已转账 → 管理员确认收款 → 闭环。
# 注意：① CSRF 校验需把 csrf-token cookie 回传 → 用 cookie jar；② middleware 强制 secureCookie，
# session cookie 带 __Secure- 前缀 → 整段捕获 name=value。
AUTH_JAR="/tmp/interview-auth-jar.txt"; rm -f "$AUTH_JAR"
CSRF=$(curl -s -c "$AUTH_JAR" "$BASE_URL/api/auth/csrf" | grep -o '"csrfToken":"[^"]*"' | head -1 | cut -d'"' -f4)
CB_HEADERS=$(curl -s -b "$AUTH_JAR" -D - -o /dev/null -X POST "$BASE_URL/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=$TEST_EMAIL" \
  --data-urlencode "password=$TEST_PASS")
rm -f "$AUTH_JAR"
USER_COOKIE=$(echo "$CB_HEADERS" | grep -i '^set-cookie:.*session-token=' | head -1 | sed 's/^[Ss]et-[Cc]ookie: \([^=]*\)=\([^;]*\).*/\1=\2/')

if [ -n "$USER_COOKIE" ]; then
  echo -e "  用户登录(NextAuth): ${GREEN}✅${NC}"; PASS=$((PASS + 1))
else
  echo -e "  用户登录(NextAuth): ${RED}❌ (无 session cookie)${NC}"; FAIL=$((FAIL + 1))
fi

user_test() {
  local name="$1"; local method="$2"; local url="$3"; local data="$4"
  local expect_status="$5"; local expect_contains="$6"
  echo -n "  $name ... "
  local RESP
  if [ -n "$data" ]; then
    RESP=$(curl -s -H "Cookie: $USER_COOKIE" -w "\n%{http_code}" -X "$method" "$BASE_URL$url" \
      -H "Content-Type: application/json" -d "$data" 2>/dev/null)
  else
    RESP=$(curl -s -H "Cookie: $USER_COOKIE" -w "\n%{http_code}" -X "$method" "$BASE_URL$url" 2>/dev/null)
  fi
  local HTTP_CODE BODY
  HTTP_CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')
  if [ "$HTTP_CODE" = "$expect_status" ]; then
    if [ -n "$expect_contains" ] && ! echo "$BODY" | grep -q "$expect_contains"; then
      echo -e "${RED}❌ (缺少'$expect_contains')${NC}"; FAIL=$((FAIL + 1)); return
    fi
    echo -e "${GREEN}✅${NC}"; PASS=$((PASS + 1))
  else
    echo -e "${RED}❌ (期望 $expect_status, 得到 $HTTP_CODE)${NC}"; FAIL=$((FAIL + 1))
  fi
}

ORDER_RESP=$(curl -s -H "Cookie: $USER_COOKIE" -X POST "$BASE_URL/api/payment/order" \
  -H "Content-Type: application/json" -d '{"plan":"month"}')
ORDER_ID=$(echo "$ORDER_RESP" | grep -o '"orderId":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$ORDER_ID" ]; then
  echo -e "  下单创建订单: ${GREEN}✅${NC}"; PASS=$((PASS + 1))
  user_test "我已转账声明" "POST" "/api/payment/order/$ORDER_ID/notify" '{}' "200" "ok"
  user_test "重复声明幂等拒绝" "POST" "/api/payment/order/$ORDER_ID/notify" '{}' "400" "已标记"
  admin_test "订单列表带已通知标记" "GET" "/api/payment/admin/orders?status=pending&source=mock" "" "200" "$ORDER_ID"
  admin_test "管理员确认收款开通" "POST" "/api/payment/mock/approve" "{\"orderId\":\"$ORDER_ID\"}" "200" "ok"
  user_test "paid 后不可再声明" "POST" "/api/payment/order/$ORDER_ID/notify" '{}' "400" "待支付"
else
  echo -e "  下单创建订单: ${RED}❌ (无 orderId)${NC}"; FAIL=$((FAIL + 1))
fi

# ─── 6c. AI 成本计量：当日超限 → 429 ───
echo ""
echo "── 6c. AI 成本计量（当日限额 429）──"

# 直接向本地 DB 插入一条超大 AiUsage，模拟当日 token 已耗尽（free 30k / pro 300k 均被 2M 击穿）
AI_USAGE_SEED="$(node -e "
const { PrismaClient } = require('./src/generated/prisma');
const p = new PrismaClient();
(async () => {
  await p.aiUsage.create({
    data: { userId: '$TEST_UID', feature: 'coach', model: 'deepseek', inputTokens: 999999, outputTokens: 999999 },
  });
  console.log('OK');
  await p.\$disconnect();
})().catch(async (e) => { console.error(e); await p.\$disconnect(); process.exit(1); });
")"

if [ "$AI_USAGE_SEED" = "OK" ] && [ -n "$USER_COOKIE" ] && [ -n "$TEST_UID" ]; then
  echo -e "  注入超限 AiUsage: ${GREEN}✅${NC}"; PASS=$((PASS + 1))
  user_test "AI 当日超限 429" "POST" "/api/coach" \
    '{"messages":[{"role":"user","content":"你好，请给我一些面试建议"}]}' "429" "今日"
  # 清理注入行，避免污染本地看板成本数字
  node -e "
const { PrismaClient } = require('./src/generated/prisma');
const p = new PrismaClient();
(async () => {
  await p.aiUsage.deleteMany({ where: { userId: '$TEST_UID', inputTokens: 999999 } });
  await p.\$disconnect();
})().catch(() => process.exit(0));
"
else
  echo -e "  注入超限 AiUsage: ${RED}❌ (seed=$AI_USAGE_SEED uid=$TEST_UID)${NC}"; FAIL=$((FAIL + 1))
fi

# ─── 结果 ───
echo ""
echo "===================================="
TOTAL=$((PASS + FAIL))
echo "  总计: $TOTAL | 通过: $PASS | 失败: $FAIL"
if [ "$FAIL" = "0" ]; then
  echo -e "  ${GREEN}🎉 全部通过!${NC}"
else
  echo -e "  ${RED}❌ $FAIL 项失败${NC}"
fi
echo "===================================="
echo ""
