import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import { ConnectInstagramButton } from "@/components/accounts/connect-instagram-button"
import { ConnectMetaButton } from "@/components/accounts/connect-meta-button"
import { DisconnectAccountButton } from "@/components/accounts/disconnect-account-button"
import { InstagramTestButton } from "@/components/accounts/instagram-test-button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Instagram, Facebook, AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { WebhookPanel } from "@/components/accounts/webhook-panel"
import { ReconnectAccountButton } from "@/components/accounts/reconnect-account-button"

interface Props {
  params: Promise<{ workspaceId: string }>
}

function getTokenStatus(tokenExpiresAt: string | null): {
  label: string
  daysLeft: number | null
  variant: "ok" | "warning" | "expired" | "unknown"
} {
  if (!tokenExpiresAt) return { label: "Token permanente", daysLeft: null, variant: "ok" }
  const expires = new Date(tokenExpiresAt)
  const now = new Date()
  const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (daysLeft <= 0) return { label: "Token expirado", daysLeft: 0, variant: "expired" }
  if (daysLeft <= 7) return { label: `Token expira em ${daysLeft} dia${daysLeft === 1 ? "" : "s"}`, daysLeft, variant: "warning" }
  return { label: `Token válido por ${daysLeft} dias`, daysLeft, variant: "ok" }
}

export default async function AccountsPage({ params }: Props) {
  const { workspaceId } = await params
  const session = await getSession()
  if (!session) redirect("/login")

  const [workspace, accounts, roleRows] = await Promise.all([
    sql`
      SELECT o.id, o.name
      FROM "organization" o
      JOIN "member" m ON o.id = m.organization_id
      WHERE o.id = ${workspaceId} AND m.user_id = ${session.user.id}
      LIMIT 1
    `,
    sql`
      SELECT id, platform, account_name, account_username, profile_picture_url,
             is_active, last_sync_at, created_at, token_expires_at, page_id, needs_reconnect
      FROM social_accounts
      WHERE workspace_id = ${workspaceId}
      ORDER BY platform, created_at ASC
    `,
    sql`
      SELECT cm.role
      FROM company_member cm
      JOIN company c ON c.id = cm.company_id
      WHERE cm.user_id = ${session.user.id}
      LIMIT 1
    `,
  ])

  if (workspace.length === 0) notFound()

  const ws = workspace[0]
  const isAdmin = roleRows[0]?.role === "admin"
  const instagramAccounts = accounts.filter((a: any) => a.platform === "instagram")
  const facebookAccounts = accounts.filter((a: any) => a.platform === "facebook")

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas conectadas</h1>
          <p className="text-sm text-muted-foreground mt-1">{ws.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <ConnectMetaButton workspaceId={workspaceId} />
          <ConnectInstagramButton workspaceId={workspaceId} />
        </div>
      </div>


      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] flex items-center justify-center">
            <Instagram className="w-10 h-10 text-white" />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-lg font-semibold text-foreground">Nenhuma conta conectada</p>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              Conecte sua conta do Instagram Business ou Creator para começar a agendar posts.
            </p>
          </div>
          <ConnectInstagramButton workspaceId={workspaceId} />
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
            Sua conta precisa ser do tipo Business ou Creator. Contas pessoais não são suportadas pela API oficial do Meta.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Instagram */}
          {instagramAccounts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Instagram className="w-4 h-4" style={{ color: "#C13584" }} />
                <h2 className="text-base font-semibold text-foreground">Instagram</h2>
                <Badge variant="outline" className="text-xs">{instagramAccounts.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {instagramAccounts.map((acc: any) => (
                  <InstagramAccountCard key={acc.id} account={acc} isAdmin={isAdmin} workspaceId={workspaceId} />
                ))}
              </div>
            </div>
          )}

          {/* Facebook */}
          {facebookAccounts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Facebook className="w-4 h-4 text-blue-600" />
                <h2 className="text-base font-semibold text-foreground">Facebook</h2>
                <Badge variant="outline" className="text-xs">{facebookAccounts.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {facebookAccounts.map((acc: any) => (
                  <FacebookAccountCard key={acc.id} account={acc} workspaceId={workspaceId} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InstagramAccountCard({ account, isAdmin, workspaceId }: { account: any; isAdmin: boolean; workspaceId: string }) {
  const token = getTokenStatus(account.token_expires_at)

  const borderColor =
    token.variant === "expired" ? "border-red-300" :
    token.variant === "warning" ? "border-amber-300" :
    "border-border"

  const TokenIcon =
    token.variant === "expired" ? XCircle :
    token.variant === "warning" ? AlertTriangle :
    CheckCircle2

  const tokenColor =
    token.variant === "expired" ? "text-red-500" :
    token.variant === "warning" ? "text-amber-500" :
    "text-emerald-500"

  return (
    <Card className={`hover:shadow-md transition-shadow ${borderColor}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar — usa apenas o ícone do Instagram, sem foto de perfil */}
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] flex items-center justify-center">
              <Instagram className="w-5 h-5 text-white" />
            </div>
            {account.is_active && token.variant !== "expired" && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-background" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {account.account_username ? `@${account.account_username}` : account.account_name}
            </p>
            {account.account_username && account.account_name !== account.account_username && (
              <p className="text-xs text-muted-foreground truncate">{account.account_name}</p>
            )}

            {/* Token status */}
            <div className={`flex items-center gap-1 mt-1.5 ${tokenColor}`}>
              <TokenIcon className="w-3 h-3 shrink-0" />
              <span className="text-xs font-medium">{token.label}</span>
            </div>

            {/* Conectado em */}
            <p className="text-[11px] text-muted-foreground mt-1">
              Conectado em {new Date(account.created_at).toLocaleDateString("pt-BR")}
            </p>
          </div>

          {/* Actions */}
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <DisconnectAccountButton accountId={account.id} />
            {account.needs_reconnect && <ReconnectAccountButton platform="instagram" workspaceId={workspaceId} />}
            {isAdmin && !account.page_id && (
              <InstagramTestButton
                accountId={account.id}
                accountUsername={account.account_username}
              />
            )}
          </div>
        </div>

        {account.needs_reconnect && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
              Reconexão necessária. Esta conta falhou ao publicar por falta de permissões. Clique em <strong>Reconectar</strong> para corrigir.
            </p>
          </div>
        )}

        <WebhookPanel accountId={account.id} />
      </CardContent>
    </Card>
  )
}

function FacebookAccountCard({ account, workspaceId }: { account: any; workspaceId: string }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
            <Facebook className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{account.account_name}</p>
            {account.account_username && (
              <p className="text-xs text-muted-foreground">@{account.account_username}</p>
            )}
            <div className="flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span className="text-xs text-emerald-600 font-medium">Ativo</span>
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <DisconnectAccountButton accountId={account.id} />
            {account.needs_reconnect && <ReconnectAccountButton platform="facebook" workspaceId={workspaceId} />}
          </div>
        </div>

          {account.needs_reconnect && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
                Reconexão necessária. Esta conta falhou ao publicar por falta de permissões. Clique em <strong>Reconectar</strong> para corrigir.
              </p>
            </div>
          )}

          <WebhookPanel accountId={account.id} />
      </CardContent>
    </Card>
  )
}
