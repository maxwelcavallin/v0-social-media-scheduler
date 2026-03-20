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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Pencil, Trash2, CalendarX, Loader2, Send, CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import { CreatePostDialog } from "@/components/posts/create-post-dialog"

interface Account {
  id: string
  platform: string
  account_name: string
  account_username?: string
  profile_picture_url?: string
}

interface Props {
  post: {
    id: string
    content: string
    status: string
    scheduled_at?: string
    post_type?: string
    accountIds?: string[]
    media?: { url: string; media_type: string }[]
    cover_url?: string
  }
  workspaceId: string
  accounts: Account[]
  className?: string
}

const toBrasiliaLocal = (isoString: string): string => {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  })
  return fmt.format(new Date(isoString)).replace(" ", "T")
}

export function PostActions({ post, workspaceId, accounts, className }: Props) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editContent, setEditContent] = useState(post.content || "")
  const [editScheduledAt, setEditScheduledAt] = useState(
    post.scheduled_at ? toBrasiliaLocal(post.scheduled_at) : ""
  )

  const isScheduled = post.status === "scheduled"
  const isPublished = post.status === "published"
  const isDraft = post.status === "draft"

  const [publishDraftOpen, setPublishDraftOpen] = useState(false)
  const [scheduleDraftOpen, setScheduleDraftOpen] = useState(false)
  const [draftScheduledAt, setDraftScheduledAt] = useState("")

  const handlePublishDraft = async () => {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/posts/${post.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleType: "now" }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error || "Erro ao publicar"); return }
    setPublishDraftOpen(false)
    router.refresh()
  }

  const handleScheduleDraft = async () => {
    if (!draftScheduledAt) { setError("Selecione uma data e hora"); return }
    setLoading(true)
    setError(null)
    const hasTz = /[Z+\-]\d{2}:\d{2}$/.test(draftScheduledAt) || draftScheduledAt.endsWith("Z")
    const scheduledAtUTC = hasTz ? draftScheduledAt : `${draftScheduledAt}-03:00`
    const res = await fetch(`/api/posts/${post.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleType: "scheduled", scheduledAt: scheduledAtUTC }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error || "Erro ao agendar"); return }
    setScheduleDraftOpen(false)
    router.refresh()
  }

  const minDate = new Date()
  minDate.setMinutes(minDate.getMinutes() + 5)
  const minDateStr = toBrasiliaLocal(minDate)

  const handleDelete = async () => {
    setLoading(true)
    const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" })
    setLoading(false)
    if (res.ok) {
      setDeleteOpen(false)
      router.refresh()
    }
  }

  const handleCancel = async () => {
    setLoading(true)
    const res = await fetch(`/api/posts/${post.id}`, { method: "PUT" })
    setLoading(false)
    if (res.ok) {
      setCancelOpen(false)
      router.refresh()
    }
  }

  const handleEdit = async () => {
    setLoading(true)
    setError(null)
    const hasTz = /[Z+\-]\d{2}:\d{2}$/.test(editScheduledAt) || editScheduledAt.endsWith("Z")
    const scheduledAtUTC = editScheduledAt
      ? hasTz ? editScheduledAt : `${editScheduledAt}-03:00`
      : null

    const res = await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: editContent,
        scheduledAt: scheduledAtUTC,
        postType: post.post_type || "feed",
      }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(json.error || "Erro ao salvar")
      return
    }
    setEditOpen(false)
    router.refresh()
  }

  if (isPublished && !isDraft) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("w-8 h-8", className)}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {isDraft ? (
            <>
              <DropdownMenuItem onClick={() => setPublishDraftOpen(true)}>
                <Send className="w-4 h-4 mr-2" />
                Publicar agora
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setScheduleDraftOpen(true)}>
                <CalendarDays className="w-4 h-4 mr-2" />
                Agendar publicação
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="w-4 h-4 mr-2" />
                Editar rascunho
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar
            </DropdownMenuItem>
          )}
          {isScheduled && (
            <DropdownMenuItem onClick={() => setCancelOpen(true)}>
              <CalendarX className="w-4 h-4 mr-2" />
              Cancelar agendamento
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir post?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O post será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel schedule */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O post voltará para rascunho e não será publicado automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancelar agendamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Publish draft now */}
      <AlertDialog open={publishDraftOpen} onOpenChange={setPublishDraftOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar rascunho agora?</AlertDialogTitle>
            <AlertDialogDescription>
              O post será publicado imediatamente nas contas selecionadas durante o rascunho.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-destructive px-1">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublishDraft} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publicar agora"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Schedule draft */}
      <Dialog open={scheduleDraftOpen} onOpenChange={setScheduleDraftOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Agendar rascunho</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Data e hora (horário de Brasília)</label>
              <input
                type="datetime-local"
                min={minDateStr}
                value={draftScheduledAt}
                onChange={(e) => setDraftScheduledAt(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setScheduleDraftOpen(false)}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleScheduleDraft}
              disabled={loading || !draftScheduledAt}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
              Agendar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit — usa o mesmo fluxo completo de criação */}
      <CreatePostDialog
        workspaceId={workspaceId}
        accounts={accounts}
        editPost={post}
        editOpen={editOpen}
        onEditClose={() => setEditOpen(false)}
      />
    </>
  )
}
