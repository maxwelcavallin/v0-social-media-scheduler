"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Building2, Plus, ImageIcon, Trash2, Loader2, X } from "lucide-react"
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog"
import { WorkspaceActions } from "@/components/workspace/workspace-actions"

interface Workspace {
  id: string
  name: string
  slug: string
  accounts_count: number
  posts_count: number
}

interface Props {
  workspaces: Workspace[]
  isAdmin: boolean
}

export function WorkspacesGrid({ workspaces, isAdmin }: Props) {
  const router = useRouter()
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelected(new Set())
  }

  const handleBulkDelete = async () => {
    setLoading(true)
    setError(null)
    const res = await fetch("/api/workspaces/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceIds: Array.from(selected) }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || "Erro ao excluir workspaces.")
      setLoading(false)
      return
    }
    setDeleteOpen(false)
    exitSelectMode()
    setLoading(false)
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">Workspaces</h2>
          <span className="text-sm text-muted-foreground">
            {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Controles de seleção múltipla — apenas admins */}
        {isAdmin && workspaces.length > 0 && (
          <div className="flex items-center gap-2">
            {selectMode ? (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  disabled={selected.size === 0}
                  onClick={() => { setError(null); setDeleteOpen(true) }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir{selected.size > 0 ? ` (${selected.size})` : ""}
                </Button>
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={exitSelectMode}>
                  <X className="w-3.5 h-3.5" />
                  Cancelar
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSelectMode(true)}>
                <Trash2 className="w-3.5 h-3.5" />
                Selecionar
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {workspaces.map((ws) => {
          const isSelected = selected.has(ws.id)

          if (selectMode) {
            return (
              <Card
                key={ws.id}
                onClick={() => toggle(ws.id)}
                className={`cursor-pointer h-full relative transition-all ${
                  isSelected ? "border-primary ring-1 ring-primary" : "hover:border-primary/40"
                }`}
              >
                <div className="absolute top-2 right-2 z-10">
                  <Checkbox checked={isSelected} onCheckedChange={() => toggle(ws.id)} />
                </div>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 pr-6">
                      <CardTitle className="text-base truncate">{ws.name}</CardTitle>
                      <CardDescription className="text-xs">@{ws.slug}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      {ws.accounts_count} conta{ws.accounts_count !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      {ws.posts_count} post{ws.posts_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          }

          return (
            <Link key={ws.id} href={`/workspace/${ws.id}`}>
              <Card className="hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer h-full relative group">
                <WorkspaceActions workspace={ws} isAdmin={isAdmin} />
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 pr-6">
                      <CardTitle className="text-base truncate">{ws.name}</CardTitle>
                      <CardDescription className="text-xs">@{ws.slug}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      {ws.accounts_count} conta{ws.accounts_count !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      {ws.posts_count} post{ws.posts_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}

        {!selectMode && (
          <CreateWorkspaceDialog>
            <Card className="border-dashed hover:border-primary/40 cursor-pointer transition-all flex items-center justify-center min-h-[100px]">
              <div className="flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors p-6">
                <Plus className="w-6 h-6" />
                <span className="text-sm font-medium">Novo Workspace</span>
              </div>
            </Card>
          </CreateWorkspaceDialog>
        )}
      </div>

      {/* Diálogo de confirmação da exclusão em massa */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {selected.size} workspace{selected.size !== 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Todos os posts, mídias e vínculos de contas dos workspaces selecionados serão excluídos permanentemente.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Excluir ${selected.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
