import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ImageIcon, Instagram, Facebook, Film, LayoutGrid } from "lucide-react"
import { EmptyState } from "@/components/dashboard/empty-state"

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

export default async function DashboardPostsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const posts = await sql`
    SELECT p.id, p.content, p.status, p.scheduled_at, p.created_at,
      o.id as workspace_id, o.name as workspace_name,
      ARRAY_AGG(DISTINCT sa.platform) FILTER (WHERE sa.id IS NOT NULL) as platforms,
      ARRAY_AGG(DISTINCT pt.post_type) FILTER (WHERE pt.id IS NOT NULL) as post_types,
      COUNT(DISTINCT pm.id)::int as media_count,
      (SELECT pm2.media_url FROM post_media pm2 WHERE pm2.post_id = p.id ORDER BY pm2.order_index ASC LIMIT 1) as thumbnail
    FROM posts p
    JOIN neon_auth.organization o ON o.id = p.workspace_id
    JOIN neon_auth.member m ON m."organizationId" = o.id
    LEFT JOIN post_targets pt ON pt.post_id = p.id
    LEFT JOIN social_accounts sa ON sa.id = pt.social_account_id
    LEFT JOIN post_media pm ON pm.post_id = p.id
    WHERE m."userId" = ${session.user.id}
    GROUP BY p.id, o.id, o.name
    ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC
  `

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Todos os Posts</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Posts de todos os workspaces
        </p>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Nenhum post ainda"
          description="Acesse um workspace e crie seu primeiro post."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {posts.map((post: any) => {
            const status = statusMap[post.status] || { label: post.status, variant: "outline" as const }
            const postType = (post.post_types || [])[0] || "feed"

            return (
              <Card key={post.id} className="overflow-hidden hover:border-primary/30 transition-all group">
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
                </div>

                <CardContent className="p-3">
                  <p className="text-xs text-primary font-medium mb-1 truncate">{post.workspace_name}</p>
                  <p className="text-sm text-foreground line-clamp-2 mb-2 leading-relaxed">
                    {post.content || "Sem legenda"}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {post.scheduled_at
                        ? new Date(post.scheduled_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                        : new Date(post.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </span>
                    <Badge variant={status.variant} className="text-xs">
                      {status.label}
                    </Badge>
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
