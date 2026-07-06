"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Instagram, Facebook, ListPlus, Loader2, CheckCircle2, Search } from "lucide-react"

interface PoolAccount {
  id: string
  platform: "facebook" | "instagram"
  externalId: string
  pageId: string | null
  name: string | null
  username: string | null
  pictureUrl: string | null
  source: "facebook" | "instagram_direct"
  linked: boolean
}

interface Props {
  workspaceId: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function PageSelectorDialog({ workspaceId }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useSWR<{ accounts: PoolAccount[] }>(
    open ? `/api/social/meta/catalog?workspaceId=${encodeURIComponent(workspaceId)}` : null,
    fetcher,
  )

  const accounts = data?.accounts ?? []

  // Pré-marca as contas já vinculadas ao workspace quando os dados chegam
  useEffect(() => {
    if (accounts.length > 0) {
      setSelected(new Set(accounts.filter((a) => a.linked).map((a) => a.id)))
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter(
      (a) =>
        (a.name || "").toLowerCase().includes(q) ||
        (a.username || "").toLowerCase().includes(q),
    )
  }, [accounts, query])

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id))

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev)
      const everySelected = filtered.every((a) => next.has(a.id))
      if (everySelected) {
        filtered.forEach((a) => next.delete(a.id))
      } else {
        filtered.forEach((a) => next.add(a.id))
      }
      return next
    })
  }, [filtered])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/social/meta/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, accountIds: Array.from(selected) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Falha ao vincular contas")
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
          Adicionar contas
        </Button>
      </DialogTrigger>
      {/* max-w-lg garante espaço para nomes longos sem esticar além de 512px */}
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar contas a este workspace</DialogTitle>
          <DialogDescription>
            Escolha quais contas da empresa deseja usar aqui. Para conectar novas contas, vá em{" "}
            <strong>Visão Geral</strong>.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Facebook className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Nenhuma conta disponível. Conecte uma conta na <strong>Visão Geral</strong> primeiro.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 min-w-0">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar contas..."
                className="pl-8 h-9"
              />
            </div>

            {/* Linha selecionar todas */}
            <div className="flex items-center justify-between px-1 py-0.5">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAll} />
                Selecionar todas {query ? `(${filtered.length})` : ""}
              </label>
              <span className="text-xs text-muted-foreground shrink-0">{selected.size} selecionada(s)</span>
            </div>

            {/* Lista com scroll limitado */}
            <ScrollArea className="h-64">
              <div className="flex flex-col gap-1.5 pr-3">
                {filtered.map((acc) => (
                  <label
                    key={acc.id}
                    htmlFor={`acc-${acc.id}`}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors min-w-0"
                  >
                    <Checkbox
                      id={`acc-${acc.id}`}
                      checked={selected.has(acc.id)}
                      onCheckedChange={() => toggle(acc.id)}
                      className="shrink-0"
                    />
                    <Avatar className="w-9 h-9 shrink-0">
                      <AvatarImage src={acc.pictureUrl || undefined} alt={acc.name || "Conta"} />
                      <AvatarFallback
                        className={acc.platform === "facebook" ? "bg-blue-100 dark:bg-blue-950/30" : "bg-pink-100 dark:bg-pink-950/30"}
                      >
                        {acc.platform === "facebook" ? (
                          <Facebook className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Instagram className="w-4 h-4" style={{ color: "#C13584" }} />
                        )}
                      </AvatarFallback>
                    </Avatar>

                    {/* Texto: ocupa o espaço disponível e trunca */}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="text-sm font-medium text-foreground truncate leading-tight">
                        {acc.name || acc.username || "Conta sem nome"}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground truncate mt-0.5">
                        {acc.platform === "facebook" ? (
                          <>
                            <Facebook className="w-3 h-3 text-blue-600 shrink-0" />
                            <span className="truncate">Facebook</span>
                          </>
                        ) : (
                          <>
                            <Instagram className="w-3 h-3 shrink-0" style={{ color: "#C13584" }} />
                            <span className="truncate">
                              {acc.username ? `@${acc.username}` : "Instagram"}
                              {acc.source === "instagram_direct" ? " · direto" : " · via Facebook"}
                            </span>
                          </>
                        )}
                      </p>
                    </div>

                    {acc.linked && (
                      <Badge variant="outline" className="gap-1 text-xs shrink-0 ml-auto">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Vinculada
                      </Badge>
                    )}
                  </label>
                ))}
                {filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nenhuma conta encontrada para &quot;{query}&quot;.
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || selected.size === 0} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Vincular {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
