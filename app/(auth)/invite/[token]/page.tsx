import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { redirect } from "next/navigation"
import { AcceptInviteView } from "@/components/company/accept-invite-view"

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const session = await getSession()

  const rows = await sql`
    SELECT ci.id, ci.email, ci.role, ci.accepted_at, c.name as company_name
    FROM company_invitation ci
    JOIN company c ON c.id = ci.company_id
    WHERE ci.token = ${token}
  `

  if (rows.length === 0) {
    redirect("/dashboard")
  }

  const invitation = rows[0]

  // Se já aceito, ir pro dashboard
  if (invitation.accepted_at) {
    redirect("/dashboard")
  }

  return (
    <AcceptInviteView
      token={token}
      invitation={invitation}
      isLoggedIn={!!session}
      currentUserEmail={session?.user?.email ?? null}
    />
  )
}
