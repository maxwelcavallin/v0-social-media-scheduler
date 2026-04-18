import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Plus, ImageIcon, CheckCircle2, Clock } from "lucide-react"
import Link from "next/link"
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog"
import { WorkspaceActions } from "@/components/workspace/workspace-actions"
import { EmptyState } from "@/components/dashboard/empty-state"
import { RecentPostsFilter } from "@/components/dashboard/recent-posts-filter"

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [workspaces, recentPosts, stats, roleRows] = await Promise.all([
    sql`
      SELECT o.id, o.name, o.slug, o.logo, o.created_at,
        COUNT(DISTINCT sa.id)::int as accounts_count,
        COUNT(DISTINCT p.id)::int as posts_count
      FROM "organization" o
      JOIN "member" m ON o.id = m.organization_id
      LEFT JOIN social_accounts sa ON sa.workspace_id = o.id AND sa.is_active = true
      LEFT JOIN posts p ON p.workspace_id = o.id
      WHERE m.user_id = ${session.user.id}
      GROUP BY o.id, o.name, o.slug, o.logo, o.created_at
      ORDER BY o.created_at ASC
    `.catch(() => []),
    sql`
      SELECT p.id, p.content, p.status, p.scheduled_at, p.created_at,
        o.name as workspace_name,
        ARRAY_AGG(DISTINCT pt.post_type) FILTER (WHERE pt.id IS NOT NULL) as post_types,
        COALESCE(
          (SELECT JSON_AGG(JSON_BUILD_OBJECT('name', sa2.account_name, 'username', sa2.account_username))
           FROM post_targets pt2 JOIN social_accounts sa2 ON sa2.id = pt2.social_account_id
           WHERE pt2.post_id = p.id),
          '[]'::json
        ) as accounts
      FROM posts p
      JOIN "organization" o ON o.id = p.workspace_id
      JOIN "member" m ON o.id = m.organization_id
      LEFT JOIN post_targets pt ON pt.post_id = p.id
      WHERE m.user_id = ${session.user.id}
      GROUP BY p.id, p.content, p.status, p.scheduled_at, p.created_at, o.name
      ORDER BY p.created_at DESC
      LIMIT 5
    `.catch(() => []),
    sql`
      SELECT
        COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'scheduled')::int as scheduled,
        COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'published')::int as published,
        COUNT(DISTINCT sa.id)::int as connected_accounts
      FROM "organization" o
      JOIN "member" m ON o.id = m.organization_id
      LEFT JOIN posts p ON p.workspace_id = o.id
      LEFT JOIN social_accounts sa ON sa.workspace_id = o.id AND sa.is_active = true
      WHERE m.user_id = ${session.user.id}
    `.catch(() => []),
    sql`
      SELECT role FROM company_member WHERE user_id = ${session.user.id} LIMIT 1
    `.catch(() => []),
  ])

  const statsData = stats[0] || { scheduled: 0, published: 0, connected_accounts: 0 }
  const isAdmin = roleRows[0]?.role === "admin"

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Visão Geral</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Acompanhe todos os seus workspaces e publicações
          </p>
        </div>
        <CreateWorkspaceDialog>
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Workspace
          </Button>
        </CreateWorkspaceDialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Posts agendados</p>
                <p className="text-2xl font-bold text-foreground">{statsData.scheduled}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Publicados</p>
                <p className="text-2xl font-bold text-foreground">{statsData.published}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contas conectadas</p>
                <p className="text-2xl font-bold text-foreground">{statsData.connected_accounts}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workspaces */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Workspaces</h2>
          <span className="text-sm text-muted-foreground">{workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}</span>
        </div>

        {workspaces.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Nenhum workspace ainda"
            description="Crie seu primeiro workspace para começar a agendar posts para seus clientes."
            action={
              <CreateWorkspaceDialog>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Criar Workspace
                </Button>
              </CreateWorkspaceDialog>
            }
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws: any) => (
              <Link key={ws.id} href={`/workspace/${ws.id}`}>
                <Card className="hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer h-full relative group">
                  <WorkspaceActions workspace={ws} isAdmin={isAdmin} />
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0 pr-6">
                        <CardTitle className="text-base truncate">{ws.name}</CardTitle>
                        <CardDescription className="text-xs">@{ws.slug}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        {ws.accounts_count} conta{ws.accounts_count !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5" />
                        {ws.posts_count} post{ws.posts_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}

            <CreateWorkspaceDialog>
              <Card className="border-dashed hover:border-primary/40 cursor-pointer transition-all flex items-center justify-center min-h-[100px]">
                <div className="flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors p-6">
                  <Plus className="w-6 h-6" />
                  <span className="text-sm font-medium">Novo Workspace</span>
                </div>
              </Card>
            </CreateWorkspaceDialog>
          </div>
        )}
      </div>

      {/* Recent Posts */}
      {recentPosts.length > 0 && (
        <RecentPostsFilter posts={recentPosts as any} />
      )}
    </div>
  )
}
