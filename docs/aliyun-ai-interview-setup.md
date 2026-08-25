# 阿里云 AI 面试 —— 开通清单（P0，用户操作）

> 目标：为「AI 视频面试」准备阿里云资源。本清单完成后，把以下值填到服务器 `.env`：
> `IMS_ACCESS_KEY_ID` / `IMS_ACCESS_KEY_SECRET` / `IMS_AGENT_ID` / `IMS_APP_ID`

## 前置

1. 注册阿里云账号（[aliyun.com](https://www.aliyun.com)）并完成**实名认证**（个人实名即可）

## 步骤

### 1. 开通智能媒体服务（IMS）+ AI 实时互动

> ⚠️ 「AI 实时互动」不是独立产品，控制台首页**搜索框搜不到**。正确入口：

1. 控制台顶部搜索框搜 **「智能媒体服务」** → 点进产品控制台
2. 右上角地域选 **华东2（上海）**（或华北2，以控制台可开通项为准）
3. 左侧导航栏 → **智能生产制作** → **AI 实时互动**（首次需先点「开通服务」，开通后入口才出现）
4. 对照官方快速入门逐步操作：
   - 音视频通话：<https://help.aliyun.com/zh/ims/user-guide/create-agents-for-audio-and-video-calls>
   - 消息对话：<https://help.aliyun.com/zh/ims/user-guide/create-agents-for-messaging-conversations>

### 2. 创建 RAM 子用户 + AccessKey（安全，别用主账号 Key）

- 控制台 → 搜索「RAM 访问控制」→ 用户 → 创建用户（勾选 OpenAPI 调用访问 → 生成 AccessKey）
- 授权：给该子用户授予 **IMS 相关权限**（`AliyunIMSPermission` / 或 `AliyunIQSServiceRole`，以控制台实际策略名为准）
- 保存 `AccessKey ID` / `AccessKey Secret`（只显示一次）

### 3. 创建 AI 面试智能体（Agent）

- 智能媒体服务控制台 → 左侧导航栏 **智能生产制作 → AI 实时互动** → 工作流管理（创建工作流模板）/ 智能体管理（创建智能体）
- 配置节点：
  - **STT**（语音转文字）：选系统预置 ASR（中英混合）或 Qwen3-ASR-Realtime
  - **LLM**（面试官大脑）：
    - 预置**千问**（免费），人设写面试官角色（我们会在启动时传入岗位/候选人提示词）
    - 或接 **DeepSeek**（OpenAI 规范，自研接入）：填 `https://api.deepseek.com/v1` + DeepSeek API Key
  - **TTS**（面试官声音）：选一个中文音色
  - 通话类型（P1）：**纯语音**；P2 再加**视频通话/数字人节点**
- 创建后记录 **AgentId / 工作流模板 ID**

### 4. 拿 ARTC AppId（前端通话拉流用）

- 控制台 → 搜索「实时音视频 ARTC」→ 创建应用 → 记录 **AppId**
- P1 纯语音通话需要；P2 视频/数字人同样需要

### 5. 填入服务器 `.env`

```env
IMS_ACCESS_KEY_ID=你的AccessKeyId
IMS_ACCESS_KEY_SECRET=你的AccessKeySecret
IMS_AGENT_ID=你的AgentId
IMS_APP_ID=你的ARTC AppId
IMS_REGION=cn-shanghai
```

> 未配置这些环境变量时，系统自动降级为现有文字模拟面试（C4 优雅降级），线上不受影响。

## 完成后

把上面的值发我（或自己填到服务器 `.env`），我完成 P1 的真实 SDK 接线：会话创建 → 候选人通话 → 结束取转写 → 评估报告。
