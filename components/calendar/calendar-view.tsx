"use client"

import { useState } from "react"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ChevronLeft,
  ChevronRight,
  Instagram,
  Facebook,
  ImageIcon,
  Film,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  CalendarClock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

const parseBrasilia = (iso: string): Date => {
  const utc = new Date(iso)
  const brasiliaOffset = -3 * 60
  const localOffset = utc.getTimezoneOffset()
  const diff = (localOffset + brasiliaOffset) * 60 * 1000
  return new Date(utc.getTime() - diff)
}

const formatTimeBrasilia = (iso: string): string =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))

// Paleta de cores para usernames — atribuída por índice estável
const USERNAME_COLORS = [
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
]

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; badge: string; dot: string }> = {
  scheduled: {
    label: "Agendado",
    icon: <CalendarClock className="w-3.5 h-3.5" />,
    badge: "bg-primary/10 text-primary border-primary/20",
    dot: "bg-primary",
  },
  published: {
    label: "Publicado",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  failed: {
    label: "Falhou",
    icon: <XCircle className="w-3.5 h-3.5" />,
    badge: "bg-destructive/10 text-destructive border-destructive/20",
    dot: "bg-destructive",
  },
  draft: {
    label: "Rascunho",
    icon: <FileText className="w-3.5 h-3.5" />,
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
}

const POST_TYPE_LABELS: Record<string, string> = {
  feed: "Feed",
  reel: "Reel",
  carousel: "Carrossel",
  story: "Story",
}

interface Account {
  id: string
  platform: string
  account_name: string
  account_username?: string
  profile_picture_url?: string
}

interface Post {
  id: string
  content: string
  status: string
  scheduled_at: string
  platforms?: string[]
  post_types?: string[]
  post_type?: string
  media_count?: number
  thumbnail?: string
  cover_url?: string
  media?: { url: string; media_type: string }[]
  account_ids?: string[]
  account_usernames?: string[]
  workspace_name?: string
  workspace_id?: string
}

interface Props {
  posts: Post[]
  accounts?: Account[]
  workspaceId?: string
  showWorkspace?: boolean
}

export function CalendarView({ posts, accounts = [], workspaceId, showWorkspace }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { locale: ptBR })
  const calEnd = endOfWeek(monthEnd, { locale: ptBR })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

  // Mapear account_id → username e índice de cor estável
  const accountColorMap = new Map<string, number>()
  accounts.forEach((a, i) => accountColorMap.set(a.id, i % USERNAME_COLORS.length))

  const getPostsForDay = (day: Date) =>
    posts.filter((p) => p.scheduled_at && isSameDay(parseBrasilia(p.scheduled_at), day))

  const selectedDayPosts = selectedDay ? getPostsForDay(selectedDay) : []

  // Para cada post, pegar os usernames das contas vinculadas
  const getAccountsForPost = (post: Post): Account[] => {
    if (!post.account_ids || post.account_ids.length === 0) return []
    return post.account_ids
      .map((id) => accounts.find((a) => a.id === id))
      .filter(Boolean) as Account[]
  }

  const handleDayClick = (day: Date) => {
    if (getPostsForDay(day).length > 0) {
      setSelectedDay(day)
      setSheetOpen(true)
    }
  }

  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground capitalize">
            {format(currentDate, "MMMM yyyy", { locale: ptBR })}
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())} className="text-xs h-8 px-3">
              Hoje
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Week days */}
        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map((day) => (
            <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dayPosts = getPostsForDay(day)
            const isCurrentMonth = isSameMonth(day, currentDate)
            const isTodayDay = isToday(day)
            const hasPost = dayPosts.length > 0

            return (
              <div
                key={day.toISOString()}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "min-h-[84px] p-1.5 border-r border-b border-border transition-colors",
                  !isCurrentMonth && "bg-muted/30",
                  hasPost && "cursor-pointer hover:bg-accent/40",
                  idx % 7 === 6 && "border-r-0"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    isTodayDay ? "bg-primary text-primary-foreground"
                    : isCurrentMonth ? "text-foreground"
                    : "text-muted-foreground/40"
                  )}>
                    {format(day, "d")}
                  </span>
                  {dayPosts.length > 1 && (
                    <span className="text-xs text-muted-foreground font-medium">{dayPosts.length}</span>
                  )}
                </div>

                <div className="flex flex-col gap-0.5">
                  {dayPosts.slice(0, 3).map((post) => {
                    const status = STATUS_CONFIG[post.status] || STATUS_CONFIG.draft
                    // Pegar o primeiro username disponível para mostrar no card
                    const postAccounts = getAccountsForPost(post)
                    const firstAccount = postAccounts[0]
                    const colorIdx = firstAccount
                      ? (accountColorMap.get(firstAccount.id) ?? 0)
                      : 0
                    const username = firstAccount?.account_username || firstAccount?.account_name

                    return (
                      <div
                        key={post.id}
                        className={cn(
                          "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs",
                          "border",
                          post.status === "scheduled" && "bg-primary/8 border-primary/15",
                          post.status === "published" && "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800",
                          post.status === "failed" && "bg-destructive/8 border-destructive/15",
                          post.status === "draft" && "bg-muted border-border",
                        )}
                      >
                        {/* Ícone de status */}
                        <span className={cn("shrink-0", status.dot === "bg-primary" ? "text-primary" : status.dot === "bg-emerald-500" ? "text-emerald-500" : status.dot === "bg-destructive" ? "text-destructive" : "text-muted-foreground")}>
                          {status.icon}
                        </span>
                        {/* Username colorido */}
                        {username ? (
                          <span className={cn(
                            "truncate text-[10px] font-medium px-1 rounded",
                            USERNAME_COLORS[colorIdx]
                          )}>
                            @{username}
                          </span>
                        ) : (
                          <span className="truncate text-muted-foreground text-[10px]">Post</span>
                        )}
                      </div>
                    )
                  })}
                  {dayPosts.length > 3 && (
                    <span className="text-xs text-muted-foreground px-1">+{dayPosts.length - 3} mais</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="capitalize text-base">
              {selectedDay && format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="flex flex-col gap-4 px-6 py-4">
              {selectedDayPosts.map((post) => {
                const status = STATUS_CONFIG[post.status] || STATUS_CONFIG.draft
                const postAccounts = getAccountsForPost(post)
                const postType = post.post_type || (post.post_types || [])[0] || "feed"
                const mediaItems = post.media || []
                const hasVideo = mediaItems.some((m) => m.media_type === "video") || postType === "reel"

                return (
                  <div key={post.id} className="border border-border rounded-xl overflow-hidden">
                    {/* Thumbnail */}
                    {post.thumbnail && (
                      <div className="relative w-full h-48 bg-black">
                        {hasVideo ? (
                          <video
                            src={post.thumbnail}
                            className="w-full h-full object-cover"
                            muted
                          />
                        ) : (
                          <img src={post.thumbnail} alt="" className="w-full h-full object-cover" />
                        )}
                        {/* Tipo de post + mídia count overlay */}
                        <div className="absolute bottom-2 left-2 flex gap-1.5">
                          <span className="text-xs bg-black/60 text-white px-2 py-0.5 rounded-full backdrop-blur-sm font-medium">
                            {POST_TYPE_LABELS[postType] || postType}
                          </span>
                          {(post.media_count ?? 0) > 1 && (
                            <span className="text-xs bg-black/60 text-white px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" />
                              {post.media_count}
                            </span>
                          )}
                          {hasVideo && postType !== "reel" && (
                            <span className="text-xs bg-black/60 text-white px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1">
                              <Film className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="p-4 flex flex-col gap-3">
                      {/* Status */}
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
                          status.badge
                        )}>
                          {status.icon}
                          {status.label}
                        </span>
                        {post.scheduled_at && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatTimeBrasilia(post.scheduled_at)}
                          </span>
                        )}
                      </div>

                      {/* Contas vinculadas */}
                      {postAccounts.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contas</span>
                          <div className="flex flex-wrap gap-1.5">
                            {postAccounts.map((acc) => {
                              const colorIdx = accountColorMap.get(acc.id) ?? 0
                              return (
                                <div key={acc.id} className="flex items-center gap-1.5">
                                  {acc.profile_picture_url ? (
                                    <img
                                      src={acc.profile_picture_url}
                                      alt={acc.account_name}
                                      className="w-5 h-5 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                                      {acc.platform === "instagram"
                                        ? <Instagram className="w-3 h-3 text-muted-foreground" />
                                        : <Facebook className="w-3 h-3 text-muted-foreground" />
                                      }
                                    </div>
                                  )}
                                  <div className="flex flex-col leading-none">
                                    <span className="text-xs font-medium text-foreground">{acc.account_name}</span>
                                    {acc.account_username && (
                                      <span className={cn(
                                        "text-[11px] font-medium px-1 rounded mt-0.5 w-fit",
                                        USERNAME_COLORS[colorIdx]
                                      )}>
                                        @{acc.account_username}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Formato */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Formato</span>
                        <span className="text-xs font-medium text-foreground">
                          {POST_TYPE_LABELS[postType] || postType}
                        </span>
                      </div>

                      {/* Legenda */}
                      {post.content && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Legenda</span>
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line line-clamp-5">
                            {post.content}
                          </p>
                        </div>
                      )}

                      {showWorkspace && post.workspace_name && (
                        <Badge variant="outline" className="text-xs w-fit">{post.workspace_name}</Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}
