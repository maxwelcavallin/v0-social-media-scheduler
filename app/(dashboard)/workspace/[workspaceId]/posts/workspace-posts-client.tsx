"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PostDetailsDialog } from "@/components/posts/post-details-dialog"
import { VideoThumbnail } from "@/components/posts/video-thumbnail"
import { PostActions } from "@/components/posts/post-actions"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { SendReviewDialog } from "@/components/posts/send-review-dialog"
import { ImageIcon, MessageSquare, LayoutGrid, List, Instagram, Facebook, Users, ChevronsUpDown, Check, X, SendHorizonal } from "lucide-react"
import { cn } from "@/lib/utils"

interface WorkspacePostsClientProps {
  posts: any[]
  accounts: any[]
  workspaceId: string
  platformIcons: Record<string, React.ReactNode>
  postTypeIcons: Record<string, React.ReactNode>
  statusMap: Record<string, any>
  reviewStatuses: string[]
}

type ViewMode = "grid" | "list"

const VIEW_MODE_KEY = "workspace-posts-view-mode"

export function WorkspacePostsClient({
  posts,
  accounts,
  workspaceId,
  platformIcons,
  postTypeIcons,
  statusMap,
  reviewStatuses,
}: WorkspacePostsClientProps) {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [filterAccountId, setFilterAccountId] = useState<string>("all")
  const [accOpen, setAccOpen] = useState(false)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)

  // Posts que são rascunhos (disponíveis para enviar à revisão)
  const draftPosts = useMemo(() =>
    posts.filter((p: any) => p.status === "draft"),
    [posts]
  )

  const filteredPosts = useMemo(() => {
    if (filterAccountId === "all") return posts
    return posts.filter((post: any) =>
      (post.account_ids || []).includes(filterAccountId)
    )
  }, [posts, filterAccountId])

  const selectedPost = filteredPosts.find(p => p.id === selectedPostId)

  // Carregar preferência de cookie
  useEffect(() => {
    const saved = document.cookie
      .split("; ")
      .find(row => row.startsWith(`${VIEW_MODE_KEY}=`))
      ?.split("=")[1]
    if (saved === "list" || saved === "grid") {
      setViewMode(saved)
    }
  }, [])

  // Salvar preferência em cookie
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    document.cookie = `${VIEW_MODE_KEY}=${mode}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
  }

  // Helpers
  const toUtcDate = (v: unknown): Date => {
    if (v instanceof Date) return v
    const s = String(v)
    return new Date(s.endsWith("Z") || s.includes("+") ? s : s + "Z")
  }
  const fmt = (d: Date) => new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  }).format(d)

  const selectedAccount = accounts.find((a: any) => a.id === filterAccountId)

  return (
    <>
      <SendReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        workspaceId={workspaceId}
        posts={draftPosts}
      />

      {/* Filtros + Toggle de visualização */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        {/* Filtro de conta */}
        {accounts.length > 0 && (
          <div className="flex items-center gap-2">
            <Popover open={accOpen} onOpenChange={setAccOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={accOpen}
                  className="h-9 w-[200px] justify-between text-sm font-normal"
                >
                  {selectedAccount ? (
                    <span className="flex items-center gap-2 truncate">
                      <Avatar className="w-5 h-5 shrink-0">
                        <AvatarImage src={selectedAccount.profile_picture_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {selectedAccount.platform === "instagram"
                            ? <Instagram className="w-3 h-3" style={{ color: "#C13584" }} />
                            : <Facebook className="w-3 h-3 text-blue-600" />}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">
                        {selectedAccount.account_username ? `@${selectedAccount.account_username}` : selectedAccount.account_name}
                      </span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="w-3.5 h-3.5" />
                      Todas as contas
                    </span>
                  )}
                  <ChevronsUpDown className="ml-1 w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar conta..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => { setFilterAccountId("all"); setAccOpen(false) }}
                      >
                        <Check className={cn("mr-2 w-4 h-4", filterAccountId === "all" ? "opacity-100" : "opacity-0")} />
                        <Users className="w-4 h-4 mr-1.5 text-muted-foreground" />
                        Todas as contas
                      </CommandItem>
                      {accounts.map((acc: any) => (
                        <CommandItem
                          key={acc.id}
                          value={`${acc.account_username || ""} ${acc.account_name || ""}`}
                          onSelect={() => { setFilterAccountId(acc.id); setAccOpen(false) }}
                        >
                          <Check className={cn("mr-2 w-4 h-4", filterAccountId === acc.id ? "opacity-100" : "opacity-0")} />
                          <Avatar className="w-5 h-5 mr-1.5 shrink-0">
                            <AvatarImage src={acc.profile_picture_url || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {acc.platform === "instagram"
                                ? <Instagram className="w-3 h-3" style={{ color: "#C13584" }} />
                                : <Facebook className="w-3 h-3 text-blue-600" />}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">
                            {acc.account_username ? `@${acc.account_username}` : acc.account_name}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {filterAccountId !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                onClick={() => setFilterAccountId("all")}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )}

        {/* Botão enviar para revisão + Toggle de visualização */}
        <div className="flex items-center gap-2 ml-auto">
          {draftPosts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-9"
              onClick={() => setReviewDialogOpen(true)}
            >
              <SendHorizonal className="w-4 h-4" />
              Enviar para aprovação
            </Button>
          )}
          <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/30">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={() => handleViewModeChange("grid")}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={() => handleViewModeChange("list")}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {viewMode === "grid" ? (
        /* ════════════════════════════════════════════════════════════════
           VISUALIZAÇÃO EM GRID (igual ao dashboard — 4 colunas em xl)
           ════════════════════════════════════════════════════════════════ */
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPosts.map((post: any) => {
            const postType = (post.post_types || [])[0] || "feed"
            const displayStatus = post.review_status && reviewStatuses.includes(post.review_status)
              ? post.review_status
              : post.status
            const status = statusMap[displayStatus] || { label: displayStatus, variant: "outline" as const }

            return (
              <Card
                key={post.id}
                className="overflow-hidden hover:border-primary/30 transition-all group"
              >
                <div
                  className="cursor-pointer"
                  onClick={() => setSelectedPostId(post.id)}
                >
                  <div
                    className="bg-muted relative overflow-hidden"
                    style={{ aspectRatio: (postType === "story" || postType === "reel") ? "9/16" : "4/5" }}
                  >
                    {post.thumbnail ? (
                      post.primary_media_type === "video" && post.thumbnail === post.primary_media_url ? (
                        <VideoThumbnail
                          videoUrl={post.thumbnail}
                          className="group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <img
                          src={post.thumbnail}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
                      </div>
                    )}

                    <div className="absolute top-2 left-2 flex gap-1">
                      {(post.platforms || []).map((p: string) => (
                        <div key={p} className="w-6 h-6 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center shadow-sm">
                          {platformIcons[p]}
                        </div>
                      ))}
                    </div>
                    <div className="absolute top-2 right-2">
                      <div className="flex items-center gap-1 bg-card/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm text-xs text-muted-foreground">
                        {postTypeIcons[postType]}
                        <span className="capitalize">{postType}</span>
                      </div>
                    </div>

                    {post.media_count > 1 && (
                      <div className="absolute bottom-2 right-2">
                        <Badge variant="secondary" className="text-xs shadow-sm">
                          1/{post.media_count}
                        </Badge>
                      </div>
                    )}
                    {post.review_status === "needs_changes" && post.review_notes && (
                      <div className="absolute bottom-2 right-2">
                        <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shadow-sm">
                          <MessageSquare className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  <CardContent className="p-3">
                    {(() => {
                      const ids: string[] = post.account_ids || []
                      const matched = accounts.filter((a: any) => ids.includes(a.id))
                      const names = matched.map((a: any) => a.account_username ? `@${a.account_username}` : a.account_name).filter(Boolean)
                      return names.length > 0 ? (
                        <p className="text-xs text-muted-foreground font-medium mb-1 truncate">{names.join(", ")}</p>
                      ) : null
                    })()}
                    <p className="text-sm text-foreground line-clamp-2 mb-2 leading-relaxed whitespace-pre-wrap">
                      {postType === "story" ? "Story" : (post.content || "Sem legenda")}
                    </p>
                    {post.status === "failed" && post.error_message && (
                      <p className="text-xs text-destructive bg-destructive/5 rounded px-2 py-1 mb-2 line-clamp-2 leading-relaxed">
                        {post.error_message}
                      </p>
                    )}
                  </CardContent>
                </div>

                <CardContent className="p-3 pt-0" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {(() => {
                        const dateToShow = post.published_at || post.scheduled_at
                        const label = post.status === "published" ? "Publicado " : post.scheduled_at ? "Agendado " : ""
                        if (dateToShow) return label + fmt(toUtcDate(dateToShow))
                        return fmt(toUtcDate(post.created_at))
                      })()}
                    </span>
                    <div className="flex items-center gap-1">
                      <Badge variant={status.variant} className={cn("text-xs", status.className)}>
                        {status.label}
                      </Badge>
                      <PostActions
                        workspaceId={workspaceId}
                        accounts={accounts}
                        post={{
                          id: post.id,
                          content: post.content,
                          status: post.status,
                          scheduled_at: post.scheduled_at,
                          post_type: (post.post_types || [])[0] || "feed",
                          accountIds: post.account_ids || [],
                          media: post.media || [],
                          cover_url: post.cover_url || undefined,
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        /* ════════════════════════════════════════════════════════════════
           VISUALIZAÇÃO EM LISTA (compacta)
           ════════════════════════════════════════════════════════════════ */
        <div className="flex flex-col gap-2">
          {filteredPosts.map((post: any) => {
            const postType = (post.post_types || [])[0] || "feed"
            const displayStatus = post.review_status && reviewStatuses.includes(post.review_status)
              ? post.review_status
              : post.status
            const status = statusMap[displayStatus] || { label: displayStatus, variant: "outline" as const }

            return (
              <Card
                key={post.id}
                className="overflow-hidden hover:border-primary/30 transition-all group"
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Thumbnail pequena */}
                  <div
                    className="w-14 h-14 shrink-0 bg-muted rounded-md overflow-hidden cursor-pointer relative"
                    onClick={() => setSelectedPostId(post.id)}
                  >
                    {post.thumbnail ? (
                      <img
                        src={post.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-muted-foreground/30" />
                      </div>
                    )}
                    {post.media_count > 1 && (
                      <Badge variant="secondary" className="absolute bottom-0.5 right-0.5 text-[10px] px-1 py-0">
                        {post.media_count}
                      </Badge>
                    )}
                  </div>

                  {/* Conteúdo */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setSelectedPostId(post.id)}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      {(post.platforms || []).slice(0, 2).map((p: string) => (
                        <span key={p} className="text-muted-foreground">{platformIcons[p]}</span>
                      ))}
                      <span className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                        {postTypeIcons[postType]}
                        {postType}
                      </span>
                      {(() => {
                        const ids: string[] = post.account_ids || []
                        const matched = accounts.filter((a: any) => ids.includes(a.id))
                        const names = matched.map((a: any) => a.account_username ? `@${a.account_username}` : a.account_name).filter(Boolean)
                        return names.length > 0 ? (
                          <span className="text-xs text-muted-foreground truncate max-w-[120px]">· {names[0]}</span>
                        ) : null
                      })()}
                    </div>
                    <p className="text-sm text-foreground line-clamp-1 leading-relaxed">
                      {postType === "story" ? "Story" : (post.content || "Sem legenda")}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {(() => {
                        const dateToShow = post.published_at || post.scheduled_at
                        const label = post.status === "published" ? "Publicado " : post.scheduled_at ? "Agendado " : ""
                        if (dateToShow) return label + fmt(toUtcDate(dateToShow))
                        return fmt(toUtcDate(post.created_at))
                      })()}
                    </span>
                  </div>

                  {/* Status e ações */}
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Badge variant={status.variant} className={cn("text-xs", status.className)}>
                      {status.label}
                    </Badge>
                    <PostActions
                      workspaceId={workspaceId}
                      accounts={accounts}
                      post={{
                        id: post.id,
                        content: post.content,
                        status: post.status,
                        scheduled_at: post.scheduled_at,
                        post_type: (post.post_types || [])[0] || "feed",
                        accountIds: post.account_ids || [],
                        media: post.media || [],
                        cover_url: post.cover_url || undefined,
                      }}
                    />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {selectedPost && (
        <PostDetailsDialog
          post={selectedPost}
          open={selectedPostId !== null}
          onOpenChange={(open) => !open && setSelectedPostId(null)}
          displayStatus={
            selectedPost.review_status && reviewStatuses.includes(selectedPost.review_status)
              ? selectedPost.review_status
              : selectedPost.status
          }
          statusMap={statusMap}
          accounts={accounts}
          workspaceId={workspaceId}
        />
      )}
    </>
  )
}
