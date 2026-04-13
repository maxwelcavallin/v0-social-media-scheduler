import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import sql from "@/lib/db"
import { getUserPlan } from "@/lib/plans"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  const [workspaces, plan, companyRows, adminRows] = await Promise.all([
    sql`
      SELECT o.id, o.name, o.slug, o.logo
      FROM "organization" o
      JOIN "member" m ON o.id = m.organization_id
      WHERE m.user_id = ${session.user.id}
      ORDER BY o.created_at ASC
    `,
    getUserPlan(session.user.id),
    sql`
      SELECT c.id, c.name, c.document, cm.role
      FROM company c
      JOIN company_member cm ON cm.company_id = c.id
      WHERE cm.user_id = ${session.user.id}
      LIMIT 1
    `,
    sql`SELECT is_super_admin FROM users WHERE id = ${session.user.id} LIMIT 1`,
  ])

  const company = companyRows[0] ?? null
  const isSuperAdmin = adminRows[0]?.is_super_admin === true

  return (
    <div className="min-h-screen bg-background font-sans flex">
      <DashboardSidebar workspaces={workspaces} user={session.user} plan={plan} company={company} isSuperAdmin={isSuperAdmin} />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader user={session.user} />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
