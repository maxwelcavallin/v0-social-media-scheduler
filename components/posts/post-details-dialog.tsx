"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageSquare, Zap, Share2, Pencil, Copy, Check, Loader2 } from "lucide-react"
import { CreatePostDialog } from "@/components/posts/create-post-dialog"

interface PostDetailsDialogProps {
  post: any
  open: boolean
  onOpenChange: (open: boolean) => void
  displayStatus: string
  statusMap: Record<string, any>
  accounts?: any[]
  workspaceId?: string
}

export function PostDetailsDialog({
  post,
  open,
  onOpenChange,
  displayStatus,
  statusMap,
  accounts = [],
  workspaceId,
}: PostDetailsDialogProps) {
  const router = useRouter()
  const status = statusMap[displayStatus] || { label: displayStatus, variant: "outline" as const }
  const postType = (post.post_types || [])[0] || "feed"

  const hasFeedback = post.review_status === "needs_changes" && post.review_notes
  const isPublished = post.status === "published"
  const canEdit = !isPublished
  const canShare = ["draft", "in_review", "needs_changes"].includes(post.status)

  // Aba de ações
  const [editOpen, setEditOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    setSharing(true)
    try {
      const res = await fetch(`/api/posts/${post.id}/share`, { method: "POST" })
      const data = await res.json()
      if (data.url) {
        setShareUrl(data.url)
        router.refresh()
      }
    } finally {
      setSharing(false)
    }
  }

  const handleCopyLink = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tabs = ["details", hasFeedback ? "feedback" : null, "actions"].filter(Boolean) as string[]
  const defaultTab = hasFeedback ? "feedback" : "details"

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>Detalhes do Post</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList className={`grid w-full border-b rounded-none px-6 h-10 bg-transparent ${tabs.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
                  Detalhes
                </TabsTrigger>
                {hasFeedback && (
                  <TabsTrigger value="feedback" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Feedback
                  </TabsTrigger>
                )}
                <TabsTrigger value="actions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  Ações
                </TabsTrigger>
              </TabsList>

              {/* Aba Detalhes */}
              <TabsContent value="details" className="space-y-4 p-6 mt-0">
                {post.thumbnail && (
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                    <img src={post.thumbnail} alt="Post thumbnail" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {post.workspace_name && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Workspace</p>
                      <p className="text-sm font-medium">{post.workspace_name}</p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Tipo</p>
                    <p className="text-sm font-medium capitalize">{postType}</p>
                  </div>
                </div>

                {Array.isArray(post.accounts) && post.accounts.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Contas</p>
                    <p className="text-sm font-medium">
                      {post.accounts.map((a: any) => a.username ? `@${a.username}` : a.name).filter(Boolean).join(", ")}
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Legenda</p>
                  <Card className="bg-muted/30">
                    <CardContent className="pt-4 pb-4">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {post.content || "Sem legenda"}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    {(() => {
                      try {
                        const s = String(post.scheduled_at || post.created_at)
                        const d = new Date(s.endsWith("Z") || s.includes("+") ? s : s + "Z")
                        return new Intl.DateTimeFormat("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        }).format(d)
                      } catch { return "—" }
                    })()}
                  </span>
                  <Badge variant={status.variant} className={status.className}>{status.label}</Badge>
                </div>
              </TabsContent>

              {/* Aba Feedback */}
              {hasFeedback && (
                <TabsContent value="feedback" className="p-6 mt-0">
                  <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <MessageSquare className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-300 mb-2">Ajustes Solicitados</p>
                      <p className="text-sm text-amber-800 dark:text-amber-400 leading-relaxed whitespace-pre-wrap">
                        {post.review_notes}
                      </p>
                    </div>
                  </div>
                </TabsContent>
              )}

              {/* Aba Ações */}
              <TabsContent value="actions" className="p-6 mt-0 space-y-3">
                {canEdit && workspaceId && (
                  <button
                    onClick={() => setEditOpen(true)}
                    className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Pencil className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Editar / Publicar / Agendar</p>
                      <p className="text-xs text-muted-foreground">Edite o conteúdo, publique agora ou agende para uma data</p>
                    </div>
                  </button>
                )}

                {canShare && (
                  <button
                    onClick={handleShare}
                    disabled={sharing}
                    className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                      {sharing
                        ? <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                        : <Share2 className="w-4 h-4 text-blue-600" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium">Compartilhar para aprovação</p>
                      <p className="text-xs text-muted-foreground">Gera um link para o cliente revisar e aprovar</p>
                    </div>
                  </button>
                )}

                {shareUrl && (
                  <div className="flex gap-2 p-3 bg-muted/40 rounded-lg border">
                    <Input
                      readOnly
                      value={shareUrl}
                      className="text-xs font-mono h-8"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <Button variant="outline" size="sm" onClick={handleCopyLink} className="flex-shrink-0 h-8 w-8 p-0">
                      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                )}

                {isPublished && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Este post já foi publicado.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* CreatePostDialog fora do Dialog principal para evitar conflito de portais */}
      {canEdit && workspaceId && (
        <CreatePostDialog
          workspaceId={workspaceId}
          accounts={accounts}
          editPost={{
            id: post.id,
            content: post.content,
            status: post.status,
            scheduled_at: post.scheduled_at,
            post_type: (post.post_types || [])[0] || "feed",
            accountIds: post.account_ids || [],
            media: post.media || [],
            cover_url: post.cover_url || undefined,
          }}
          editOpen={editOpen}
          onEditClose={() => {
            setEditOpen(false)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
