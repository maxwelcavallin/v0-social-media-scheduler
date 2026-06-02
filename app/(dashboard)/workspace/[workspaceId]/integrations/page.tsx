import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { McpIntegrationClient } from "@/components/integrations/mcp-integration-client"

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

export const metadata = {
  title: "Integrações | SocialDog",
  description: "Gerencie integrações MCP e permissões de IA para publicação.",
}

export default async function IntegrationsPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user) redirect("/login")

  const { workspaceId } = await params

  // Busca todos os workspaces do usuário para o seletor
  const organizations = await sql`
    SELECT o.id, o.name, o.slug
    FROM organization o
    INNER JOIN member m ON m."organizationId" = o.id
    WHERE m."userId" = ${session.user.id}
    ORDER BY o.name
  `

  // Token e contas do workspace atual
  const [tokenRows, accounts] = await Promise.all([
    sql`SELECT id, token, created_at, last_used_at FROM mcp_tokens WHERE organization_id = ${workspaceId}`,
    sql`
      SELECT id, platform, account_name, account_username, mcp_allowed, is_active
      FROM social_accounts
      WHERE workspace_id = ${workspaceId}
        AND platform IN ('instagram', 'facebook')
      ORDER BY platform, account_name
    `,
  ])

  return (
    <div className="max-w-3xl space-y-1">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Integrações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure o servidor MCP para permitir que o Claude e outros clientes de IA publiquem e agendem posts em seu nome.
        </p>
      </div>

      <McpIntegrationClient
        organizations={organizations as any}
        initialOrgId={workspaceId}
        initialToken={tokenRows[0] ?? null}
        initialAccounts={accounts as any}
      />
    </div>
  )
}
