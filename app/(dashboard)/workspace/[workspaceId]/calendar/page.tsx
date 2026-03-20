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
      JOIN "member" m ON o.id = m.organization_id
      WHERE o.id = ${workspaceId} AND m.user_id = ${session.user.id}
      LIMIT 1
    `,

    sql`
      SELECT id, platform, account_name, account_username, profile_picture_url
      FROM social_accounts
      WHERE workspace_id = ${workspaceId} AND is_active = true
      ORDER BY account_name ASC
    `,
    sql`
      SELECT
        p.id, p.content, p.status, p.scheduled_at, p.created_at,
        COALESCE(
          (
            SELECT JSON_AGG(
              JSON_BUILD_OBJECT(
                'id', sa2.id,
                'platform', sa2.platform,
                'account_name', sa2.account_name,
                'account_username', sa2.account_username,
                'profile_picture_url', sa2.profile_picture_url
              )
            )
            FROM post_targets pt2
            JOIN social_accounts sa2 ON sa2.id = pt2.social_account_id
            WHERE pt2.post_id = p.id
          ),
          '[]'::json
        ) as accounts,
        (SELECT COUNT(*)::int FROM post_media pm WHERE pm.post_id = p.id) as media_count,
        (SELECT pm2.url FROM post_media pm2 WHERE pm2.post_id = p.id ORDER BY pm2.order_index ASC LIMIT 1) as thumbnail,
        COALESCE(
          (
            SELECT JSON_AGG(JSON_BUILD_OBJECT('url', pm3.url, 'media_type', pm3.media_type) ORDER BY pm3.order_index ASC)
            FROM post_media pm3 WHERE pm3.post_id = p.id
          ),
          '[]'::json
        ) as media
      FROM posts p
      WHERE p.workspace_id = ${workspaceId}
        AND p.scheduled_at IS NOT NULL
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

      <CalendarView
        posts={posts}
        accounts={accounts}
        workspaceId={workspaceId}
        showAccountFilter
      />
    </div>
  )
}
