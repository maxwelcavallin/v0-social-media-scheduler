"use client"

import { useState, useMemo, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Send, Loader2, Copy, Check, ExternalLink, ImageIcon, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface DraftPost {
  id: string
  content: string | null
  scheduled_at: string | null
  post_type?: string
  media_count?: number
}

interface SendReviewDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  workspaceId: string
  posts: DraftPost[]
}

export function SendReviewDialog({ open, onOpenChange, workspaceId, posts }: SendReviewDialogProps) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ url: string; token: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reseta ao abrir
  useEffect(() => {
    if (open) {
      setQuery("")
      setSelected(new Set())
      setSending(false)
      setResult(null)
      setCopied(false)
      setError(null)
    }
  }, [open])

  const drafts = useMemo(() => posts.filter(p => !p.id || true), [posts])

  const filtered = useMemo(() => {
    if (!query.trim()) return drafts
    const q = query.toLowerCase()
    return drafts.filter(p =>
      (p.content || "").toLowerCase().includes(q)
    )
  }, [drafts, query])

  const allSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id))

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(p => next.delete(p.id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(p => next.add(p.id))
        return next
      })
    }
  }

  async function handleSend() {
    if (selected.size === 0) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch("/api/review-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postIds: Array.from(selected),
          workspaceId,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || "Erro ao criar lote")
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  async function handleCopy() {
    if (!result) return
    await navigator.clipboard.writeText(result.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const preview = (content: string | null) => {
    if (!content) return "Sem legenda"
    return content.length > 80 ? content.slice(0, 80) + "…" : content
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg">
        {!result ? (
          <>
            <DialogHeader>
              <DialogTitle>Enviar para aprovação</DialogTitle>
              <DialogDescription>
                Selecione os rascunhos que deseja enviar para revisão. Um link único será gerado para o aprovador.
              </DialogDescription>
            </DialogHeader>

            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar por legenda..."
                className="pl-8 h-9"
              />
            </div>

            {/* Selecionar todos */}
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                Selecionar todos {query ? `(${filtered.length})` : ""}
              </label>
              <span className="text-xs text-muted-foreground">{selected.size} selecionado(s)</span>
            </div>

            {/* Lista */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <FileText className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {query ? `Nenhum rascunho encontrado para "${query}".` : "Nenhum rascunho disponível para revisão."}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-64">
                <div className="flex flex-col gap-1.5 pr-3">
                  {filtered.map(post => (
                    <label
                      key={post.id}
                      htmlFor={`post-${post.id}`}
                      className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors min-w-0"
                    >
                      <Checkbox
                        id={`post-${post.id}`}
                        checked={selected.has(post.id)}
                        onCheckedChange={() => toggle(post.id)}
                        className="shrink-0 mt-0.5"
                      />
                      {/* Thumbnail ou ícone */}
                      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                        {(post.media_count ?? 0) > 0
                          ? <ImageIcon className="w-5 h-5 text-muted-foreground" />
                          : <FileText className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="text-sm font-medium text-foreground truncate leading-tight">
                          {preview(post.content)}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {post.post_type && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0 capitalize h-4">
                              {post.post_type}
                            </Badge>
                          )}
                          {post.scheduled_at && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(post.scheduled_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
                Cancelar
              </Button>
              <Button onClick={handleSend} disabled={sending || selected.size === 0} className="gap-2">
                {sending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando link...</>
                  : <><Send className="w-4 h-4" /> Gerar link {selected.size > 0 ? `(${selected.size})` : ""}</>}
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* Tela de sucesso com link */
          <>
            <DialogHeader>
              <DialogTitle>Link de revisão gerado</DialogTitle>
              <DialogDescription>
                Compartilhe este link com o aprovador. Ele poderá revisar os {selected.size} post(s) selecionado(s) sem precisar de login.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
                <span className="text-sm text-foreground truncate flex-1 font-mono">{result.url}</span>
                <Button size="sm" variant="ghost" onClick={handleCopy} className="shrink-0 gap-1.5 h-8">
                  {copied ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Os posts selecionados foram marcados como <strong>Em revisão</strong>. O aprovador irá navegar por cada post em sequência.
              </p>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <a href={result.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                  Visualizar revisão
                </a>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
