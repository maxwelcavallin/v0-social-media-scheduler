"use client"

import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"

type QueueLog = {
  id: string
  created_at: string
  level: "info" | "error" | "warn"
  post_id: string | null
  queue_id: string | null
  platform: string | null
  message: string
  details: Record<string, unknown> | null
}

const LEVEL_COLORS: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  warn: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  error: "bg-destructive/10 text-destructive border-destructive/20",
}

const PLATFORM_COLORS: Record<string, string> = {
  facebook: "bg-blue-600/10 text-blue-600 border-blue-600/20",
  instagram: "bg-pink-500/10 text-pink-600 border-pink-500/20",
}

export function QueueLogsView({ logs }: { logs: QueueLog[] }) {
  const [search, setSearch] = useState("")
  const [levelFilter, setLevelFilter] = useState<string>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        !search ||
        log.message.toLowerCase().includes(search.toLowerCase()) ||
        log.post_id?.includes(search) ||
        log.platform?.includes(search)
      const matchesLevel = levelFilter === "all" || log.level === levelFilter
      return matchesSearch && matchesLevel
    })
  }, [logs, search, levelFilter])

  const errorCount = logs.filter((l) => l.level === "error").length
  const warnCount = logs.filter((l) => l.level === "warn").length

  return (
    <div className="flex flex-col gap-4">
      {/* Resumo */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold">{logs.length}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm">
          <span className="text-destructive font-medium">Erros</span>
          <span className="font-semibold text-destructive">{errorCount}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm">
          <span className="text-yellow-600 font-medium">Avisos</span>
          <span className="font-semibold text-yellow-600">{warnCount}</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Buscar por mensagem, post_id ou plataforma..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Nível" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Aviso</SelectItem>
            <SelectItem value="error">Erro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela de logs */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            Nenhum log encontrado.
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((log) => (
              <div key={log.id} className="flex flex-col">
                <button
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  className="flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors w-full"
                >
                  {/* Timestamp */}
                  <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5 w-28 shrink-0">
                    {formatDistanceToNow(new Date(log.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>

                  {/* Level badge */}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border shrink-0 ${LEVEL_COLORS[log.level] ?? ""}`}>
                    {log.level}
                  </span>

                  {/* Platform badge */}
                  {log.platform && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border shrink-0 ${PLATFORM_COLORS[log.platform] ?? "bg-muted text-muted-foreground"}`}>
                      {log.platform}
                    </span>
                  )}

                  {/* Message */}
                  <span className="text-sm text-foreground flex-1 min-w-0 break-words">{log.message}</span>

                  {/* Post ID pill */}
                  {log.post_id && (
                    <span className="text-xs text-muted-foreground font-mono shrink-0 hidden md:block">
                      {log.post_id.slice(0, 8)}
                    </span>
                  )}

                  {/* Expand indicator */}
                  {(log.details || log.post_id || log.queue_id) && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {expandedId === log.id ? "▲" : "▼"}
                    </span>
                  )}
                </button>

                {/* Detalhes expandidos */}
                {expandedId === log.id && (
                  <div className="px-4 pb-4 bg-muted/30 text-xs font-mono space-y-1 border-t">
                    {log.post_id && (
                      <div className="flex gap-2 pt-3">
                        <span className="text-muted-foreground w-20 shrink-0">post_id</span>
                        <span className="text-foreground break-all">{log.post_id}</span>
                      </div>
                    )}
                    {log.queue_id && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-20 shrink-0">queue_id</span>
                        <span className="text-foreground break-all">{log.queue_id}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-20 shrink-0">timestamp</span>
                      <span className="text-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    {log.details && (
                      <div className="mt-2">
                        <span className="text-muted-foreground block mb-1">details</span>
                        <pre className="text-foreground bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
