import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Instagram, Facebook, ImageIcon, Film, LayoutGrid } from "lucide-react"
import { EmptyState } from "@/components/dashboard/empty-state"
import { CreatePostDialog } from "@/components/posts/create-post-dialog"
import { PostActions } from "@/components/posts/post-actions"
import { VideoThumbnail } from "@/components/posts/video-thumbnail"

interface Props {
  params: Promise<{ workspaceId: string }>
}

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="w-3.5 h-3.5" style={{ color: "oklch(0.52 0.25 15)" }} />,
  facebook: <Facebook className="w-3.5 h-3.5" style={{ color: "oklch(0.46 0.18 242)" }} />,
}

const postTypeIcons: Record<string, React.ReactNode> = {
  feed: <ImageIcon className="w-3 h-3" />,
  reel: <Film className="w-3 h-3" />,
  carousel: <LayoutGrid className="w-3 h-3" />,
  story: <ImageIcon className="w-3 h-3" />,
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Rascunho", variant: "outline" },
  scheduled: { label: "Agendado", variant: "secondary" },
  published: { label: "Publicado", variant: "default" },
  failed: { label: "Falhou", variant: "destructive" },
}

export default async function WorkspacePostsPage({ params }: Props) {
  const { workspaceId } = await params
  const session = await getSession()
  if (!session) redirect("/login")

  const [workspace, accounts, posts] = await Promise.all([
    sql`
      SELECT o.id, o.name FROM "organization" o
      JOIN "member" m ON o.id = m.organization_id
      WHERE o.id = ${workspaceId} AND m.user_id = ${session.user.id}
      LIMIT 1
    `,
    sql`
      SELECT id, platform, account_name, account_username, profile_picture_url
      FROM social_accounts WHERE workspace_id = ${workspaceId} AND is_active = true
    `,
    sql`
      SELECT p.id, p.content, p.status, p.scheduled_at, p.published_at, p.created_at, p.error_message,
        ARRAY_AGG(DISTINCT sa.platform) FILTER (WHERE sa.id IS NOT NULL) as platforms,
        ARRAY_AGG(DISTINCT pt.post_type) FILTER (WHERE pt.id IS NOT NULL) as post_types,
        ARRAY_AGG(DISTINCT pt.social_account_id) FILTER (WHERE pt.social_account_id IS NOT NULL) as account_ids,
        COUNT(DISTINCT pm.id) FILTER (WHERE pm.media_type != 'cover')::int as media_count,
        COALESCE(
          (SELECT pm2.url FROM post_media pm2 WHERE pm2.post_id = p.id AND pm2.media_type = 'cover' LIMIT 1),
          (SELECT pm3.url FROM post_media pm3 WHERE pm3.post_id = p.id AND pm3.media_type != 'cover' ORDER BY pm3.order_index ASC LIMIT 1)
        ) as thumbnail,
        (SELECT pm4.media_type FROM post_media pm4 WHERE pm4.post_id = p.id AND pm4.media_type != 'cover' ORDER BY pm4.order_index ASC LIMIT 1) as primary_media_type,
        (SELECT pm5.url FROM post_media pm5 WHERE pm5.post_id = p.id AND pm5.media_type != 'cover' ORDER BY pm5.order_index ASC LIMIT 1) as primary_media_url,
        COALESCE(
          JSON_AGG(JSON_BUILD_OBJECT('url', pm.url, 'media_type', pm.media_type) ORDER BY pm.order_index ASC) FILTER (WHERE pm.id IS NOT NULL AND pm.media_type != 'cover'),
          '[]'::json
        ) as media
      FROM posts p
      LEFT JOIN post_targets pt ON pt.post_id = p.id
      LEFT JOIN social_accounts sa ON sa.id = pt.social_account_id
      LEFT JOIN post_media pm ON pm.post_id = p.id
      WHERE p.workspace_id = ${workspaceId}
      GROUP BY p.id
      ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC
    `,
  ])

  if (workspace.length === 0) notFound()
  const ws = workspace[0]

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Posts</h1>
          <p className="text-muted-foreground text-sm mt-1">{ws.name}</p>
        </div>
        <CreatePostDialog workspaceId={workspaceId} accounts={accounts}>
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Post
          </Button>
        </CreatePostDialog>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Nenhum post ainda"
          description="Crie e agende seu primeiro post para este workspace."
          action={
            <CreatePostDialog workspaceId={workspaceId} accounts={accounts}>
              <Button className="gap-2" disabled={accounts.length === 0}>
                <Plus className="w-4 h-4" />
                Criar Post
              </Button>
            </CreatePostDialog>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post: any) => {
            const status = statusMap[post.status] || { label: post.status, variant: "outline" as const }
            const postType = (post.post_types || [])[0] || "feed"

            return (
              <Card key={post.id} className="overflow-hidden hover:border-primary/30 transition-all group">
                {/* Thumbnail */}
                <div className="aspect-square bg-muted relative overflow-hidden">
                  {post.thumbnail ? (
                    // If thumbnail is a cover image or a regular image, show it directly.
                    // If the primary media is a video and there's no cover, VideoThumbnail captures a frame.
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
                  {post.media_count > 1 && (
                    <div className="absolute bottom-2 right-2">
                      <Badge variant="secondary" className="text-xs shadow-sm">
                        1/{post.media_count}
                      </Badge>
                    </div>
                  )}
                </div>

                <CardContent className="p-3">
                  <p className="text-sm text-foreground line-clamp-2 mb-2 leading-relaxed">
                    {post.content || "Sem legenda"}
                  </p>
                  {post.status === "failed" && post.error_message && (
                    <p className="text-xs text-destructive bg-destructive/5 rounded px-2 py-1 mb-2 line-clamp-2 leading-relaxed">
                      {post.error_message}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {(() => {
                        // Neon may return Date objects or strings — normalize to Date safely
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
                      <Badge variant={status.variant} className="text-xs">
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
                          media: post.media || [],
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
