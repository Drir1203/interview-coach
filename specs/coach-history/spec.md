# coach 历史对话列表（Web → 小程序同步）

> 目标：把 Web 端 coach 的历史对话能力同步到小程序——列表/搜索/打开续聊/新建/重命名/删除。
> 后端 4 接口已就绪（`src/app/api/coach/conversations/*`），本轮只动 `miniprogram/utils/api.js` + `miniprogram/pages/coach/` + 单测。不改 Web / 后端。

## 背景事实（已核实）

- 后端接口：
  - `GET /api/coach/conversations?q=&limit=50` → `[{ id, title, createdAt, updatedAt, messageCount, lastMessage: { role, content, createdAt } | null }]`（按 updatedAt 倒序，q 匹配标题或消息内容）
  - `GET /api/coach/conversations/:id` → `{ id, title, createdAt, updatedAt, messages: [{ role, content, createdAt }] }`（messages 按时间升序）
  - `PUT /api/coach/conversations/:id` body `{ title }` → 重命名（404 若不存在/非本人）
  - `DELETE /api/coach/conversations/:id` → `{ success: true }`（级联删消息）
- 小程序 coach 页现状：单屏聊天，`conversationId` 已保存可续聊（P0 修复），但**无历史入口**，用户无法找回/打开/管理历史对话。
- Web 端参考实现：`src/app/coach/page.tsx`（左侧历史列：搜索框 + 新对话 + 列表项[标题/最后消息摘要/时间] + 悬停重命名/删除）。

---

## 能力点

### C1 历史对话列表（半屏弹层）

**Requirement**：coach 页提供历史入口，可查看并搜索历史对话列表。

**Scenario**：
- Given coach 页打开
- When 点击顶部「历史」按钮
- Then 弹出历史列表（底部半屏），加载 `GET /api/coach/conversations?limit=50`
- Given 列表加载中
- Then 显示 loading
- Given 无历史对话
- Then 显示空态「还没有历史对话」+「开始新对话」按钮
- Given 列表已加载
- When 输入搜索关键词（300ms 防抖）
- Then 以 `q=` 重新请求，展示匹配结果；清空关键词恢复全量
- Then 列表项展示：标题（空则「新对话」）、最后消息摘要（无则「N 条消息」）、更新时间（今天显示 HH:mm，否则 MM-DD）

**验收**：`api.getCoachConversations(q)` 拼接 query；列表渲染 + 搜索 + 空态齐全。

### C2 打开历史对话并续聊

**Requirement**：点击列表项加载该对话全部消息，后续发送在同一会话续聊。

**Scenario**：
- Given 历史列表已加载
- When 点击某对话项
- Then 请求 `GET /api/coach/conversations/:id`，消息区替换为该对话全部消息（升序）
- Then 保存该对话 `conversationId`，后续 `coachChat` 自动带上，服务端续写同一会话
- Given 该对话无消息
- Then 显示欢迎语占位
- Then 弹层关闭，回到聊天界面

**验收**：打开后 `conversationId` 与消息区正确切换；发送即续聊（回归 P0 的持久化逻辑）。

### C3 新对话

**Requirement**：从历史弹层可一键回到全新对话。

**Scenario**：
- Given 当前正在历史对话中
- When 点击「新对话」
- Then `conversationId` 清空、消息区重置为欢迎语、弹层关闭

**验收**：再发送第一条消息时 `coachChat` 不带 `conversationId`（服务端新建）。

### C4 重命名对话

**Requirement**：可修改对话标题。

**Scenario**：
- Given 历史列表项
- When 点击重命名（铅笔）
- Then 弹出标题输入（`wx.showModal` editable，预填当前标题）
- Given 输入新标题并确认
- Then `PUT /api/coach/conversations/:id { title }`；成功后列表刷新
- Given 标题为空
- Then 忽略提交（后端 400）

**验收**：重命名成功刷新列表；若重命名的是当前打开的对话，聊天区标题同步更新。

### C5 删除对话

**Requirement**：可删除历史对话（不可恢复，需确认）。

**Scenario**：
- Given 历史列表项
- When 点击删除
- Then `wx.showModal` 确认「删除后不可恢复」
- Given 确认
- Then `DELETE /api/coach/conversations/:id`；成功后列表移除该项
- Given 删除的是当前打开的对话
- Then 消息区重置为新对话态

**验收**：删除后列表刷新；当前对话被删则回新对话态。

### C6 列表与当前对话联动刷新

**Requirement**：发送消息/重命名/删除后，历史列表反映最新状态。

**Scenario**：
- Given 已发送新消息（当前对话新建或续聊）
- When 再次打开历史弹层
- Then 列表按 `updatedAt` 倒序刷新，包含本次会话的最新 lastMessage/时间
- Given 从列表新开对话
- Then 弹层打开时保持列表为最新加载结果（不重复全量请求）

**验收**：打开弹层时总是重新请求列表（保证最新）；消息区发送后不阻塞弹层数据。

---

## 非目标（明确不做）

- 附件选择/粘贴（P2）
- 未登录误报「开小差」排查（本轮顺带评估，不保证修复）
- Web 端任何改动、后端任何改动
- 对话内的消息编辑/撤回

## 测试计划

- **纯函数**：
  - `api.getCoachConversations(q)` — 无 q 时不带 query；有 q 时拼 `?q=`（encodeURIComponent）（`miniprogram/utils/api.test.js` 扩展）
  - `api.getCoachConversation(id)` / `renameCoachConversation(id, title)` / `deleteCoachConversation(id)` — URL、method、body 正确（`api.test.js` 扩展）
  - `util.chatTimeLabel(iso)` — 今天返回 HH:mm，非今天返回 MM-DD HH:mm，空串/非法返回 ""（`miniprogram/utils/util.test.js` 扩展）
- **UI 胶水层**（coach.js/wxml/popup 状态）豁免单测，理由：状态收敛于上述纯函数，页面仅接线。
- **回归门禁**：不动 Web/后端，以 vitest 为门禁。
