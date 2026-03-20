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
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Pencil, Trash2, CalendarX, Loader2, Copy } from "lucide-react"
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
  const [duplicating, setDuplicating] = useState(false)

  const handleDuplicate = async () => {
    setDuplicating(true)
    try {
      const res = await fetch(`/api/posts/${post.id}/duplicate`, { method: "POST" })
      if (res.ok) router.refresh()
    } finally {
      setDuplicating(false)
    }
  }



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
          {!isPublished && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4 mr-2" />
              {isDraft ? "Editar / Publicar rascunho" : "Editar"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleDuplicate} disabled={duplicating}>
            {duplicating
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <Copy className="w-4 h-4 mr-2" />
            }
            Duplicar como rascunho
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

      {/* Edit — usa o mesmo fluxo completo de criação/edição */}
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
