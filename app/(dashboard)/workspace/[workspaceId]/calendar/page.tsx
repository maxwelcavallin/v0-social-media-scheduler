import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import { CalendarView } from "@/components/calendar/calendar-view"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { CreatePostDialog } from "@/components/posts/create-post-dialog"

interface Props {
  params: Promise<{ workspaceId: string }>
}

export default async function WorkspaceCalendarPage({ params }: Props) {
  const { workspaceId } = await params
  const session = await getSession()
  if (!session) redirect("/login")

  const [workspace, accounts, posts] = await Promise.all([
    sql`
      SELECT o.id, o.name
      FROM "organization" o
      JOIN "member" m ON o.id = m."organizationId"
      WHERE o.id = ${workspaceId} AND m."userId" = ${session.user.id}
      LIMIT 1
    `,
    sql`
      SELECT id, platform, account_name, account_username, profile_picture_url
      FROM social_accounts
      WHERE workspace_id = ${workspaceId} AND is_active = true
    `,
    sql`
      SELECT p.id, p.content, p.status, p.scheduled_at, p.created_at,
        ARRAY_AGG(DISTINCT sa.platform) FILTER (WHERE sa.id IS NOT NULL) as platforms,
        ARRAY_AGG(DISTINCT pt.post_type) FILTER (WHERE pt.id IS NOT NULL) as post_types,
        COUNT(DISTINCT pm.id)::int as media_count,
        (SELECT pm2.media_url FROM post_media pm2 WHERE pm2.post_id = p.id ORDER BY pm2.order_index ASC LIMIT 1) as thumbnail
      FROM posts p
      LEFT JOIN post_targets pt ON pt.post_id = p.id
      LEFT JOIN social_accounts sa ON sa.id = pt.social_account_id
      LEFT JOIN post_media pm ON pm.post_id = p.id
      WHERE p.workspace_id = ${workspaceId}
        AND p.scheduled_at IS NOT NULL
      GROUP BY p.id
      ORDER BY p.scheduled_at ASC
    `,
  ])

  if (workspace.length === 0) notFound()

  const ws = workspace[0]

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendário</h1>
          <p className="text-muted-foreground text-sm mt-1">{ws.name}</p>
        </div>
        <CreatePostDialog workspaceId={workspaceId} accounts={accounts}>
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Post
          </Button>
        </CreatePostDialog>
      </div>

      <CalendarView posts={posts} />
    </div>
  )
}
