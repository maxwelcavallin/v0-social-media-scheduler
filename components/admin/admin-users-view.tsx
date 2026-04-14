"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Mic, Search, Shield, Loader2, Users, Eye, EyeOff, KeyRound, Info, Building2, Calendar, Layers } from "lucide-react"

interface AdminUser {
  id: string
  name: string
  email: string
  created_at: string
  is_super_admin: boolean
  plan: "free" | "pro"
  plan_updated_at: string | null
  company_id: string | null
  company_name: string | null
  company_document: string | null
  company_role: string | null
  workspace_count: number
  tts_enabled?: boolean
}

interface Props {
  users: AdminUser[]
  currentUserId: string
}

export function AdminUsersView({ users: initialUsers, currentUserId }: Props) {
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>(initialUsers)
  const [search, setSearch] = useState("")
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [filterPlan, setFilterPlan] = useState<string>("all")

  // Modal detalhes
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null)

  // Feature flags — mapa userId -> { tts_enabled }
  const [featureFlags, setFeatureFlags] = useState<Record<string, { tts_enabled: boolean }>>(() => {
    const map: Record<string, { tts_enabled: boolean }> = {}
    initialUsers.forEach((u) => { map[u.id] = { tts_enabled: u.tts_enabled ?? false } })
    return map
  })
  const [flagLoadingId, setFlagLoadingId] = useState<string | null>(null)

  const handleFlagToggle = async (userId: string, flag: string, value: boolean) => {
    setFlagLoadingId(userId + flag)
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, flag, value }),
      })
      if (res.ok) {
        setFeatureFlags((prev) => ({
          ...prev,
          [userId]: { ...prev[userId], [flag]: value },
        }))
      }
    } finally {
      setFlagLoadingId(null)
    }
  }

  // Modal troca de senha
  const [passwordUser, setPasswordUser] = useState<AdminUser | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        !search ||
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.company_name?.toLowerCase().includes(search.toLowerCase())
      const matchPlan = filterPlan === "all" || u.plan === filterPlan
      return matchSearch && matchPlan
    })
  }, [users, search, filterPlan])

  const handlePlanChange = async (userId: string, plan: "free" | "pro") => {
    setLoadingId(userId)
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, plan }),
      })
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, plan } : u)))
        if (detailUser?.id === userId) setDetailUser((d) => d ? { ...d, plan } : d)
        router.refresh()
      }
    } finally {
      setLoadingId(null)
    }
  }

  const handlePasswordChange = async () => {
    if (!passwordUser) return
    setPasswordLoading(true)
    setPasswordError(null)
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: passwordUser.id, newPassword }),
      })
      const json = await res.json()
      if (!res.ok) {
        setPasswordError(json.error || "Erro ao alterar senha")
      } else {
        setPasswordSuccess(true)
        setTimeout(() => {
          setPasswordUser(null)
          setNewPassword("")
          setPasswordSuccess(false)
        }, 1500)
      }
    } finally {
      setPasswordLoading(false)
    }
  }

  const freeCount = users.filter((u) => u.plan === "free").length
  const proCount = users.filter((u) => u.plan === "pro").length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Usuários da Plataforma</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie os planos e senhas dos usuários cadastrados.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold text-foreground">{users.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <span className="text-xs font-bold text-muted-foreground">G</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Plano Grátis</p>
              <p className="text-xl font-bold text-foreground">{freeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <span className="text-xs font-bold text-amber-600">P</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Plano Pro</p>
              <p className="text-xl font-bold text-foreground">{proCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            <SelectItem value="free">Grátis</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-0 px-6 pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {filtered.length} usuário{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          <div className="divide-y divide-border">
            {filtered.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground text-center">Nenhum usuário encontrado.</p>
            ) : (
              filtered.map((user) => (
                <div key={user.id} className="flex items-center gap-4 px-6 py-3">
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {user.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                      {user.is_super_admin && (
                        <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-300 shrink-0">
                          <Shield className="w-3 h-3" />
                          Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {user.company_name && (
                        <span className="text-xs text-muted-foreground/70 truncate">{user.company_name}</span>
                      )}
                      <span className="text-xs text-muted-foreground/50">
                        {user.workspace_count} workspace{user.workspace_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <Badge variant={user.plan === "pro" ? "default" : "secondary"} className="shrink-0 text-xs">
                    {user.plan === "pro" ? "Pro" : "Grátis"}
                  </Badge>

                  {/* Seletor de plano */}
                  {user.id === currentUserId || user.is_super_admin ? (
                    <div className="w-28 shrink-0" />
                  ) : (
                    <div className="w-28 shrink-0 flex items-center gap-1">
                      {loadingId === user.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                      <Select
                        value={user.plan}
                        onValueChange={(v) => handlePlanChange(user.id, v as "free" | "pro")}
                        disabled={loadingId === user.id}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Grátis</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Feature flags */}
                  <div className="flex items-center gap-2 shrink-0" title="Text to Voice">
                    {flagLoadingId === user.id + "tts_enabled"
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      : <Mic className="w-3.5 h-3.5 text-muted-foreground" />
                    }
                    <Switch
                      checked={featureFlags[user.id]?.tts_enabled ?? false}
                      onCheckedChange={(v) => handleFlagToggle(user.id, "tts_enabled", v)}
                      disabled={!!flagLoadingId}
                      aria-label="Ativar Text to Voice"
                    />
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setDetailUser(user)}
                      title="Ver detalhes"
                    >
                      <Info className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-muted-foreground hover:text-foreground"
                      onClick={() => { setPasswordUser(user); setNewPassword(""); setPasswordError(null); setPasswordSuccess(false) }}
                      title="Alterar senha"
                    >
                      <KeyRound className="w-4 h-4" />
                    </Button>
                  </div>

                  <span className="text-xs text-muted-foreground shrink-0 w-24 text-right">
                    {new Date(user.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      timeZone: "America/Sao_Paulo",
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal Detalhes do Usuário */}
      <Dialog open={!!detailUser} onOpenChange={(o) => { if (!o) setDetailUser(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Usuário</DialogTitle>
          </DialogHeader>
          {detailUser && (
            <div className="flex flex-col gap-5">
              {/* Dados pessoais */}
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="text-base bg-primary/10 text-primary">
                    {detailUser.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">{detailUser.name}</p>
                  <p className="text-sm text-muted-foreground">{detailUser.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cadastrado em{" "}
                    {new Date(detailUser.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo"
                    })}
                  </p>
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* Plano */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plano ativo</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={detailUser.plan === "pro" ? "default" : "secondary"}>
                      {detailUser.plan === "pro" ? "Pro" : "Grátis"}
                    </Badge>
                    {detailUser.plan_updated_at && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Atualizado em {new Date(detailUser.plan_updated_at).toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo"
                        })}
                      </span>
                    )}
                  </div>
                  {!detailUser.is_super_admin && detailUser.id !== currentUserId && (
                    <Select
                      value={detailUser.plan}
                      onValueChange={(v) => handlePlanChange(detailUser.id, v as "free" | "pro")}
                      disabled={loadingId === detailUser.id}
                    >
                      <SelectTrigger className="h-8 text-xs w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Grátis</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Layers className="w-3.5 h-3.5" />
                  {detailUser.workspace_count} workspace{detailUser.workspace_count !== 1 ? "s" : ""}
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* Empresa */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Empresa</p>
                {detailUser.company_name ? (
                  <div className="rounded-lg border bg-muted/30 p-3 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium text-foreground">{detailUser.company_name}</span>
                    </div>
                    {detailUser.company_document && (
                      <p className="text-xs text-muted-foreground pl-6">
                        CPF/CNPJ: <span className="font-mono">{detailUser.company_document}</span>
                      </p>
                    )}
                    {detailUser.company_role && (
                      <p className="text-xs text-muted-foreground pl-6 capitalize">
                        Papel: {detailUser.company_role === "owner" ? "Administrador" : detailUser.company_role}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada.</p>
                )}
              </div>

              <div className="h-px bg-border" />

              {/* Feature Flags */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Funcionalidades</p>
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Mic className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Text to Voice</p>
                      <p className="text-xs text-muted-foreground">Geração de áudio com IA</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {flagLoadingId === detailUser.id + "tts_enabled" && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    )}
                    <Switch
                      checked={featureFlags[detailUser.id]?.tts_enabled ?? false}
                      onCheckedChange={(v) => handleFlagToggle(detailUser.id, "tts_enabled", v)}
                      disabled={!!flagLoadingId}
                      aria-label="Ativar Text to Voice"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => { setDetailUser(null); setPasswordUser(detailUser); setNewPassword(""); setPasswordError(null); setPasswordSuccess(false) }}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Alterar senha
                </Button>
                <Button size="sm" onClick={() => setDetailUser(null)}>Fechar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Alterar Senha */}
      <Dialog open={!!passwordUser} onOpenChange={(o) => { if (!o) { setPasswordUser(null); setNewPassword(""); setPasswordError(null) } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
          </DialogHeader>
          {passwordUser && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Definindo nova senha para <span className="font-medium text-foreground">{passwordUser.name}</span>
                <span className="text-muted-foreground/70"> ({passwordUser.email})</span>
              </p>

              {passwordError && (
                <p className="text-sm text-destructive">{passwordError}</p>
              )}
              {passwordSuccess && (
                <p className="text-sm text-green-600 font-medium">Senha alterada com sucesso!</p>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => { setPasswordUser(null); setNewPassword("") }} disabled={passwordLoading}>
                  Cancelar
                </Button>
                <Button
                  onClick={handlePasswordChange}
                  disabled={passwordLoading || newPassword.length < 6 || passwordSuccess}
                  className="gap-2"
                >
                  {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  Salvar senha
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
