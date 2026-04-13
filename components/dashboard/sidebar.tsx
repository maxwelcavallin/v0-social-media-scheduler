"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard,
  CalendarDays,
  ImageIcon,
  Settings,
  Plus,
  ChevronDown,
  Building2,
  Link2,
  Zap,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog"

interface Workspace {
  id: string
  name: string
  slug: string
  logo: string | null
}

interface User {
  id: string
  name: string
  email: string
  image?: string | null
}

interface Company {
  id: string
  name: string
  document: string | null
  role: string
}

interface Props {
  workspaces: Workspace[]
  user: User
  plan?: "free" | "pro"
  company?: Company | null
  isSuperAdmin?: boolean
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/calendar", label: "Calendário", icon: CalendarDays },
  { href: "/dashboard/posts", label: "Posts", icon: ImageIcon },
  { href: "/dashboard/plans", label: "Planos", icon: Zap },
  { href: "/dashboard/settings", label: "Configurações", icon: Settings },
]

const workspaceNavItems = (workspaceId: string) => [
  { href: `/workspace/${workspaceId}`, label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: `/workspace/${workspaceId}/calendar`, label: "Calendário", icon: CalendarDays },
  { href: `/workspace/${workspaceId}/posts`, label: "Posts", icon: ImageIcon },
  { href: `/workspace/${workspaceId}/accounts`, label: "Contas", icon: Link2 },
  { href: `/workspace/${workspaceId}/settings`, label: "Configurações", icon: Settings },
]

export function DashboardSidebar({ workspaces, user, plan = "free", company, isSuperAdmin }: Props) {
  const pathname = usePathname()
  const [createOpen, setCreateOpen] = useState(false)

  // Determine active workspace
  const activeWorkspaceId = pathname.startsWith("/workspace/")
    ? pathname.split("/")[2]
    : null
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)

  const currentNav = activeWorkspaceId
    ? workspaceNavItems(activeWorkspaceId)
    : navItems

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href) && pathname !== "/dashboard"
  }

  return (
    <>
      <aside className="w-60 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0 shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/logo-dog.png" alt="SocialDog" width={28} height={28} className="rounded-lg" />
            <span className="font-bold text-base text-sidebar-foreground">SocialDog</span>
          </Link>
        </div>

        {/* Empresa */}
        {company ? (
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2 px-4 py-2 border-b border-sidebar-border hover:bg-sidebar-accent/50 transition-colors"
          >
            <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center shrink-0">
              <Building2 className="w-3 h-3 text-primary" />
            </div>
            <span className="text-xs font-medium text-sidebar-foreground/70 truncate">{company.name}</span>
          </Link>
        ) : (
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2 px-4 py-2 border-b border-sidebar-border text-xs text-amber-600 hover:bg-sidebar-accent/50 transition-colors"
          >
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Cadastrar empresa</span>
          </Link>
        )}

        {/* Workspace switcher */}
        <div className="px-3 py-3 border-b border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between h-9 px-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {activeWorkspace ? (
                    <>
                      <div className="w-5 h-5 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
                        <Building2 className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-sm font-medium truncate">{activeWorkspace.name}</span>
                    </>
                  ) : (
                    <>
                      <div className="w-5 h-5 rounded-md bg-sidebar-accent flex items-center justify-center shrink-0">
                        <LayoutDashboard className="w-3 h-3 text-sidebar-foreground" />
                      </div>
                      <span className="text-sm font-medium">Visão Geral</span>
                    </>
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-sidebar-foreground/50 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Visão Geral</span>
                </Link>
              </DropdownMenuItem>
              {workspaces.length > 0 && <DropdownMenuSeparator />}
              {workspaces.map((ws) => (
                <DropdownMenuItem key={ws.id} asChild>
                  <Link href={`/workspace/${ws.id}`} className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span className="truncate">{ws.name}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCreateOpen(true)} className="gap-2 text-primary">
                <Plus className="w-4 h-4" />
                <span>Novo workspace</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 flex flex-col gap-1">
          {currentNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors",
                isActive(item.href, item.exact)
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          ))}

          {/* All workspaces */}
          {!activeWorkspaceId && workspaces.length > 0 && (
            <>
              <Separator className="my-2" />
              <p className="text-xs font-medium text-sidebar-foreground/40 px-2.5 py-1 uppercase tracking-wider">
                Workspaces
              </p>
              {workspaces.map((ws) => (
                <Link
                  key={ws.id}
                  href={`/workspace/${ws.id}`}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
                >
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span className="truncate">{ws.name}</span>
                </Link>
              ))}
              <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium text-primary/70 hover:text-primary hover:bg-sidebar-accent/50 transition-colors"
              >
                <Plus className="w-4 h-4 shrink-0" />
                Novo workspace
              </button>
            </>
          )}
        </nav>

        {/* Banner upgrade plano free */}
        {plan === "free" && (
          <div className="mx-3 mb-2 rounded-lg bg-primary/10 border border-primary/20 p-3 flex flex-col gap-2">
            <p className="text-xs font-semibold text-primary">Plano Grátis</p>
            <p className="text-xs text-muted-foreground leading-relaxed">Faça upgrade para posts e contas ilimitados.</p>
            <Link
              href="/dashboard/plans"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Zap className="w-3 h-3" />
              Ver planos
            </Link>
          </div>
        )}

        {/* Super Admin link */}
        {isSuperAdmin && (
          <Link
            href="/admin/users"
            className="mx-3 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-300/30 text-xs font-medium text-amber-600 hover:bg-amber-500/20 transition-colors"
          >
            <Shield className="w-3.5 h-3.5 shrink-0" />
            Painel Admin
          </Link>
        )}

        {/* User */}
        <div className="px-3 py-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5 px-2">
            <Avatar className="w-7 h-7">
              <AvatarImage src={user.image ?? undefined} />
              <AvatarFallback className="text-xs bg-primary/20 text-primary">
                {user.name?.charAt(0)?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}
