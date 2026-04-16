"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PostDetailsDialog } from "@/components/posts/post-details-dialog"
import { ImageIcon, MessageSquare } from "lucide-react"

interface PostsGridClientProps {
  posts: any[]
  platformIcons: Record<string, React.ReactNode>
  postTypeIcons: Record<string, React.ReactNode>
  statusMap: Record<string, any>
  reviewStatuses: string[]
}

export function PostsGridClient({
  posts,
  platformIcons,
  postTypeIcons,
  statusMap,
  reviewStatuses,
}: PostsGridClientProps) {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const selectedPost = posts.find(p => p.id === selectedPostId)

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {posts.map((post: any) => {
          const displayStatus = post.review_status && reviewStatuses.includes(post.review_status)
            ? post.review_status
            : post.status
          const status = statusMap[displayStatus] || { label: displayStatus, variant: "outline" as const }
          const postType = (post.post_types || [])[0] || "feed"
          const hasReviewNotes = displayStatus === "needs_changes" && post.review_notes

          return (
            <Card
              key={post.id}
              onClick={() => setSelectedPostId(post.id)}
              className="overflow-hidden hover:border-primary/30 transition-all group cursor-pointer"
            >
              <div className="aspect-square bg-muted relative overflow-hidden">
                {post.thumbnail ? (
                  <img
                    src={post.thumbnail}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
                  </div>
                )}

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

                {hasReviewNotes && (
                  <div className="absolute bottom-2 right-2">
                    <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shadow-sm">
                      <MessageSquare className="w-3 h-3 text-white" />
                    </div>
                  </div>
                )}
              </div>

              <CardContent className="p-3">
                <p className="text-xs text-primary font-medium mb-1 truncate">{post.workspace_name}</p>
                {(() => {
                  const accs = Array.isArray(post.accounts) ? post.accounts : []
                  const names = accs.map((a: any) => a.username ? `@${a.username}` : a.name).filter(Boolean)
                  return names.length > 0 ? (
                    <p className="text-xs text-muted-foreground mb-1 truncate">{names.join(", ")}</p>
                  ) : null
                })()}
                <p className="text-sm text-foreground line-clamp-2 mb-2 leading-relaxed whitespace-pre-wrap">
                  {postType === "story" ? "Story" : (post.content || "Sem legenda")}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(post.scheduled_at || post.created_at))}
                  </span>
                  <Badge variant={status.variant} className={`text-xs ${status.className ?? ""}`}>
                    {status.label}
                  </Badge>
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
          workspaceId={selectedPost.workspace_id}
        />
      )}
    </>
  )
}
