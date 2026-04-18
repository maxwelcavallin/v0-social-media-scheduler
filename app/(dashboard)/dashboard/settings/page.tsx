import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import sql from "@/lib/db"
import { CompanySettingsView } from "@/components/company/company-settings-view"

export default async function CompanySettingsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [companyRows, membersRows, invitationsRows, workspacesRows] = await Promise.all([
    sql`
      SELECT c.id, c.name, c.document, c.document_type, c.owner_id, c.created_at,
        cm.role
      FROM company c
      JOIN company_member cm ON cm.company_id = c.id
      WHERE cm.user_id = ${session.user.id}
      LIMIT 1
    `,
    sql`
      SELECT
        cm.user_id, cm.role,
        u.name, u.email,
        COALESCE(
          (
            SELECT json_agg(json_build_object('id', o.id, 'name', o.name) ORDER BY o.name)
            FROM "organization" o
            JOIN "member" m ON m.organization_id = o.id
            WHERE m.user_id = cm.user_id
          ),
          '[]'::json
        ) AS member_workspaces
      FROM company_member cm
      JOIN "user" u ON u.id = cm.user_id
      JOIN company_member my_cm ON my_cm.company_id = cm.company_id
      WHERE my_cm.user_id = ${session.user.id}
      ORDER BY u.name ASC
    `,
    sql`
      SELECT ci.id, ci.email, ci.role, ci.token, ci.created_at, ci.workspace_ids
      FROM company_invitation ci
      JOIN company_member cm ON cm.company_id = ci.company_id
      WHERE cm.user_id = ${session.user.id}
        AND cm.role = 'admin'
        AND ci.accepted_at IS NULL
      ORDER BY ci.created_at DESC
    `,
    sql`
      SELECT o.id, o.name
      FROM "organization" o
      JOIN "member" m ON m.organization_id = o.id
      JOIN company_member cm ON cm.user_id = ${session.user.id}
      JOIN company c ON c.id = cm.company_id
      WHERE m.user_id = ${session.user.id}
      ORDER BY o.name ASC
    `,
  ])

  const company = companyRows[0] ?? null
  const isAdmin = company?.role === "admin"

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações da Empresa</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie os dados fiscais, membros e convites da sua empresa.
        </p>
      </div>
      <CompanySettingsView
        company={company}
        members={membersRows}
        invitations={invitationsRows}
        workspaces={workspacesRows}
        currentUserId={session.user.id}
        isAdmin={isAdmin}
      />
    </div>
  )
}
