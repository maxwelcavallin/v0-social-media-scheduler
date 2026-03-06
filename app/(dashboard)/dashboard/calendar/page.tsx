import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { redirect } from "next/navigation"
import { CalendarView } from "@/components/calendar/calendar-view"

export default async function DashboardCalendarPage() {
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
      AND p.scheduled_at IS NOT NULL
    GROUP BY p.id, o.id, o.name
    ORDER BY p.scheduled_at ASC
  `

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Calendário Geral</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Todos os posts agendados em todos os workspaces
        </p>
      </div>
      <CalendarView posts={posts} showWorkspace />
    </div>
  )
}
