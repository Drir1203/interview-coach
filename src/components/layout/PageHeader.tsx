import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  className?: string
}

/**
 * 统一页头：品牌色图标块 + 标题 + 副标题。
 * 风格对齐总览页头部（text-2xl font-bold tracking-tight + text-sm text-muted-foreground）。
 */
export function PageHeader({ icon: Icon, title, description, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {Icon && (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="size-5 text-primary" />
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}
