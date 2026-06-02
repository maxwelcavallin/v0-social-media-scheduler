"use client"

import { useState, useTransition, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Copy, RefreshCw, Eye, EyeOff, Trash2, Check, Instagram, Facebook, Zap, Terminal, ShieldCheck } from "lucide-react"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface Organization {
  id: string
  name: string
  slug: string
}

interface McpToken {
  id: string
  token: string
  created_at: string
  last_used_at: string | null
}

interface SocialAccount {
  id: string
  platform: "instagram" | "facebook"
  account_name: string
  account_username: string | null
  mcp_allowed: boolean
  is_active: boolean
}

interface Props {
  organizations: Organization[]
  initialOrgId: string
  initialToken: McpToken | null
  initialAccounts: SocialAccount[]
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export function McpIntegrationClient({
  organizations,
  initialOrgId,
  initialToken,
  initialAccounts,
}: Props) {
  const [orgId, setOrgId] = useState(initialOrgId)
  const [token, setToken] = useState<McpToken | null>(initialToken)
  const [accounts, setAccounts] = useState<SocialAccount[]>(initialAccounts)
  const [showToken, setShowToken] = useState(false)
  const [copied, setCopied] = useState<"token" | "url" | null>(null)
  const [isPending, startTransition] = useTransition()
  const [switchLoading, setSwitchLoading] = useState<string | null>(null)

  const mcpUrl = `${typeof window !== "undefined" ? window.location.origin : "https://social.list.dog"}/api/mcp/${orgId}`

  // Carrega dados ao trocar de workspace
  const handleOrgChange = useCallback(async (newOrgId: string) => {
    setOrgId(newOrgId)
    setToken(null)
    setAccounts([])
    startTransition(async () => {
      const [tokenRes, accountsRes] = await Promise.all([
        fetch(`/api/mcp/token?organizationId=${newOrgId}`).then((r) => r.json()),
        fetch(`/api/mcp/accounts-list?organizationId=${newOrgId}`).then((r) => r.json()),
      ])
      setToken(tokenRes.token ?? null)
      setAccounts(accountsRes.accounts ?? [])
    })
  }, [])

  const handleGenerateToken = () => {
    startTransition(async () => {
      const res = await fetch("/api/mcp/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      })
      const data = await res.json()
      if (data.token) setToken(data.token)
    })
  }

  const handleRevokeToken = async () => {
    startTransition(async () => {
      await fetch("/api/mcp/token", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      })
      setToken(null)
    })
  }

  const handleCopy = (value: string, type: "token" | "url") => {
    navigator.clipboard.writeText(value)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleToggleAccount = async (accountId: string, enabled: boolean) => {
    setSwitchLoading(accountId)
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, mcp_allowed: enabled } : a))
    )
    try {
      await fetch(`/api/mcp/accounts/${accountId}/permission`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mcp_allowed: enabled }),
      })
    } catch {
      // Reverte em caso de erro
      setAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? { ...a, mcp_allowed: !enabled } : a))
      )
    } finally {
      setSwitchLoading(null)
    }
  }

  const maskedToken = token ? `mcp_${"•".repeat(40)}` : ""

  return (
    <div className="space-y-6">

      {/* Seletor de Workspace */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Workspace</label>
        <Select value={orgId} onValueChange={handleOrgChange} disabled={isPending}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Selecione um workspace" />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isPending && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Card de Configuração MCP */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Terminal className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Servidor MCP</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Conecte o Claude ou outro cliente MCP usando as credenciais abaixo.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* URL do Servidor */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">URL do Servidor MCP</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted rounded-md px-3 py-2.5 font-mono text-foreground truncate border">
                {mcpUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => handleCopy(mcpUrl, "url")}
              >
                {copied === "url" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Protocolo: <strong>Streamable HTTP</strong> (com fallback SSE). Transport type: <code className="bg-muted px-1 rounded text-xs">http</code>.
            </p>
          </div>

          {/* Bearer Token */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bearer Token</label>
            {token ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted rounded-md px-3 py-2.5 font-mono text-foreground truncate border">
                    {showToken ? token.token : maskedToken}
                  </code>
                  <Button variant="outline" size="sm" onClick={() => setShowToken((v) => !v)}>
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(token.token, "token")}
                  >
                    {copied === "token" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Gerado em {new Date(token.created_at).toLocaleDateString("pt-BR")}.
                    {token.last_used_at && (
                      <> Último uso: {new Date(token.last_used_at).toLocaleString("pt-BR")}.</>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateToken}
                      disabled={isPending}
                      className="text-xs h-7"
                    >
                      <RefreshCw className="w-3 h-3 mr-1.5" />
                      Regenerar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-xs h-7 text-destructive hover:text-destructive">
                          <Trash2 className="w-3 h-3 mr-1.5" />
                          Revogar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revogar Bearer Token?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O Claude ou qualquer cliente MCP configurado com este token perderá acesso imediatamente. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleRevokeToken} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Revogar token
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-dashed p-4">
                <ShieldCheck className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Nenhum token gerado para este workspace.</p>
                </div>
                <Button size="sm" onClick={handleGenerateToken} disabled={isPending}>
                  {isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />}
                  Gerar token
                </Button>
              </div>
            )}
          </div>

          {/* Instruções de configuração Claude */}
          <div className="rounded-lg bg-muted/60 border px-4 py-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Como configurar no Claude</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
              <li>Abra as configurações do Claude e vá em <strong>Integrations &gt; Add MCP Server</strong>.</li>
              <li>Selecione o tipo de transporte <strong>HTTP</strong>.</li>
              <li>Cole a <strong>URL do Servidor</strong> acima no campo URL.</li>
              <li>Em <strong>Authorization Header</strong>, use <code className="bg-background px-1 rounded border text-[11px]">Bearer &lt;seu_token&gt;</code>.</li>
              <li>Ative as permissões das contas abaixo antes de usar.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Card de Ferramentas disponíveis */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ferramentas disponíveis</CardTitle>
          <CardDescription className="text-xs">
            O Claude pode usar estas ferramentas ao interagir com seu SocialDog.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {[
              { name: "listar_contas", desc: "Lista contas com permissão ativa" },
              { name: "listar_posts", desc: "Lista posts do workspace" },
              { name: "criar_post", desc: "Cria um rascunho de post" },
              { name: "agendar_post", desc: "Agenda post para data/hora" },
              { name: "publicar_agora", desc: "Publica imediatamente" },
            ].map((tool) => (
              <div key={tool.name} className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2.5">
                <code className="text-[11px] font-mono font-medium text-primary leading-relaxed">{tool.name}</code>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{tool.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Card de Permissões por Conta */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Permissões por conta</CardTitle>
          <CardDescription className="text-xs">
            Ative apenas as contas que a IA tem permissão para publicar ou agendar. Contas desativadas são bloqueadas mesmo que o Claude tente acessá-las.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <p className="text-sm text-muted-foreground">Nenhuma conta conectada neste workspace.</p>
              <p className="text-xs text-muted-foreground">Conecte contas do Instagram ou Facebook em <strong>Contas</strong>.</p>
            </div>
          ) : (
            <div className="divide-y">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      account.platform === "instagram"
                        ? "bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737]"
                        : "bg-blue-100 dark:bg-blue-950/30"
                    }`}>
                      {account.platform === "instagram"
                        ? <Instagram className="w-4 h-4 text-white" />
                        : <Facebook className="w-4 h-4 text-blue-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{account.account_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {account.account_username && (
                          <span className="text-xs text-muted-foreground">@{account.account_username}</span>
                        )}
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">
                          {account.platform}
                        </Badge>
                        {!account.is_active && (
                          <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Inativa</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="text-xs text-muted-foreground hidden sm:block">
                      Permitir que a IA publique/agende nesta conta
                    </label>
                    <Switch
                      checked={account.mcp_allowed}
                      onCheckedChange={(checked) => handleToggleAccount(account.id, checked)}
                      disabled={switchLoading === account.id || !account.is_active}
                      aria-label={`Permitir MCP para ${account.account_name}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
