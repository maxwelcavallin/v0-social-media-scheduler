import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import sql from "@/lib/db"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  // Fetch user's workspaces
  const workspaces = await sql`
    SELECT o.id, o.name, o.slug, o.logo
    FROM "organization" o
    JOIN "member" m ON o.id = m."organizationId"
    WHERE m."userId" = ${session.user.id}
    ORDER BY o."createdAt" ASC
  `

  return (
    <div className="min-h-screen bg-background font-sans flex">
      <DashboardSidebar workspaces={workspaces} user={session.user} />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader user={session.user} />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
