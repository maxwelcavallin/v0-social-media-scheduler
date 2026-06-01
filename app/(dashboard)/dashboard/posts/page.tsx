import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Instagram, Facebook, ImageIcon, Film, LayoutGrid } from "lucide-react"
import { EmptyState } from "@/components/dashboard/empty-state"
import { StatusFilter } from "@/components/posts/status-filter"
import { DashboardPostsFilters } from "@/components/dashboard/dashboard-posts-filters"
import { PostsGridClient } from "@/components/dashboard/posts-grid-client"

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
  publishing:    { label: "Publicando", variant: "secondary", className: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800" },
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
        COALESCE(ARRAY_AGG(DISTINCT pt.post_type) FILTER (WHERE pt.post_type IS NOT NULL), ARRAY[p.post_type]) AS post_types,
        COUNT(DISTINCT pm.id)::int AS media_count,
        (SELECT pm2.url FROM post_media pm2 WHERE pm2.post_id = p.id ORDER BY pm2.order_index ASC LIMIT 1) AS thumbnail,
        COALESCE(
          (SELECT JSON_AGG(JSON_BUILD_OBJECT('name', sa2.account_name, 'username', sa2.account_username))
           FROM post_targets pt2
           JOIN social_accounts sa2 ON sa2.id = pt2.social_account_id
           WHERE pt2.post_id = p.id),
          '[]'::json
        ) AS accounts,
        COALESCE(
          (SELECT json_agg(jsonb_build_object('url', pm3.url, 'media_type', pm3.media_type, 'order_index', pm3.order_index) ORDER BY pm3.order_index ASC)
           FROM post_media pm3 WHERE pm3.post_id = p.id AND pm3.order_index >= 0),
          '[]'::json
        ) AS media,
        (SELECT pm4.url FROM post_media pm4 WHERE pm4.post_id = p.id AND pm4.order_index = -1 LIMIT 1) AS cover_url,
        ARRAY_AGG(DISTINCT pt.social_account_id) FILTER (WHERE pt.social_account_id IS NOT NULL) AS account_ids
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
        <PostsGridClient
          posts={posts}
          platformIcons={platformIcons}
          postTypeIcons={postTypeIcons}
          statusMap={statusMap}
          reviewStatuses={reviewStatuses}
        />
      )}
    </div>
  )
}
