const api = require("../../utils/api")
const { parseMarkdown } = require("../../utils/markdown")
const { chatTimeLabel } = require("../../utils/util")

const WELCOME = "你好，我是你的 AI 面试教练。想聊什么？比如告诉我你最近一次面试的情况。"

function withKeys(blocks) {
  return blocks.map((b, i) => ({ ...b, key: i }))
}

// 历史列表项展示装饰：标题（空→新对话）/ 摘要（无或空→N 条消息）/ 时间 / 是否当前对话
function decorateConversation(c, currentId) {
  const raw = c.lastMessage ? (c.lastMessage.content || "").trim() : ""
  const summary = raw
    ? raw.replace(/\s+/g, " ").slice(0, 40)
    : `${c.messageCount} 条消息`
  return {
    ...c,
    titleText: c.title || "新对话",
    summaryText: summary,
    timeText: chatTimeLabel(c.updatedAt),
    isCurrent: c.id === currentId,
  }
}

function welcomeMsg() {
  return { id: 0, role: "assistant", content: WELCOME, blocks: withKeys(parseMarkdown(WELCOME)) }
}

Page({
  data: {
    messages: [],
    input: "",
    waiting: false,
    conversationId: "",
    currentTitle: "",
    // 历史对话弹层
    showHistory: false,
    historyLoading: false,
    historyList: [],
    historySearch: "",
  },

  onLoad() {
    this.setData({ messages: [welcomeMsg()] })
  },

  onUnload() {
    if (this._searchTimer) clearTimeout(this._searchTimer)
  },

  onInput(e) {
    this.setData({ input: e.detail })
  },

  // ===== 历史对话弹层 =====
  openHistory() {
    this.setData({ showHistory: true, historySearch: "" })
    this.loadConversations("")
  },

  closeHistory() {
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this.setData({ showHistory: false })
  },

  // 加载列表；打开弹层时总是重新请求，保证列表最新（C6）
  loadConversations(q) {
    this.setData({ historyLoading: true })
    api.getCoachConversations(q)
      .then((list) => {
        const currentId = this.data.conversationId
        this.setData({ historyList: (list || []).map((c) => decorateConversation(c, currentId)) })
      })
      .catch(() => {
        wx.showToast({ title: "加载历史对话失败", icon: "none" })
      })
      .then(() => this.setData({ historyLoading: false }))
  },

  // 搜索防抖 300ms
  onHistorySearch(e) {
    const value = e.detail || ""
    this.setData({ historySearch: value })
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(() => {
      this._searchTimer = null
      this.loadConversations(value.trim())
    }, 300)
  },

  // 打开历史对话并续聊（C2）
  openConversation(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    api.getCoachConversation(id)
      .then((data) => {
        const msgs = (data.messages || []).map((m, i) => ({
          id: i,
          role: m.role,
          content: m.content,
          blocks: withKeys(parseMarkdown(m.content)),
        }))
        this.setData({
          conversationId: data.id,
          currentTitle: data.title || "新对话",
          messages: msgs.length > 0 ? msgs : [welcomeMsg()],
          showHistory: false,
        })
      })
      .catch(() => {
        wx.showToast({ title: "加载对话失败", icon: "none" })
      })
  },

  // 新对话（C3）
  startNewConversation() {
    this.setData({
      conversationId: "",
      currentTitle: "",
      messages: [welcomeMsg()],
      showHistory: false,
    })
  },

  // 重命名（C4）
  renameConversation(e) {
    const id = e.currentTarget.dataset.id
    const title = e.currentTarget.dataset.title || ""
    wx.showModal({
      title: "重命名对话",
      editable: true,
      placeholderText: "对话标题",
      content: title,
      success: (res) => {
        if (!res.confirm) return
        const newTitle = (res.content || "").trim()
        if (!newTitle) return // 空标题忽略提交（后端 400）
        api.renameCoachConversation(id, newTitle)
          .then(() => {
            wx.showToast({ title: "已重命名", icon: "success" })
            if (id === this.data.conversationId) {
              this.setData({ currentTitle: newTitle })
            }
            this.loadConversations(this.data.historySearch.trim())
          })
          .catch(() => wx.showToast({ title: "重命名失败", icon: "none" }))
      },
    })
  },

  // 删除（C5）
  deleteConversation(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: "删除对话",
      content: "删除后不可恢复，确定删除？",
      confirmColor: "#ef4444",
      success: (res) => {
        if (!res.confirm) return
        api.deleteCoachConversation(id)
          .then(() => {
            wx.showToast({ title: "已删除", icon: "success" })
            if (id === this.data.conversationId) {
              this.setData({
                conversationId: "",
                currentTitle: "",
                messages: [welcomeMsg()],
              })
            }
            this.loadConversations(this.data.historySearch.trim())
          })
          .catch(() => wx.showToast({ title: "删除失败", icon: "none" }))
      },
    })
  },

  handleSend() {
    const text = this.data.input.trim()
    if (!text || this.data.waiting) return

    const userMsg = {
      id: this.data.messages.length,
      role: "user",
      content: text,
      blocks: withKeys([{ type: "p", text }]),
    }
    const messages = this.data.messages.concat([userMsg])
    this.setData({ messages, input: "", waiting: true })

    api.coachChat(
      messages.map((m) => ({ role: m.role, content: m.content })),
      this.data.conversationId
    )
      .then((data) => {
        const reply = data.reply
        const updated = this.data.messages.concat([{
          id: this.data.messages.length,
          role: "assistant",
          content: reply,
          blocks: withKeys(parseMarkdown(reply)),
        }])
        const patch = { messages: updated, waiting: false }
        if (data.conversationId) patch.conversationId = data.conversationId
        this.setData(patch)
      })
      .catch(() => {
        wx.showToast({ title: "教练暂时开小差了", icon: "none" })
        this.setData({ waiting: false })
      })
  },
})
