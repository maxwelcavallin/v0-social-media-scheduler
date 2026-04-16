"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { X, MessageSquare } from "lucide-react"

interface PostDetailsDialogProps {
  post: any
  open: boolean
  onOpenChange: (open: boolean) => void
  displayStatus: string
  statusMap: Record<string, any>
}

export function PostDetailsDialog({ post, open, onOpenChange, displayStatus, statusMap }: PostDetailsDialogProps) {
  const status = statusMap[displayStatus] || { label: displayStatus, variant: "outline" as const }
  const postType = (post.post_types || [])[0] || "feed"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b">
          <div className="flex items-center justify-between w-full">
            <DialogTitle>Detalhes do Post</DialogTitle>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue={post.review_status === "needs_changes" && post.review_notes ? "feedback" : "details"} className="w-full">
            <TabsList className="grid w-full grid-cols-2 border-b rounded-none px-6 py-2">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              {post.review_status === "needs_changes" && post.review_notes && (
                <TabsTrigger value="feedback" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Feedback
                </TabsTrigger>
              )}
            </TabsList>

            {/* Aba Detalhes */}
            <TabsContent value="details" className="space-y-4 p-6">
              {post.thumbnail && (
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  <img
                    src={post.thumbnail}
                    alt="Post thumbnail"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Workspace</p>
                <p className="text-sm font-medium">{post.workspace_name}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Contas</p>
                <p className="text-sm font-medium">
                  {Array.isArray(post.accounts)
                    ? post.accounts.map((a: any) => a.username ? `@${a.username}` : a.name).filter(Boolean).join(", ")
                    : "—"}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Tipo</p>
                <p className="text-sm font-medium capitalize">{postType}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Legenda</p>
                <Card className="bg-muted/30">
                  <CardContent className="pt-4">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {post.content || "Sem legenda"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <span className="text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat("pt-BR", {
                    day: "2-digit", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  }).format(new Date(post.scheduled_at || post.created_at))}
                </span>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
            </TabsContent>

            {/* Aba Feedback */}
            {post.review_status === "needs_changes" && post.review_notes && (
              <TabsContent value="feedback" className="space-y-4 p-6">
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
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
