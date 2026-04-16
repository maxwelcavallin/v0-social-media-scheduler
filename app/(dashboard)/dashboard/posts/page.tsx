import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ImageIcon, Instagram, Facebook, Film, LayoutGrid, MessageSquare } from "lucide-react"
import { EmptyState } from "@/components/dashboard/empty-state"
import { StatusFilter } from "@/components/posts/status-filter"
import { DashboardPostsFilters } from "@/components/dashboard/dashboard-posts-filters"

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

const reviewStatuses = ["in_review", "approved", "needs_changes"]
const postStatuses = ["draft", "scheduled", "published", "failed"]
const validStatuses = [...postStatuses, ...reviewStatuses]

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
  draft:         { label: "Rascunho",   variant: "outline" },
  scheduled:     { label: "Agendado",   variant: "secondary" },
  published:     { label: "Publicado",  variant: "default" },
  failed:        { label: "Falhou",     variant: "destructive" },
  in_review:     { label: "Em revisão", variant: "outline", className: "border-blue-400 text-blue-600 dark:text-blue-400" },
  approved:      { label: "Aprovado",   variant: "outline", className: "border-green-500 text-green-600 dark:text-green-400" },
  needs_changes: { label: "Ajustar",    variant: "outline", className: "border-amber-500 text-amber-600 dark:text-amber-400" },
}

interface Props {
  searchParams: Promise<{ status?: string; workspace?: string; account?: string }>
}

export default async function DashboardPostsPage({ searchParams }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { status: statusFilter, workspace: workspaceFilter, account: accountFilter } = await searchParams

  const filterStatus    = statusFilter  && validStatuses.includes(statusFilter)  ? statusFilter  : null
  const filterWorkspace = workspaceFilter || null
  const filterAccount   = accountFilter  || null
  const isReviewFilter  = filterStatus ? reviewStatuses.includes(filterStatus) : false

  const [workspaces, accounts, posts] = await Promise.all([
    // Todos os workspaces do usuário
    sql`
      SELECT o.id, o.name
      FROM "organization" o
      JOIN "member" m ON o.id = m.organization_id
      WHERE m.user_id = ${session.user.id}
      ORDER BY o.name
    `,
    // Todas as contas conectadas nos workspaces do usuário
    sql`
      SELECT sa.id, sa.account_name, sa.account_username, sa.platform, sa.workspace_id
      FROM social_accounts sa
      JOIN "member" m ON m.organization_id = sa.workspace_id
      WHERE m.user_id = ${session.user.id}
        AND sa.is_active = true
      ORDER BY sa.account_name
    `,
    // Posts com filtros aplicados
    sql`
      SELECT
        p.id, p.content, p.status, p.review_status, p.review_notes, p.scheduled_at, p.created_at,
        o.id   AS workspace_id,
        o.name AS workspace_name,
        ARRAY_AGG(DISTINCT sa.platform)   FILTER (WHERE sa.id IS NOT NULL) AS platforms,
        ARRAY_AGG(DISTINCT pt.post_type)  FILTER (WHERE pt.id IS NOT NULL) AS post_types,
        COUNT(DISTINCT pm.id)::int AS media_count,
        (SELECT pm2.url FROM post_media pm2 WHERE pm2.post_id = p.id ORDER BY pm2.order_index ASC LIMIT 1) AS thumbnail,
        COALESCE(
          (SELECT JSON_AGG(JSON_BUILD_OBJECT('name', sa2.account_name, 'username', sa2.account_username))
           FROM post_targets pt2
           JOIN social_accounts sa2 ON sa2.id = pt2.social_account_id
           WHERE pt2.post_id = p.id),
          '[]'::json
        ) AS accounts
      FROM posts p
      JOIN "organization" o ON o.id = p.workspace_id
      JOIN "member" m ON m.organization_id = o.id
      LEFT JOIN post_targets pt ON pt.post_id = p.id
      LEFT JOIN social_accounts sa ON sa.id = pt.social_account_id
      LEFT JOIN post_media pm ON pm.post_id = p.id
      WHERE m.user_id = ${session.user.id}
        AND (${filterWorkspace}::text IS NULL OR p.workspace_id::text = ${filterWorkspace})
        AND (
          ${filterAccount}::text IS NULL
          OR p.id IN (
            SELECT pt3.post_id FROM post_targets pt3 WHERE pt3.social_account_id::text = ${filterAccount}
          )
        )
        AND (
          ${filterStatus}::text IS NULL
          OR (${isReviewFilter} = false AND p.status = ${filterStatus})
          OR (${isReviewFilter} = true  AND p.review_status = ${filterStatus})
        )
      GROUP BY p.id, o.id, o.name
      ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC
    `,
  ])

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Posts</h1>
        <p className="text-muted-foreground text-sm mt-1">Posts de todos os workspaces</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3">
        <StatusFilter current={filterStatus} />
        <DashboardPostsFilters
          workspaces={workspaces as any}
          accounts={accounts as any}
          currentWorkspaceId={filterWorkspace}
          currentAccountId={filterAccount}
        />
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Nenhum post encontrado"
          description="Tente ajustar os filtros ou acesse um workspace para criar posts."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {posts.map((post: any) => {
            const displayStatus = post.review_status && reviewStatuses.includes(post.review_status)
              ? post.review_status
              : post.status
            const status  = statusMap[displayStatus] || { label: displayStatus, variant: "outline" as const }
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
                  {(() => {
                    const accs  = Array.isArray(post.accounts) ? post.accounts : []
                    const names = accs.map((a: any) => a.username ? `@${a.username}` : a.name).filter(Boolean)
                    return names.length > 0 ? (
                      <p className="text-xs text-muted-foreground mb-1 truncate">{names.join(", ")}</p>
                    ) : null
                  })()}
                  <p className="text-sm text-foreground line-clamp-2 mb-2 leading-relaxed whitespace-pre-wrap">
                    {postType === "story" ? "Story" : (post.content || "Sem legenda")}
                  </p>
                  {displayStatus === "needs_changes" && post.review_notes && (
                    <div className="flex gap-1.5 items-start bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5 mb-2">
                      <MessageSquare className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed whitespace-pre-wrap">
                        {post.review_notes}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {(() => {
                        const s = String(post.scheduled_at || post.created_at)
                        const d = new Date(s.endsWith("Z") || s.includes("+") ? s : s + "Z")
                        return new Intl.DateTimeFormat("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                          day: "2-digit", month: "short",
                          hour: "2-digit", minute: "2-digit",
                        }).format(d)
                      })()}
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
      )}
    </div>
  )
}
