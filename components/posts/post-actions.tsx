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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { MoreHorizontal, Pencil, Trash2, CalendarX, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  post: {
    id: string
    content: string
    status: string
    scheduled_at?: string
    post_type?: string
  }
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

export function PostActions({ post, className }: Props) {
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

  if (isPublished) return null

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
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="w-4 h-4 mr-2" />
            Editar
          </DropdownMenuItem>
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

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar post</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {post.post_type !== "story" && (
              <div className="flex flex-col gap-2">
                <Label>Legenda</Label>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="resize-none min-h-[120px]"
                  placeholder="Escreva sua legenda..."
                  maxLength={2200}
                />
                <span className="text-xs text-muted-foreground text-right">{editContent.length}/2200</span>
              </div>
            )}

            {isScheduled && (
              <div className="flex flex-col gap-2">
                <Label>Data e hora (horário de Brasília)</Label>
                <Input
                  type="datetime-local"
                  value={editScheduledAt}
                  min={minDateStr}
                  onChange={(e) => setEditScheduledAt(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
