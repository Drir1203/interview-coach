// 智能输入组件：van-field + 热门选项 chips（点选填充，仍可手动输入）
Component({
  properties: {
    label: { type: String, value: "" },
    value: { type: String, value: "" },
    placeholder: { type: String, value: "" },
    suggestions: { type: Array, value: [] },
  },

  methods: {
    onInput(e) {
      this.triggerEvent("input", e.detail)
    },
    pickSuggestion(e) {
      const v = e.currentTarget.dataset.value
      if (v === undefined) return
      this.triggerEvent("input", v)
    },
  },
})
