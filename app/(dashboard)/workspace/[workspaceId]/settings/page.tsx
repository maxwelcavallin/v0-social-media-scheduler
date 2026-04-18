import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WorkspaceSettingsForm } from "@/components/workspace/workspace-settings-form"
import { WorkspaceDeleteSection } from "@/components/workspace/workspace-delete-section"

interface Props {
  params: Promise<{ workspaceId: string }>
}

export default async function WorkspaceSettingsPage({ params }: Props) {
  const { workspaceId } = await params
  const session = await getSession()
  if (!session) redirect("/login")

  const workspaces = await sql`
    SELECT o.id, o.name, o.slug
    FROM "organization" o
    JOIN "member" m ON o.id = m.organization_id
    WHERE o.id = ${workspaceId} AND m.user_id = ${session.user.id}
    LIMIT 1
  `

  if (workspaces.length === 0) notFound()
  const workspace = workspaces[0]

  const adminCheck = await sql`
    SELECT id FROM company_member
    WHERE user_id = ${session.user.id} AND role = 'admin'
    LIMIT 1
  `
  const isAdmin = adminCheck.length > 0

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie as informações do workspace
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações do Workspace</CardTitle>
          <CardDescription>
            Atualize o nome e identificador do workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceSettingsForm workspace={workspace} />
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Zona de Perigo</CardTitle>
            <CardDescription>
              Estas ações são irreversíveis. Tenha cuidado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WorkspaceDeleteSection workspace={workspace} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
