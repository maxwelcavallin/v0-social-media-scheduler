"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

const filters = [
  { label: "Todos", value: null },
  { label: "Rascunho", value: "draft" },
  { label: "Em revisão", value: "in_review" },
  { label: "Aprovado", value: "approved" },
  { label: "Ajustar", value: "needs_changes" },
  { label: "Agendado", value: "scheduled" },
  { label: "Publicado", value: "published" },
  { label: "Falhou", value: "failed" },
]

const colorMap: Record<string, string> = {
  in_review: "data-[active=true]:border-blue-400 data-[active=true]:text-blue-600 data-[active=true]:bg-blue-50 dark:data-[active=true]:bg-blue-900/20 dark:data-[active=true]:text-blue-400",
  approved: "data-[active=true]:border-green-500 data-[active=true]:text-green-600 data-[active=true]:bg-green-50 dark:data-[active=true]:bg-green-900/20 dark:data-[active=true]:text-green-400",
  needs_changes: "data-[active=true]:border-amber-500 data-[active=true]:text-amber-600 data-[active=true]:bg-amber-50 dark:data-[active=true]:bg-amber-900/20 dark:data-[active=true]:text-amber-400",
  failed: "data-[active=true]:border-destructive data-[active=true]:text-destructive data-[active=true]:bg-destructive/5",
}

export function StatusFilter({ current }: { current: string | null | undefined }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setFilter = (value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set("status", value)
    else params.delete("status")
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((f) => {
        const isActive = (f.value === null && !current) || f.value === current
        const colorClass = f.value ? colorMap[f.value] : undefined
        return (
          <button
            key={f.value ?? "all"}
            data-active={isActive}
            onClick={() => setFilter(f.value)}
            className={cn(
              "px-3 py-1 rounded-full text-sm border transition-colors",
              "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              "data-[active=true]:border-primary data-[active=true]:text-primary data-[active=true]:bg-primary/5",
              colorClass
            )}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}
