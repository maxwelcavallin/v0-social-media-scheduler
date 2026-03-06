import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Clock, CheckCircle2, AlertCircle, Instagram, Facebook, Link2, ImageIcon } from "lucide-react"
import Link from "next/link"
import { EmptyState } from "@/components/dashboard/empty-state"
import { CreatePostDialog } from "@/components/posts/create-post-dialog"

interface Props {
  params: Promise<{ workspaceId: string }>
}

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="w-4 h-4" style={{ color: "oklch(0.52 0.25 15)" }} />,
  facebook: <Facebook className="w-4 h-4" style={{ color: "oklch(0.46 0.18 242)" }} />,
}

const platformColors: Record<string, string> = {
  instagram: "bg-[oklch(0.94_0.04_15)]",
  facebook: "bg-[oklch(0.94_0.04_242)]",
}

export default async function WorkspacePage({ params }: Props) {
  const { workspaceId } = await params
  const session = await getSession()
  if (!session) redirect("/login")

  const [workspace, accounts, recentPosts, stats] = await Promise.all([
    sql`
      SELECT o.id, o.name, o.slug
      FROM "organization" o
      JOIN "member" m ON o.id = m.organization_id
      WHERE o.id = ${workspaceId} AND m.user_id = ${session.user.id}
      LIMIT 1
    `,
    sql`
      SELECT id, platform, account_name, account_username, profile_picture_url, is_active
      FROM social_accounts
      WHERE workspace_id = ${workspaceId}
      ORDER BY created_at ASC
    `,
    sql`
      SELECT p.id, p.content, p.status, p.scheduled_at, p.created_at,
        ARRAY_AGG(DISTINCT pt.post_type) FILTER (WHERE pt.id IS NOT NULL) as post_types,
        ARRAY_AGG(DISTINCT sa.platform) FILTER (WHERE sa.id IS NOT NULL) as platforms,
        COUNT(DISTINCT pm.id)::int as media_count
      FROM posts p
      LEFT JOIN post_targets pt ON pt.post_id = p.id
      LEFT JOIN social_accounts sa ON sa.id = pt.social_account_id
      LEFT JOIN post_media pm ON pm.post_id = p.id
      WHERE p.workspace_id = ${workspaceId}
      GROUP BY p.id
      ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC
      LIMIT 6
    `,
    sql`
      SELECT
        COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'scheduled')::int as scheduled,
        COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'published')::int as published,
        COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'failed')::int as failed
      FROM posts p
      WHERE p.workspace_id = ${workspaceId}
    `,
  ])

  if (workspace.length === 0) notFound()

  const ws = workspace[0]
  const statsData = stats[0] || { scheduled: 0, published: 0, failed: 0 }

  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    draft: { label: "Rascunho", variant: "outline" },
    scheduled: { label: "Agendado", variant: "secondary" },
    published: { label: "Publicado", variant: "default" },
    failed: { label: "Falhou", variant: "destructive" },
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{ws.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">@{ws.slug}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/workspace/${workspaceId}/accounts`} className="gap-2">
              <Link2 className="w-4 h-4" />
              Contas
            </Link>
          </Button>
          <CreatePostDialog workspaceId={workspaceId} accounts={accounts}>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Post
            </Button>
          </CreatePostDialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Agendados</p>
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
                <p className="text-sm text-muted-foreground">Com erro</p>
                <p className="text-2xl font-bold text-foreground">{statsData.failed}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connected Accounts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Contas conectadas</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/workspace/${workspaceId}/accounts`}>Gerenciar</Link>
          </Button>
        </div>

        {accounts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Link2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">Nenhuma conta conectada</p>
              <p className="text-xs text-muted-foreground mb-4">
                Conecte suas contas do Facebook e Instagram para começar a publicar.
              </p>
              <Button size="sm" asChild>
                <Link href={`/workspace/${workspaceId}/accounts`} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Conectar contas
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-wrap gap-3">
            {accounts.map((acc: any) => (
              <div
                key={acc.id}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-border bg-card`}
              >
                <div className={`w-7 h-7 rounded-full ${platformColors[acc.platform] || "bg-muted"} flex items-center justify-center`}>
                  {platformIcons[acc.platform] || <Link2 className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate max-w-[120px]">{acc.account_name}</p>
                  {acc.account_username && (
                    <p className="text-xs text-muted-foreground">@{acc.account_username}</p>
                  )}
                </div>
                <div className={`w-2 h-2 rounded-full ${acc.is_active ? "bg-success" : "bg-destructive"}`} />
              </div>
            ))}

            <Link href={`/workspace/${workspaceId}/accounts`}>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer">
                <Plus className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Adicionar</span>
              </div>
            </Link>
          </div>
        )}
      </div>

      {/* Recent Posts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Posts recentes</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/workspace/${workspaceId}/calendar`}>Calendário</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/workspace/${workspaceId}/posts`}>Ver todos</Link>
            </Button>
          </div>
        </div>

        {recentPosts.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title="Nenhum post ainda"
            description="Crie seu primeiro post para este workspace e agende nas redes sociais."
            action={
              <CreatePostDialog workspaceId={workspaceId} accounts={accounts}>
                <Button className="gap-2" disabled={accounts.length === 0}>
                  <Plus className="w-4 h-4" />
                  Criar Post
                </Button>
              </CreatePostDialog>
            }
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentPosts.map((post: any) => {
              const status = statusMap[post.status] || { label: post.status, variant: "outline" as const }
              return (
                <Card key={post.id} className="hover:border-primary/30 transition-all">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-foreground line-clamp-2 flex-1">
                        {post.content || "Sem legenda"}
                      </p>
                      <Badge variant={status.variant} className="text-xs shrink-0">
                        {status.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        {(post.platforms || []).map((p: string) => (
                          <span key={p}>{platformIcons[p]}</span>
                        ))}
                      </div>
                      {post.scheduled_at && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(post.scheduled_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
