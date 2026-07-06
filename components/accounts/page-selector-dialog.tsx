"use client"

import { useState, useEffect, useCallback } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Instagram, Facebook, ListPlus, Loader2, CheckCircle2 } from "lucide-react"

interface CatalogPage {
  pageId: string
  pageName: string | null
  pictureUrl: string | null
  igUsername: string | null
  igName: string | null
  igProfilePictureUrl: string | null
  hasInstagram: boolean
  linked: boolean
}

interface Props {
  workspaceId: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function PageSelectorDialog({ workspaceId }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading, mutate } = useSWR<{ pages: CatalogPage[] }>(
    open ? `/api/social/meta/catalog?workspaceId=${encodeURIComponent(workspaceId)}` : null,
    fetcher,
  )

  const pages = data?.pages ?? []

  // Pré-marca as páginas já vinculadas ao workspace quando os dados chegam
  useEffect(() => {
    if (pages.length > 0) {
      setSelected(new Set(pages.filter((p) => p.linked).map((p) => p.pageId)))
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback((pageId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(pageId)) next.delete(pageId)
      else next.add(pageId)
      return next
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/social/meta/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, pageIds: Array.from(selected) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Falha ao vincular páginas")
      setOpen(false)
      window.location.reload()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ListPlus className="w-4 h-4" />
          Adicionar páginas
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar páginas a este workspace</DialogTitle>
          <DialogDescription>
            Escolha quais páginas já conectadas na sua conta do Facebook deseja usar aqui. Nenhuma nova
            autorização é necessária.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : pages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Facebook className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Nenhuma página disponível. Conecte sua conta do Facebook primeiro (botão
              <strong> Conectar via Facebook</strong>), mantendo todas as páginas marcadas.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-80 pr-3 -mr-3">
            <div className="flex flex-col gap-1.5">
              {pages.map((page) => (
                <label
                  key={page.pageId}
                  htmlFor={`page-${page.pageId}`}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={`page-${page.pageId}`}
                    checked={selected.has(page.pageId)}
                    onCheckedChange={() => toggle(page.pageId)}
                  />
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarImage src={page.pictureUrl || undefined} alt={page.pageName || "Página"} />
                    <AvatarFallback className="bg-blue-100 dark:bg-blue-950/30">
                      <Facebook className="w-4 h-4 text-blue-600" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {page.pageName || "Página sem nome"}
                    </p>
                    {page.hasInstagram && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                        <Instagram className="w-3 h-3" style={{ color: "#C13584" }} />
                        {page.igUsername ? `@${page.igUsername}` : "Instagram vinculado"}
                      </span>
                    )}
                  </div>
                  {page.linked && (
                    <Badge variant="outline" className="gap-1 text-xs shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      Vinculada
                    </Badge>
                  )}
                </label>
              ))}
            </div>
          </ScrollArea>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || selected.size === 0}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Vincular {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
