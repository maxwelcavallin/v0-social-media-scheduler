"use client"

import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarDays, X } from "lucide-react"
import Link from "next/link"

interface Post {
  id: string
  content: string
  status: string
  scheduled_at: string | null
  created_at: string
  workspace_name: string
  post_types: string[]
  accounts: { name: string; username: string }[]
}

interface Props {
  posts: Post[]
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Rascunho", variant: "outline" },
  scheduled: { label: "Agendado", variant: "secondary" },
  published: { label: "Publicado", variant: "default" },
  failed: { label: "Falhou", variant: "destructive" },
}

function toLocalDateString(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function RecentPostsFilter({ posts }: Props) {
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [open, setOpen] = useState(false)

  const hasFilter = dateFrom !== "" || dateTo !== ""

  const filtered = useMemo(() => {
    if (!hasFilter) return posts
    return posts.filter((post) => {
      const ref = post.scheduled_at || post.created_at
      if (!ref) return true
      const d = toLocalDateString(new Date(ref))
      if (dateFrom && d < dateFrom) return false
      if (dateTo && d > dateTo) return false
      return true
    })
  }, [posts, dateFrom, dateTo, hasFilter])

  const clearFilter = () => { setDateFrom(""); setDateTo("") }

  const rangeLabel = () => {
    if (!dateFrom && !dateTo) return "Filtrar por data"
    const fmt = (s: string) => s ? new Date(s + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "..."
    return `${fmt(dateFrom)} – ${fmt(dateTo)}`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Posts Recentes</h2>
        <div className="flex items-center gap-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`gap-2 h-8 text-xs ${hasFilter ? "border-primary text-primary" : "text-muted-foreground"}`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                {rangeLabel()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4" align="end">
              <p className="text-sm font-medium mb-3">Intervalo de datas</p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">De</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">Até</label>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="flex justify-between pt-1">
                  <Button variant="ghost" size="sm" className="text-xs h-8" onClick={clearFilter} disabled={!hasFilter}>
                    Limpar
                  </Button>
                  <Button size="sm" className="text-xs h-8" onClick={() => setOpen(false)}>
                    Aplicar
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {hasFilter && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground" onClick={clearFilter}>
              <X className="w-3.5 h-3.5" />
            </Button>
          )}

          <Link href="/dashboard/posts">
            <Button variant="ghost" size="sm" className="text-xs h-8">Ver todos</Button>
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhum post encontrado para o intervalo selecionado.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filtered.map((post) => {
                const status = statusMap[post.status] || { label: post.status, variant: "outline" as const }
                const isStory = (post.post_types || []).includes("story")
                const accs = Array.isArray(post.accounts) ? post.accounts : []
                const names = accs.map((a) => a.username ? `@${a.username}` : a.name).filter(Boolean)
                return (
                  <div key={post.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate max-w-xs">
                        {isStory ? "Story" : (post.content || "Sem legenda")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {post.workspace_name}
                        {names.length > 0 && ` · ${names.join(", ")}`}
                        {post.scheduled_at && (
                          <> · {new Date(post.scheduled_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</>
                        )}
                      </p>
                    </div>
                    <Badge variant={status.variant} className="ml-3 shrink-0 text-xs">
                      {status.label}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
