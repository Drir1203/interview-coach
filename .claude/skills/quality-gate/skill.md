---
name: quality-gate
description: 每次改动后必须运行自动化测试 + 生产验证 + 跨项目检查
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
```bash
# 页面可访问性
curl -s -L -o /dev/null -w "%{http_code}" "http://47.116.138.61/interview/"
curl -s -k -L -o /dev/null -w "%{http_code}" "https://47.116.138.61/interview/auth/login"
```
所有接口必须 **200**。

### 3. 跨项目检查（必须！防止劫持其他项目）
```bash
# crossborder-ai 必须不被影响
curl -s -k -o /dev/null -w "%{http_code}" "https://47.116.138.61/health"
curl -s -k -X POST "https://47.116.138.61/api/v1/agent/run" -H "Content-Type: application/json" -d '{}' -o /dev/null -w "%{http_code}"

# 判断标准：crossborder-ai 的 /api/ 返回 JSON 或 401/404（合理错误码）
# 绝不能返回 i面试 的 HTML 页面
```

### 4. 重定向链检查
- 不能出现无限循环
- 最终状态码必须 200
- 308 → 301 → ... → 200 是正常的（HTTP→HTTPS + 尾部斜杠）

### 5. 密钥安全检查
```bash
# 确认没有密钥进入 git
git ls-files | grep -E "\.env$|ecosystem"
# 必须无输出
```

## 禁止事项

- ❌ 改完不测就告诉用户"好了"
- ❌ 只验证自己改的项目，忽略其他共享项目
- ❌ 改 Nginx 不检查其他项目的路由
- ❌ 忽略重定向循环
- ❌ 把密钥写进代码/配置文件提交 git
- ❌ 改动前不先确认方案

## 测试清单

| 时机 | 测试 | 通过条件 |
|------|------|---------|
| 每次改动后 | `bash tests/api-test.sh` | 14/14 ✅ |
| 部署后 | 生产环境 curl 验证 | 全部 200 ✅ |
| 路由/路径改动后 | 跨项目检查 | 其他项目不被劫持 ✅ |
| 页面改动后 | HTML 渲染检查 | 有 `<!DOCTYPE html>` ✅ |
| 任何提交前 | 密钥扫描 | git 无密钥文件 ✅ |
