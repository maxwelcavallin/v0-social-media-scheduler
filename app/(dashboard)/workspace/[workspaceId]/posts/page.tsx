import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Plus, Instagram, Facebook, ImageIcon, Film, LayoutGrid } from "lucide-react"
import { EmptyState } from "@/components/dashboard/empty-state"
import { CreatePostDialog } from "@/components/posts/create-post-dialog"
import { StatusFilter } from "@/components/posts/status-filter"
import { WorkspacePostsClient } from "./workspace-posts-client"
import { Button } from "@/components/ui/button"

interface Props {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{ status?: string }>
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

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
  draft: { label: "Rascunho", variant: "outline" },
  scheduled: { label: "Agendado", variant: "secondary", className: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
  publishing: { label: "Publicando", variant: "secondary", className: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800" },
  published: { label: "Publicado", variant: "default" },
  failed: { label: "Falhou", variant: "destructive" },
  in_review: { label: "Em revisão", variant: "secondary", className: "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800" },
  approved: { label: "Aprovado", variant: "secondary", className: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800" },
  needs_changes: { label: "Ajustar", variant: "secondary", className: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
}

const reviewStatuses = ["in_review", "approved", "needs_changes"]

export default async function WorkspacePostsPage({ params, searchParams }: Props) {
  const session = await getSession()
  if (!session?.user?.id) redirect("/login")

  const { workspaceId } = await params
  const { status: statusFilter } = await searchParams

  // Verifica acesso ao workspace
  const workspaceAccess = await sql`
    SELECT o.id FROM "organization" o
    JOIN "member" m ON o.id = m.organization_id
    WHERE o.id = ${workspaceId} AND m.user_id = ${session.user.id}
    LIMIT 1
  `
  if (workspaceAccess.length === 0) notFound()

  // Busca workspace
  const [workspace] = await sql`SELECT name FROM "organization" WHERE id = ${workspaceId} LIMIT 1`

  // Contas da workspace
  const accounts = await sql`
    SELECT id, account_name, account_username FROM social_accounts
    WHERE workspace_id = ${workspaceId}
    ORDER BY account_name ASC
  `

  // Posts com filtro de status
  const validStatuses = ["draft", "scheduled", "publishing", "published", "failed", "in_review", "approved", "needs_changes"]
  const filterStatus = statusFilter && validStatuses.includes(statusFilter) ? statusFilter : null
  const isReviewFilter = filterStatus ? reviewStatuses.includes(filterStatus) : false

  const posts = await sql`
    SELECT
      p.id, p.content, p.status, p.review_status, p.review_notes, p.scheduled_at, p.created_at,
      p.published_at, p.error_message,
      ARRAY_AGG(DISTINCT pt.post_type) FILTER (WHERE pt.post_type IS NOT NULL) AS post_types,
      COALESCE(COUNT(DISTINCT pm.id), 0) AS media_count,
      (SELECT pm2.url FROM post_media pm2 WHERE pm2.post_id = p.id ORDER BY pm2.order_index ASC LIMIT 1) AS thumbnail,
      (SELECT pm2.media_type FROM post_media pm2 WHERE pm2.post_id = p.id ORDER BY pm2.order_index ASC LIMIT 1) AS primary_media_type,
      (SELECT pm2.url FROM post_media pm2 WHERE pm2.post_id = p.id ORDER BY pm2.order_index ASC LIMIT 1) AS primary_media_url,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', sa.id, 'account_name', sa.account_name, 'account_username', sa.account_username)) FILTER (WHERE sa.id IS NOT NULL), '[]') AS accounts,
      ARRAY_AGG(DISTINCT sa.platform) FILTER (WHERE sa.platform IS NOT NULL) AS platforms,
      ARRAY_AGG(DISTINCT pt.social_account_id) FILTER (WHERE pt.social_account_id IS NOT NULL) AS account_ids,
      COALESCE(json_agg(DISTINCT jsonb_build_object('url', pm.url, 'media_type', pm.media_type, 'order_index', pm.order_index)) FILTER (WHERE pm.id IS NOT NULL), '[]') AS media
    FROM posts p
    LEFT JOIN post_media pm ON pm.post_id = p.id
    LEFT JOIN post_targets pt ON pt.post_id = p.id
    LEFT JOIN social_accounts sa ON sa.id = pt.social_account_id
    WHERE p.workspace_id = ${workspaceId}
      AND (
        ${filterStatus}::text IS NULL
        OR (${isReviewFilter} = false AND p.status = ${filterStatus})
        OR (${isReviewFilter} = true AND p.review_status = ${filterStatus})
      )
    GROUP BY p.id
    ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC
  `

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{workspace.name} — Posts</h1>
      </div>

      <StatusFilter current={filterStatus} />

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
        <WorkspacePostsClient
          posts={posts}
          accounts={accounts}
          workspaceId={workspaceId}
          platformIcons={platformIcons}
          postTypeIcons={postTypeIcons}
          statusMap={statusMap}
          reviewStatuses={reviewStatuses}
        />
      )}
    </div>
  )
}
