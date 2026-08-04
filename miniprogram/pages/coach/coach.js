const api = require("../../utils/api")
const { parseMarkdown } = require("../../utils/markdown")

const WELCOME = "你好，我是你的 AI 面试教练。想聊什么？比如告诉我你最近一次面试的情况。"

function withKeys(blocks) {
  return blocks.map((b, i) => ({ ...b, key: i }))
}

Page({
  data: {
    messages: [],
    input: "",
    waiting: false,
  },

  onLoad() {
    this.setData({
      messages: [
        { id: 0, role: "assistant", content: WELCOME, blocks: withKeys(parseMarkdown(WELCOME)) },
      ],
    })
  },

  onInput(e) {
    this.setData({ input: e.detail.value })
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

    api.coachChat(messages.map((m) => ({ role: m.role, content: m.content })))
      .then((data) => {
        const reply = data.reply
        const updated = this.data.messages.concat([{
          id: this.data.messages.length,
          role: "assistant",
          content: reply,
          blocks: withKeys(parseMarkdown(reply)),
        }])
        this.setData({ messages: updated, waiting: false })
      })
      .catch(() => {
        wx.showToast({ title: "教练暂时开小差了", icon: "none" })
        this.setData({ waiting: false })
      })
  },
})
