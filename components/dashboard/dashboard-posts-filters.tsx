"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Workspace {
  id: string
  name: string
}

interface Account {
  id: string
  account_name: string
  account_username: string | null
  platform: string
  workspace_id: string
}

interface Props {
  workspaces: Workspace[]
  accounts: Account[]
  currentWorkspaceId: string | null
  currentAccountId: string | null
}

export function DashboardPostsFilters({ workspaces, accounts, currentWorkspaceId, currentAccountId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    // Ao trocar workspace, limpa o filtro de conta
    if (key === "workspace") params.delete("account")
    router.push(`${pathname}?${params.toString()}`)
  }

  // Filtra contas pelo workspace selecionado
  const filteredAccounts = currentWorkspaceId
    ? accounts.filter((a) => a.workspace_id === currentWorkspaceId)
    : accounts

  const platformLabel: Record<string, string> = {
    instagram: "Instagram",
    facebook: "Facebook",
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Select
        value={currentWorkspaceId ?? "all"}
        onValueChange={(v) => setParam("workspace", v === "all" ? null : v)}
      >
        <SelectTrigger className="h-8 text-sm w-44">
          <SelectValue placeholder="Todos os workspaces" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os workspaces</SelectItem>
          {workspaces.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentAccountId ?? "all"}
        onValueChange={(v) => setParam("account", v === "all" ? null : v)}
      >
        <SelectTrigger className="h-8 text-sm w-48">
          <SelectValue placeholder="Todas as contas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as contas</SelectItem>
          {filteredAccounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              <span className="text-muted-foreground text-xs mr-1">{platformLabel[a.platform] ?? a.platform}</span>
              {a.account_username ? `@${a.account_username}` : a.account_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
