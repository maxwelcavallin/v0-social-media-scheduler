import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import Link from "next/link"
import Image from "next/image"
import { Shield } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect("/login")

  const rows = await sql`SELECT is_super_admin FROM users WHERE id = ${session.user.id} LIMIT 1`
  if (!rows[0]?.is_super_admin) redirect("/dashboard")

  return (
    <div className="min-h-screen bg-background font-sans flex">
      {/* Sidebar admin */}
      <aside className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0 shrink-0">
        <div className="h-16 flex items-center px-4 border-b border-sidebar-border gap-2">
          <Image src="/logo-dog.png" alt="SocialDog" width={26} height={26} className="rounded-lg" />
          <div className="flex flex-col">
            <span className="font-bold text-sm text-sidebar-foreground leading-tight">SocialDog</span>
            <span className="text-xs text-amber-600 font-medium leading-tight">Super Admin</span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-3 flex flex-col gap-1">
          <Link
            href="/admin/users"
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium bg-sidebar-accent text-sidebar-primary"
          >
            <Shield className="w-4 h-4 shrink-0" />
            Usuários
          </Link>
        </nav>
        <div className="px-4 py-3 border-t border-sidebar-border">
          <Link
            href="/dashboard"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Voltar ao Dashboard
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border flex items-center px-6 bg-background">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-sm text-foreground">Painel de Administração</span>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
