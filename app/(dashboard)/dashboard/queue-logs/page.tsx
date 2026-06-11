import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import sql from "@/lib/db"
import { QueueLogsView } from "@/components/queue/queue-logs-view"

export const dynamic = "force-dynamic"

export default async function QueueLogsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const logs = await sql`
    SELECT id, created_at, level, post_id, queue_id, platform, message, details
    FROM queue_logs
    ORDER BY created_at DESC
    LIMIT 200
  `

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Logs da Fila de Publicação</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Histórico de execuções do cron de publicação — útil para depurar falhas.
        </p>
      </div>
      <QueueLogsView logs={logs} />
    </div>
  )
}
