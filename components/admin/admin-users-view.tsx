"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Search, Shield, Loader2, Users } from "lucide-react"

interface AdminUser {
  id: string
  name: string
  email: string
  created_at: string
  is_super_admin: boolean
  plan: "free" | "pro"
  company_name: string | null
  workspace_count: number
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
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, plan } : u))
        )
        router.refresh()
      }
    } finally {
      setLoadingId(null)
    }
  }

  const freeCount = users.filter((u) => u.plan === "free").length
  const proCount = users.filter((u) => u.plan === "pro").length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Usuários da Plataforma</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os planos dos usuários cadastrados.
        </p>
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
                  {/* Avatar */}
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {user.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>

                  {/* Info */}
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

                  {/* Plano atual */}
                  <Badge
                    variant={user.plan === "pro" ? "default" : "secondary"}
                    className="shrink-0 text-xs"
                  >
                    {user.plan === "pro" ? "Pro" : "Grátis"}
                  </Badge>

                  {/* Seletor de plano — bloqueado para o próprio super admin */}
                  {user.id === currentUserId || user.is_super_admin ? (
                    <div className="w-28 shrink-0" />
                  ) : (
                    <div className="w-28 shrink-0 flex items-center gap-1">
                      {loadingId === user.id && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      )}
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

                  {/* Data de cadastro */}
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
    </div>
  )
}
