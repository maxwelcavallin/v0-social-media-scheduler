import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Instagram, Facebook, Link2, Plus, Trash2, RefreshCw } from "lucide-react"
import { EmptyState } from "@/components/dashboard/empty-state"
import { ConnectMetaButton } from "@/components/accounts/connect-meta-button"
import { DisconnectAccountButton } from "@/components/accounts/disconnect-account-button"

interface Props {
  params: Promise<{ workspaceId: string }>
}

const platformConfig: Record<string, { icon: React.ReactNode; label: string; colorClass: string }> = {
  instagram: {
    icon: <Instagram className="w-5 h-5" style={{ color: "oklch(0.52 0.25 15)" }} />,
    label: "Instagram",
    colorClass: "bg-[oklch(0.93_0.05_15)]",
  },
  facebook: {
    icon: <Facebook className="w-5 h-5" style={{ color: "oklch(0.46 0.18 242)" }} />,
    label: "Facebook",
    colorClass: "bg-[oklch(0.93_0.05_242)]",
  },
}

export default async function AccountsPage({ params }: Props) {
  const { workspaceId } = await params
  const session = await getSession()
  if (!session) redirect("/login")

  const [workspace, accounts] = await Promise.all([
    sql`
      SELECT o.id, o.name
      FROM neon_auth.organization o
      JOIN neon_auth.member m ON o.id = m."organizationId"
      WHERE o.id = ${workspaceId} AND m."userId" = ${session.user.id}
      LIMIT 1
    `,
    sql`
      SELECT id, platform, account_name, account_username, profile_picture_url, is_active, last_sync_at, created_at
      FROM social_accounts
      WHERE workspace_id = ${workspaceId}
      ORDER BY platform, created_at ASC
    `,
  ])

  if (workspace.length === 0) notFound()

  const ws = workspace[0]
  const instagramAccounts = accounts.filter((a: any) => a.platform === "instagram")
  const facebookAccounts = accounts.filter((a: any) => a.platform === "facebook")

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas conectadas</h1>
          <p className="text-muted-foreground text-sm mt-1">{ws.name}</p>
        </div>
        <ConnectMetaButton workspaceId={workspaceId} />
      </div>

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Facebook className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Como funciona a conexão</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Faça login uma vez com o Facebook e o PostFlow identificará automaticamente todas as suas Páginas e contas do Instagram Business vinculadas ao Meta Business Suite. Nenhuma senha adicional é necessária.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="Nenhuma conta conectada"
          description="Conecte seu Facebook para descobrir automaticamente suas páginas e contas do Instagram Business."
          action={<ConnectMetaButton workspaceId={workspaceId} />}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Instagram */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Instagram className="w-4 h-4" style={{ color: "oklch(0.52 0.25 15)" }} />
              <h2 className="text-base font-semibold text-foreground">Instagram</h2>
              <Badge variant="outline" className="text-xs">{instagramAccounts.length}</Badge>
            </div>
            {instagramAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma conta Instagram conectada.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {instagramAccounts.map((acc: any) => (
                  <AccountCard key={acc.id} account={acc} config={platformConfig.instagram} />
                ))}
              </div>
            )}
          </div>

          {/* Facebook */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Facebook className="w-4 h-4" style={{ color: "oklch(0.46 0.18 242)" }} />
              <h2 className="text-base font-semibold text-foreground">Facebook</h2>
              <Badge variant="outline" className="text-xs">{facebookAccounts.length}</Badge>
            </div>
            {facebookAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma página Facebook conectada.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {facebookAccounts.map((acc: any) => (
                  <AccountCard key={acc.id} account={acc} config={platformConfig.facebook} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AccountCard({ account, config }: { account: any; config: any }) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${config.colorClass} flex items-center justify-center shrink-0`}>
            {account.profile_picture_url ? (
              <img
                src={account.profile_picture_url}
                alt={account.account_name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              config.icon
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground truncate">{account.account_name}</p>
              <div className={`w-2 h-2 rounded-full shrink-0 ${account.is_active ? "bg-success" : "bg-destructive"}`} />
            </div>
            {account.account_username && (
              <p className="text-xs text-muted-foreground">@{account.account_username}</p>
            )}
            {account.last_sync_at && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Última sincronização: {new Date(account.last_sync_at).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant={account.is_active ? "default" : "destructive"} className="text-xs">
              {account.is_active ? "Ativo" : "Inativo"}
            </Badge>
            <DisconnectAccountButton accountId={account.id} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
