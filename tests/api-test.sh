#!/bin/bash
# i面试 API 自动化测试

BASE_URL="http://localhost:3000"
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
echo "[1/5] 页面可达性"
test "首页" "GET" "/" "" "200" "面试"
test "登录页" "GET" "/auth/login" "" "200" "登录"
test "注册页" "GET" "/auth/register" "" "200" "注册"

# ─── 2. 注册用户 ───
echo ""
echo "[2/5] 用户注册"
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
echo "[3/5] API 接口"

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

  # AI 复盘
  test "AI 复盘" "POST" "/api/review" \
    "{\"interviewId\":\"$IV_ID\"}" "200" "overallScore"

  echo "  等待 AI 复盘完成..."
  sleep 1

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
echo "[4/5] 模拟面试"

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
echo "[5/5] 音频转写"

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
