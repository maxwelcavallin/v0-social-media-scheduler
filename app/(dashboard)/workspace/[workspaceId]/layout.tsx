import { redirect, notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"

interface Props {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}

export default async function WorkspaceLayout({ children, params }: Props) {
  const { workspaceId } = await params
  const session = await getSession()

  if (!session) redirect("/login")

  // Verify user has access to this workspace
  const membership = await sql`
    SELECT m.role, o.name
    FROM "member" m
    JOIN "organization" o ON o.id = m.organization_id
    WHERE m.user_id = ${session.user.id}
      AND m.organization_id = ${workspaceId}
    LIMIT 1
  `

  if (membership.length === 0) notFound()

  return <>{children}</>
}
