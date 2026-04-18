"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react"

interface Workspace {
  id: string
  name: string
  slug: string
}

interface Props {
  workspace: Workspace
}

export function WorkspaceActions({ workspace }: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(workspace.name)
  const [slug, setSlug] = useState(workspace.slug)
  const [confirmName, setConfirmName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEdit = async () => {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/workspaces/${workspace.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug }),
    })
    if (!res.ok) {
      const body = await res.json()
      setError(body.error || "Erro ao salvar.")
    } else {
      setEditOpen(false)
      router.refresh()
    }
    setLoading(false)
  }

  const handleDelete = async () => {
    setLoading(true)
    const res = await fetch(`/api/workspaces/${workspace.id}`, { method: "DELETE" })
    if (!res.ok) {
      setError("Erro ao excluir workspace.")
      setLoading(false)
      return
    }
    router.refresh()
    setDeleteOpen(false)
    setLoading(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            className="gap-2"
            onClick={(e) => { e.preventDefault(); setName(workspace.name); setSlug(workspace.slug); setError(null); setEditOpen(true) }}
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-destructive focus:text-destructive"
            onClick={(e) => { e.preventDefault(); setConfirmName(""); setError(null); setDeleteOpen(true) }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar workspace</DialogTitle>
            <DialogDescription>Atualize o nome e identificador do workspace.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-name">Nome</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-slug">Identificador (slug)</Label>
              <Input id="edit-slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
              <p className="text-xs text-muted-foreground">Apenas letras minúsculas, números e hífens.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={loading}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={loading || !name || !slug}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir workspace</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Todos os posts, mídias e contas conectadas deste workspace serão excluídos permanentemente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-sm text-muted-foreground">
              Digite <span className="font-semibold text-foreground">{workspace.name}</span> para confirmar:
            </p>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={workspace.name}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={loading}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading || confirmName !== workspace.name}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Excluir workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
