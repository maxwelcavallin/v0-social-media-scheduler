"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PostDetailsDialog } from "@/components/posts/post-details-dialog"
import { VideoThumbnail } from "@/components/posts/video-thumbnail"
import { PostActions } from "@/components/posts/post-actions"
import { Plus, ImageIcon, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { CreatePostDialog } from "@/components/posts/create-post-dialog"
import { Button } from "@/components/ui/button"

interface WorkspacePostsClientProps {
  posts: any[]
  accounts: any[]
  workspaceId: string
  platformIcons: Record<string, React.ReactNode>
  postTypeIcons: Record<string, React.ReactNode>
  statusMap: Record<string, any>
  reviewStatuses: string[]
}

export function WorkspacePostsClient({
  posts,
  accounts,
  workspaceId,
  platformIcons,
  postTypeIcons,
  statusMap,
  reviewStatuses,
}: WorkspacePostsClientProps) {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const selectedPost = posts.find(p => p.id === selectedPostId)

  return (
    <>
      <div className="flex justify-end mb-4">
        <CreatePostDialog
          workspaceId={workspaceId}
          accounts={accounts}
          trigger={
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Novo post
            </Button>
          }
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post: any) => {
          const postType = (post.post_types || [])[0] || "feed"
          const displayStatus = post.review_status && reviewStatuses.includes(post.review_status)
            ? post.review_status
            : post.status
          const status = statusMap[displayStatus] || { label: displayStatus, variant: "outline" as const }

          return (
            <Card
              key={post.id}
              onClick={() => setSelectedPostId(post.id)}
              className="overflow-hidden hover:border-primary/30 transition-all group cursor-pointer"
            >
              {/* Thumbnail */}
              <div className="aspect-square bg-muted relative overflow-hidden">
                {post.thumbnail ? (
                  post.primary_media_type === "video" && post.thumbnail === post.primary_media_url ? (
                    <VideoThumbnail
                      videoUrl={post.thumbnail}
                      className="group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <img
                      src={post.thumbnail}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
                  </div>
                )}

                {/* Overlay badges */}
                <div className="absolute top-2 left-2 flex gap-1">
                  {(post.platforms || []).map((p: string) => (
                    <div key={p} className="w-6 h-6 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center shadow-sm">
                      {platformIcons[p]}
                    </div>
                  ))}
                </div>
                <div className="absolute top-2 right-2">
                  <div className="flex items-center gap-1 bg-card/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm text-xs text-muted-foreground">
                    {postTypeIcons[postType]}
                    <span className="capitalize">{postType}</span>
                  </div>
                </div>

                {/* Indicadores de mídia e feedback */}
                {post.media_count > 1 && (
                  <div className="absolute bottom-2 right-2">
                    <Badge variant="secondary" className="text-xs shadow-sm">
                      1/{post.media_count}
                    </Badge>
                  </div>
                )}
                {post.review_status === "needs_changes" && post.review_notes && (
                  <div className="absolute bottom-2 right-2">
                    <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shadow-sm">
                      <MessageSquare className="w-3 h-3 text-white" />
                    </div>
                  </div>
                )}
              </div>

              <CardContent className="p-3">
                {(() => {
                  const ids: string[] = post.account_ids || []
                  const matched = accounts.filter((a: any) => ids.includes(a.id))
                  const names = matched.map((a: any) => a.account_username ? `@${a.account_username}` : a.account_name).filter(Boolean)
                  return names.length > 0 ? (
                    <p className="text-xs text-muted-foreground font-medium mb-1 truncate">{names.join(", ")}</p>
                  ) : null
                })()}
                <p className="text-sm text-foreground line-clamp-2 mb-2 leading-relaxed whitespace-pre-wrap">
                  {postType === "story" ? "Story" : (post.content || "Sem legenda")}
                </p>
                {post.status === "failed" && post.error_message && (
                  <p className="text-xs text-destructive bg-destructive/5 rounded px-2 py-1 mb-2 line-clamp-2 leading-relaxed">
                    {post.error_message}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {(() => {
                      const toUtcDate = (v: unknown): Date => {
                        if (v instanceof Date) return v
                        const s = String(v)
                        return new Date(s.endsWith("Z") || s.includes("+") ? s : s + "Z")
                      }
                      const fmt = (d: Date) => new Intl.DateTimeFormat("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                        day: "2-digit", month: "short",
                        hour: "2-digit", minute: "2-digit",
                      }).format(d)
                      const dateToShow = post.published_at || post.scheduled_at
                      const label = post.status === "published" ? "Publicado " : post.scheduled_at ? "Agendado " : ""
                      if (dateToShow) return label + fmt(toUtcDate(dateToShow))
                      return fmt(toUtcDate(post.created_at))
                    })()}
                  </span>
                  <div className="flex items-center gap-1">
                    <Badge variant={status.variant} className={cn("text-xs", status.className)}>
                      {status.label}
                    </Badge>
                    <PostActions
                      workspaceId={workspaceId}
                      accounts={accounts}
                      post={{
                        id: post.id,
                        content: post.content,
                        status: post.status,
                        scheduled_at: post.scheduled_at,
                        post_type: (post.post_types || [])[0] || "feed",
                        accountIds: post.account_ids || [],
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {selectedPost && (
        <PostDetailsDialog
          post={selectedPost}
          open={selectedPostId !== null}
          onOpenChange={(open) => !open && setSelectedPostId(null)}
          displayStatus={
            selectedPost.review_status && reviewStatuses.includes(selectedPost.review_status)
              ? selectedPost.review_status
              : selectedPost.status
          }
          statusMap={statusMap}
          accounts={accounts}
          workspaceId={workspaceId}
        />
      )}
    </>
  )
}
