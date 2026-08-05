"use client"

// 热门选项快捷点选 chips：单选（岗位/行业）传 selected 为 [当前值]，多选（标签）传 selected 为已选数组
interface OptionChipsProps {
  options: string[]
  selected: string[]
  onPick: (value: string) => void
}

export function OptionChips({ options, selected, onPick }: OptionChipsProps) {
  if (!options.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = selected.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onPick(opt)}
            className={
              "rounded-full border px-2.5 py-0.5 text-xs transition-colors " +
              (active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted")
            }
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}
