import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { redirect } from "next/navigation"
import { CalendarView } from "@/components/calendar/calendar-view"

export default async function DashboardCalendarPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [workspaces, accounts, posts] = await Promise.all([
    sql`
      SELECT o.id, o.name
      FROM "organization" o
      JOIN "member" m ON o.id = m.organization_id
      WHERE m.user_id = ${session.user.id}
      ORDER BY o.name ASC
    `,
    sql`
      SELECT sa.id, sa.platform, sa.account_name, sa.account_username, sa.profile_picture_url
      FROM social_accounts sa
      JOIN "organization" o ON o.id = sa.workspace_id
      JOIN "member" m ON m.organization_id = o.id
      WHERE m.user_id = ${session.user.id} AND sa.is_active = true
      ORDER BY sa.account_name ASC
    `,
    sql`
      SELECT
        p.id, p.content, p.status, p.scheduled_at, p.created_at,
        o.id as workspace_id, o.name as workspace_name,
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
      JOIN "organization" o ON o.id = p.workspace_id
      JOIN "member" m ON m.organization_id = o.id
      WHERE m.user_id = ${session.user.id}
        AND p.scheduled_at IS NOT NULL
      ORDER BY p.scheduled_at ASC
    `,
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Calendário Geral</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Todos os posts agendados em todos os workspaces
        </p>
      </div>
      <CalendarView
        posts={posts}
        accounts={accounts}
        workspaces={workspaces}
        showWorkspace
        showFilters
      />
    </div>
  )
}
