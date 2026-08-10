# P0 行为 Bug 修复 —— coach 会话碎片 + applications 策略串卡

> 目标：修复小程序两个影响真实数据/正确性的行为 bug。
> 本轮只动 `miniprogram/pages/coach/` + `miniprogram/pages/applications/` + `miniprogram/utils/api.js` + `miniprogram/utils/util.js` + 单测。不改 Web / 后端。

## 背景事实（已核实）

- 后端 `POST /api/coach` 返回 `{ reply, conversationId }`；传入 `conversationId` 则续聊同一会话（校验归属），否则 `create` 新对话。
- 小程序 `api.coachChat(messages)` 只传 `messages`，不传/不保存 `conversationId` → **每次发消息服务端都新建对话**，N 条消息拆成 N 个碎片，污染 Web 端历史列表（同 userId 数据互通），且无法续聊。
- 小程序 applications 页 `strategyBlocks` 是**全局单字段**：生成 A 卡策略后展开 B 卡，B 直接显示 A 的策略内容（串卡 bug）；`toggleExpand` 不清空它。

---

## 能力点

### F1 coach 会话持久化（续聊复用 conversationId）

**Requirement**：同一会话内的多次发消息复用同一 `conversationId`，服务端不重复建对话。

**Scenario**：
- Given 会话尚未创建（`conversationId` 为空）
- When 发送第一条消息
- Then `POST /api/coach` 不带 `conversationId`；响应返回 `conversationId` 后保存
- Given 会话已创建
- When 后续发送消息
- Then `POST /api/coach` 带上已保存的 `conversationId`，服务端续写同一会话
- Given 请求失败
- Then 保留当前 `conversationId` 不变，用户重发仍续聊原会话

**验收**：`api.coachChat(messages, conversationId)` 仅在 `conversationId` 非空时透传；页面保存响应 `conversationId`。

### F2 applications 策略按卡隔离

**Requirement**：每张求职卡片独立存储其 AI 策略内容，展开互不串扰。

**Scenario**：
- Given 卡片 A 已生成策略
- When 收起 A、展开未生成的卡片 B
- Then B 显示「暂无策略内容」，不显示 A 的策略
- When 点击 B 的「AI 策略」生成
- Then 仅更新 B 的策略内容，A 的内容保持不变
- Given 同一时间只允许一个生成请求
- When 请求进行中
- Then 其他卡可展开但不触发重复生成（`generatingId` 非空时忽略）

**验收**：策略 blocks 存于各 `application` 项的 `strategyBlocks`（不可变更新）；wxml 按 `item.strategyBlocks` 渲染。

---

## 非目标（明确不做）

- coach 历史对话列表/搜索/重命名/删除/附件（P1 后续）
- applications 备注/日期/状态筛选 Tabs（P1 后续）
- Web 端任何改动、后端任何改动

## 测试计划

- **纯函数**：
  - `api.coachChat(messages, conversationId)` — 透传 `conversationId`，为空时不带（`miniprogram/utils/api.test.js` 扩展）
  - `util.storeStrategy(apps, id, blocks)` — 不可变更新匹配项的 `strategyBlocks`；无匹配返回原样；非法输入返回 `[]`（`miniprogram/utils/util.test.js` 扩展）
- **UI 胶水层**（coach.js/applications.js/wxml 状态管理）豁免单测，理由：状态收敛于上述纯函数，页面仅接线。
- **回归门禁**：不动 Web/后端，以 vitest 为门禁。
