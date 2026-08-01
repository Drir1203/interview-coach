---
name: quality-gate
description: 每次改动后必须运行自动化测试 + 验证生产环境
---

# Quality Gate

## 规则

**任何代码改动后，必须先验证再继续。不允许假设改动没问题。**

## 验证步骤

### 1. 本地自动化测试
```bash
cd /project && bash tests/api-test.sh
```
必须 **14/14 全部通过**，有失败项必须先修复。

### 2. 生产环境验证
部署到服务器后，必须用 curl 模拟浏览器访问验证：

```bash
# 页面可访问性
curl -s -L -o /dev/null -w "%{http_code}" "http://47.116.138.61/interview/"
curl -s -k -L -o /dev/null -w "%{http_code}" "https://47.116.138.61/interview/auth/login"

# API 可用性  
curl -s -k -L -o /dev/null -w "%{http_code}" "https://47.116.138.61/api/auth/session"
curl -s -k -L -o /dev/null -w "%{http_code}" "https://47.116.138.61/api/analysis"
```

所有接口必须返回 **200**，不允许 404/500/重定向循环。

### 3. 重定向链检查
对 `http://47.116.138.61/interview/` 完整跟踪：
- 不能出现无限循环
- 最终状态码必须 200
- 308 → 301 → ... → 200 的链是正常的（HTTP→HTTPS + 尾部斜杠处理）

### 4. 浏览器渲染
确认页面 HTML 包含 `<!DOCTYPE html>`，不是 JSON 或 RSC 数据：

```bash
curl -s "https://47.116.138.61/interview/auth/login" | grep -c "<html"
# 必须返回 1
```

## 禁止事项

- ❌ 改完不测就告诉用户"好了"
- ❌ 只在本机测试不验证生产环境
- ❌ 忽略重定向循环问题
- ❌ 改动前不先确认方案

## 测试清单

| 时机 | 测试 | 通过条件 |
|------|------|---------|
| 每次改动后 | `bash tests/api-test.sh` | 14/14 ✅ |
| 部署后 | 生产环境 curl 验证 | 全部 200 ✅ |
| 页面改动后 | HTML 渲染检查 | 有 `<!DOCTYPE html>` ✅ |
| 路径/路由改动后 | 重定向链检查 | 无循环 ✅ |
