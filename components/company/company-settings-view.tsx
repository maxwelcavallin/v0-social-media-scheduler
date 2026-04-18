"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Building2, Users, Mail, Trash2, Loader2, Plus, Copy, Check, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"

interface Company {
  id: string
  name: string
  document: string | null
  document_type: "cpf" | "cnpj" | null
  owner_id: string
  role: string
}

interface Member {
  user_id: string
  role: string
  name: string
  email: string
  member_workspaces: { id: string; name: string }[]
}

interface Invitation {
  id: string
  email: string
  role: string
  token: string
  created_at: string
  workspace_ids: string[]
}

interface Workspace {
  id: string
  name: string
}

interface Props {
  company: Company | null
  members: Member[]
  invitations: Invitation[]
  workspaces: Workspace[]
  currentUserId: string
  isAdmin: boolean
}

const companySchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  document_type: z.enum(["cpf", "cnpj"]),
  document: z.string().optional(),
})

const inviteSchema = z.object({
  email: z.string().email("E-mail inválido"),
  role: z.enum(["admin", "member"]),
  workspace_ids: z.array(z.string()).default([]),
})

type CompanyForm = z.infer<typeof companySchema>
type InviteForm = z.infer<typeof inviteSchema>

function formatDocument(value: string, type: "cpf" | "cnpj") {
  const digits = value.replace(/\D/g, "")
  if (type === "cpf") {
    return digits.slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
  }
  return digits.slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2")
}

export function CompanySettingsView({ company, members, invitations: initialInvitations, workspaces, currentUserId, isAdmin }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([])
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [memberWorkspaces, setMemberWorkspaces] = useState<Record<string, { id: string; name: string }[]>>(
    Object.fromEntries(members.map((m) => [m.user_id, m.member_workspaces ?? []]))
  )
  const [workspaceLoading, setWorkspaceLoading] = useState<string | null>(null)
  const [removingMember, setRemovingMember] = useState<string | null>(null)
  const [invitations, setInvitations] = useState<Invitation[]>(initialInvitations)
  const [currentMembers, setCurrentMembers] = useState<Member[]>(members)

  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [docValue, setDocValue] = useState(company?.document ?? "")
  const [creatingCompany, setCreatingCompany] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const companyForm = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: company?.name ?? "",
      document_type: company?.document_type ?? "cnpj",
      document: company?.document ?? "",
    },
  })

  const inviteForm = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: "member" },
  })

  const docType = companyForm.watch("document_type")

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDocument(e.target.value, docType)
    setDocValue(formatted)
    companyForm.setValue("document", formatted)
  }

  const onSaveCompany = async (data: CompanyForm) => {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const method = company ? "PATCH" : "POST"
      const res = await fetch("/api/company", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) { setSaveError(json.error || "Erro ao salvar."); return }
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      router.refresh()
    } catch {
      setSaveError("Erro inesperado.")
    } finally {
      setSaving(false)
    }
  }

  const onCreateCompany = async (data: CompanyForm) => {
    setCreatingCompany(true)
    setCreateError(null)
    try {
      const res = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) { setCreateError(json.error || "Erro ao criar empresa."); return }
      router.refresh()
    } catch {
      setCreateError("Erro inesperado.")
    } finally {
      setCreatingCompany(false)
    }
  }

  const handleToggleWorkspace = async (userId: string, workspaceId: string, currentlyIn: boolean) => {
    setWorkspaceLoading(workspaceId + userId)
    try {
      const res = await fetch(`/api/company/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, action: currentlyIn ? "remove" : "add" }),
      })
      if (!res.ok) return
      setMemberWorkspaces((prev) => {
        const current = prev[userId] ?? []
        if (currentlyIn) {
          return { ...prev, [userId]: current.filter((w) => w.id !== workspaceId) }
        } else {
          const ws = workspaces.find((w) => w.id === workspaceId)
          return { ...prev, [userId]: ws ? [...current, ws] : current }
        }
      })
    } finally {
      setWorkspaceLoading(null)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Tem certeza que deseja remover este membro da empresa e de todos os workspaces?")) return
    setRemovingMember(userId)
    try {
      const res = await fetch(`/api/company/members/${userId}`, { method: "DELETE" })
      if (!res.ok) return
      setCurrentMembers((prev) => prev.filter((m) => m.user_id !== userId))
    } finally {
      setRemovingMember(null)
    }
  }

  const onInvite = async (data: InviteForm) => {
    setInviting(true)
    setInviteError(null)
    try {
      const res = await fetch("/api/company/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, workspace_ids: selectedWorkspaces }),
      })
      const json = await res.json()
      if (!res.ok) { setInviteError(json.error || "Erro ao convidar."); return }
      setInvitations((prev) => [json.invitation, ...prev])
      inviteForm.reset()
      setSelectedWorkspaces([])
    } catch {
      setInviteError("Erro inesperado.")
    } finally {
      setInviting(false)
    }
  }

  const toggleWorkspace = (id: string) => {
    setSelectedWorkspaces((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    )
  }

  const onRevokeInvitation = async (token: string) => {
    await fetch(`/api/company/invitations/${token}/delete`, { method: "DELETE" })
    setInvitations((prev) => prev.filter((i) => i.token !== token))
  }

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`
    navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  // Sem empresa cadastrada
  if (!company) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Cadastre sua empresa</CardTitle>
              <CardDescription className="text-sm">Necessário para contratar planos e gerenciar membros.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={companyForm.handleSubmit(onCreateCompany)} className="flex flex-col gap-4">
            {createError && <Alert variant="destructive"><AlertDescription>{createError}</AlertDescription></Alert>}
            <div className="flex flex-col gap-1.5">
              <Label>Nome da empresa</Label>
              <Input placeholder="Acme Ltda." {...companyForm.register("name")} />
              {companyForm.formState.errors.name && <span className="text-xs text-destructive">{companyForm.formState.errors.name.message}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tipo de documento</Label>
              <div className="flex gap-2">
                {(["cnpj", "cpf"] as const).map((type) => (
                  <button key={type} type="button"
                    onClick={() => { companyForm.setValue("document_type", type); setDocValue(""); companyForm.setValue("document", "") }}
                    className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${docType === type ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-input hover:bg-muted"}`}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{docType === "cnpj" ? "CNPJ" : "CPF"}</Label>
              <Input placeholder={docType === "cnpj" ? "00.000.000/0001-00" : "000.000.000-00"} value={docValue} onChange={handleDocChange} />
            </div>
            <Button type="submit" disabled={creatingCompany} className="w-full">
              {creatingCompany ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Salvando...</> : "Cadastrar empresa"}
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Dados fiscais */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Dados da empresa</CardTitle>
              <CardDescription className="text-sm">Informações fiscais usadas para faturamento.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={companyForm.handleSubmit(onSaveCompany)} className="flex flex-col gap-4">
            {saveError && <Alert variant="destructive"><AlertDescription>{saveError}</AlertDescription></Alert>}
            {saveSuccess && <Alert><AlertDescription className="text-green-700">Dados salvos com sucesso.</AlertDescription></Alert>}

            <div className="flex flex-col gap-1.5">
              <Label>Nome da empresa</Label>
              <Input placeholder="Acme Ltda." {...companyForm.register("name")} disabled={!isAdmin} />
              {companyForm.formState.errors.name && <span className="text-xs text-destructive">{companyForm.formState.errors.name.message}</span>}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Tipo de documento</Label>
              <div className="flex gap-2">
                {(["cnpj", "cpf"] as const).map((type) => (
                  <button key={type} type="button" disabled={!isAdmin}
                    onClick={() => { companyForm.setValue("document_type", type); setDocValue(""); companyForm.setValue("document", "") }}
                    className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors disabled:opacity-50 ${docType === type ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-input hover:bg-muted"}`}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{docType === "cnpj" ? "CNPJ" : "CPF"}</Label>
              <Input
                placeholder={docType === "cnpj" ? "00.000.000/0001-00" : "000.000.000-00"}
                value={docValue}
                onChange={handleDocChange}
                disabled={!isAdmin}
              />
            </div>

            {isAdmin && (
              <Button type="submit" disabled={saving} className="self-start min-w-32">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Salvando...</> : "Salvar dados"}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Membros */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Membros da empresa</CardTitle>
              <CardDescription className="text-sm">{currentMembers.length} {currentMembers.length === 1 ? "membro" : "membros"}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border">
          {currentMembers.map((member) => {
            const isExpanded = expandedMember === member.user_id
            const userWorkspaces = memberWorkspaces[member.user_id] ?? []
            const isSelf = member.user_id === currentUserId
            return (
              <div key={member.user_id} className="py-3 first:pt-0 last:pb-0">
                {/* Linha principal do membro */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-medium text-muted-foreground">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{member.name} {isSelf && <span className="text-xs text-muted-foreground">(você)</span>}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={member.role === "admin" ? "default" : "secondary"} className="text-xs gap-1">
                      {member.role === "admin" && <ShieldCheck className="w-3 h-3" />}
                      {member.role === "admin" ? "Admin" : "Membro"}
                    </Badge>
                    {isAdmin && !isSelf && (
                      <>
                        {/* Toggle workspaces */}
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground gap-1"
                          onClick={() => setExpandedMember(isExpanded ? null : member.user_id)}
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          {userWorkspaces.length}
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </Button>
                        {/* Remover da empresa */}
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveMember(member.user_id)}
                          disabled={removingMember === member.user_id}
                          title="Remover da empresa"
                        >
                          {removingMember === member.user_id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Painel de workspaces expandível */}
                {isExpanded && isAdmin && !isSelf && (
                  <div className="mt-3 ml-11 rounded-md border border-border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Acesso aos workspaces</p>
                    {workspaces.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum workspace disponível.</p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {workspaces.map((ws) => {
                          const hasAccess = userWorkspaces.some((w) => w.id === ws.id)
                          const loadingThis = workspaceLoading === ws.id + member.user_id
                          return (
                            <label key={ws.id} className="flex items-center gap-2.5 py-1 px-1.5 rounded hover:bg-muted cursor-pointer">
                              <button
                                type="button"
                                onClick={() => handleToggleWorkspace(member.user_id, ws.id, hasAccess)}
                                disabled={loadingThis}
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                  hasAccess
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-input bg-background"
                                }`}
                              >
                                {loadingThis
                                  ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  : hasAccess && <Check className="w-2.5 h-2.5" />}
                              </button>
                              <span className="text-sm">{ws.name}</span>
                              {hasAccess && <span className="ml-auto text-xs text-muted-foreground">com acesso</span>}
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Convidar membros */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Convidar membros</CardTitle>
                <CardDescription className="text-sm">Envie um link de convite para novos membros.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form onSubmit={inviteForm.handleSubmit(onInvite)} className="flex flex-col gap-3">
              {inviteError && <Alert variant="destructive"><AlertDescription>{inviteError}</AlertDescription></Alert>}
              <div className="flex gap-2">
                <div className="flex-1 flex flex-col gap-1.5">
                  <Label>E-mail</Label>
                  <Input type="email" placeholder="colega@empresa.com" {...inviteForm.register("email")} />
                  {inviteForm.formState.errors.email && <span className="text-xs text-destructive">{inviteForm.formState.errors.email.message}</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Perfil</Label>
                  <select
                    {...inviteForm.register("role")}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="member">Membro</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              {workspaces.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label>Vincular aos workspaces</Label>
                  <p className="text-xs text-muted-foreground">Selecione os workspaces que o convidado terá acesso ao aceitar o convite.</p>
                  <div className="flex flex-col gap-1.5 mt-1 max-h-40 overflow-y-auto rounded-md border border-input p-2">
                    {workspaces.map((ws) => (
                      <label key={ws.id} className="flex items-center gap-2.5 py-1 px-1.5 rounded hover:bg-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedWorkspaces.includes(ws.id)}
                          onChange={() => toggleWorkspace(ws.id)}
                          className="w-4 h-4 rounded border-input accent-primary"
                        />
                        <span className="text-sm">{ws.name}</span>
                      </label>
                    ))}
                  </div>
                  {selectedWorkspaces.length > 0 && (
                    <p className="text-xs text-muted-foreground">{selectedWorkspaces.length} workspace{selectedWorkspaces.length > 1 ? "s" : ""} selecionado{selectedWorkspaces.length > 1 ? "s" : ""}</p>
                  )}
                </div>
              )}
              <Button type="submit" disabled={inviting} className="self-start gap-2">
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Gerar convite
              </Button>
            </form>

            {/* Convites pendentes */}
            {invitations.length > 0 && (
              <>
                <Separator />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Convites pendentes</p>
                <div className="flex flex-col gap-2">
                  {invitations.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{inv.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {inv.role === "admin" ? "Admin" : "Membro"}
                          {inv.workspace_ids?.length > 0 && ` · ${inv.workspace_ids.length} workspace${inv.workspace_ids.length > 1 ? "s" : ""}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyLink(inv.token)} title="Copiar link de convite">
                          {copiedToken === inv.token ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onRevokeInvitation(inv.token)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Planos */}
      <Card className={`border-primary/30 bg-primary/5 ${!company.document ? "opacity-60" : ""}`}>
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Contratar um plano</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {company.document
                ? "Seus dados fiscais estão completos. Você pode fazer upgrade."
                : "Preencha o CNPJ ou CPF acima para liberar o upgrade de plano."}
            </p>
          </div>
          <Link href="/dashboard/plans">
            <Button size="sm" disabled={!company.document} className="shrink-0">
              Ver planos
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
