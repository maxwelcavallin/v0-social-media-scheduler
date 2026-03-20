"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
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
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

const formatTimeBrasilia = (iso: string): string =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))

const parseBrasilia = (iso: string): Date => {
  const utc = new Date(iso)
  const brasiliaOffset = -3 * 60
  const localOffset = utc.getTimezoneOffset()
  const diff = (localOffset + brasiliaOffset) * 60 * 1000
  return new Date(utc.getTime() - diff)
}

const ACCOUNT_COLORS = [
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
]

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; badge: string }> = {
  scheduled: {
    label: "Agendado",
    icon: <CalendarClock className="w-3.5 h-3.5" />,
    badge: "bg-primary/10 text-primary border-primary/20",
  },
  published: {
    label: "Publicado",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  failed: {
    label: "Falhou",
    icon: <XCircle className="w-3.5 h-3.5" />,
    badge: "bg-destructive/10 text-destructive border-destructive/20",
  },
  draft: {
    label: "Rascunho",
    icon: <FileText className="w-3.5 h-3.5" />,
    badge: "bg-muted text-muted-foreground border-border",
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

interface Workspace {
  id: string
  name: string
}

interface Post {
  id: string
  content: string
  status: string
  scheduled_at: string
  post_type?: string
  media_count?: number
  thumbnail?: string
  cover_url?: string
  media?: { url: string; media_type: string }[]
  accounts?: Account[]
}

interface Props {
  posts: Post[]
  accounts?: Account[]
  workspaceId?: string
  workspaces?: Workspace[]
  showWorkspace?: boolean
  showFilters?: boolean
}

export function CalendarView({ posts, accounts = [], workspaceId, workspaces = [], showWorkspace, showFilters }: Props) {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  // Filtros
  const [search, setSearch] = useState("")
  const [filterAccountId, setFilterAccountId] = useState<string>("all")
  const [filterWorkspaceId, setFilterWorkspaceId] = useState<string>(workspaceId || "all")

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { locale: ptBR })
  const calEnd = endOfWeek(monthEnd, { locale: ptBR })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

  // Mapa de cor estável por account id
  const accountColorMap = useMemo(() => {
    const map = new Map<string, number>()
    const seen = new Set<string>()
    ;[...accounts, ...posts.flatMap((p) => p.accounts || [])].forEach((a) => {
      if (!seen.has(a.id)) {
        map.set(a.id, map.size % ACCOUNT_COLORS.length)
        seen.add(a.id)
      }
    })
    return map
  }, [accounts, posts])

  // Posts filtrados
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      // Filtro de conta
      if (filterAccountId !== "all") {
        const hasAccount = (post.accounts || []).some((a) => a.id === filterAccountId)
        if (!hasAccount) return false
      }
      // Filtro de busca (legenda ou nome de conta)
      if (search.trim()) {
        const q = search.toLowerCase()
        const inContent = post.content?.toLowerCase().includes(q)
        const inAccount = (post.accounts || []).some(
          (a) =>
            a.account_name?.toLowerCase().includes(q) ||
            a.account_username?.toLowerCase().includes(q)
        )
        if (!inContent && !inAccount) return false
      }
      return true
    })
  }, [posts, filterAccountId, search])

  const getPostsForDay = (day: Date) =>
    filteredPosts.filter((p) => p.scheduled_at && isSameDay(parseBrasilia(p.scheduled_at), day))

  const selectedDayPosts = selectedDay ? getPostsForDay(selectedDay) : []

  const getAccountsForPost = (post: Post): Account[] => {
    const raw = post.accounts
    if (!raw) return []
    if (typeof raw === "string") {
      try { return JSON.parse(raw) } catch { return [] }
    }
    return Array.isArray(raw) ? raw : []
  }

  const handleDayClick = (day: Date) => {
    if (getPostsForDay(day).length > 0) {
      setSelectedDay(day)
      setSheetOpen(true)
    }
  }

  const handleWorkspaceChange = (id: string) => {
    setFilterWorkspaceId(id)
    if (id !== "all" && id !== workspaceId) {
      router.push(`/workspace/${id}/calendar`)
    }
  }

  const [wsOpen, setWsOpen] = useState(false)
  const [accOpen, setAccOpen] = useState(false)

  const selectedWorkspaceName = workspaces.find((w) => w.id === filterWorkspaceId)?.name
  const selectedAccountLabel = filterAccountId === "all"
    ? null
    : accounts.find((a) => a.id === filterAccountId)

  const hasFilters = filterAccountId !== "all"

  return (
    <>
      {/* Filtros — só no calendário geral */}
      {showFilters && <div className="flex flex-wrap items-center gap-3">

        {/* Combobox Workspace */}
        {workspaces.length > 1 && (
          <Popover open={wsOpen} onOpenChange={setWsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={wsOpen}
                className="h-9 w-[200px] justify-between text-sm font-normal"
              >
                <span className="truncate">{selectedWorkspaceName || "Workspace"}</span>
                <ChevronsUpDown className="ml-2 w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0">
              <Command>
                <CommandInput placeholder="Buscar workspace..." />
                <CommandList>
                  <CommandEmpty>Nenhum workspace encontrado.</CommandEmpty>
                  <CommandGroup>
                    {workspaces.map((ws) => (
                      <CommandItem
                        key={ws.id}
                        value={ws.name}
                        onSelect={() => { handleWorkspaceChange(ws.id); setWsOpen(false) }}
                      >
                        <Check className={cn("mr-2 w-4 h-4", ws.id === filterWorkspaceId ? "opacity-100" : "opacity-0")} />
                        {ws.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        {/* Combobox Conta */}
        <Popover open={accOpen} onOpenChange={setAccOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={accOpen}
              className="h-9 w-[210px] justify-between text-sm font-normal"
            >
              {selectedAccountLabel ? (
                <span className="flex items-center gap-2 truncate">
                  {selectedAccountLabel.platform === "instagram"
                    ? <Instagram className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                    : <Facebook className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  }
                  <span className="truncate">
                    {selectedAccountLabel.account_username
                      ? `@${selectedAccountLabel.account_username}`
                      : selectedAccountLabel.account_name}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">Todas as contas</span>
              )}
              <ChevronsUpDown className="ml-2 w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[230px] p-0">
            <Command>
              <CommandInput placeholder="Buscar conta..." />
              <CommandList>
                <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
                <CommandGroup>
                  <CommandItem value="all" onSelect={() => { setFilterAccountId("all"); setAccOpen(false) }}>
                    <Check className={cn("mr-2 w-4 h-4", filterAccountId === "all" ? "opacity-100" : "opacity-0")} />
                    Todas as contas
                  </CommandItem>
                  {accounts.map((acc) => (
                    <CommandItem
                      key={acc.id}
                      value={`${acc.account_name} ${acc.account_username || ""}`}
                      onSelect={() => { setFilterAccountId(acc.id); setAccOpen(false) }}
                    >
                      <Check className={cn("mr-2 w-4 h-4", acc.id === filterAccountId ? "opacity-100" : "opacity-0")} />
                      <span className="flex items-center gap-2">
                        {acc.platform === "instagram"
                          ? <Instagram className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                          : <Facebook className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        }
                        <span className="truncate">
                          {acc.account_username ? `@${acc.account_username}` : acc.account_name}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs gap-1.5 text-muted-foreground"
            onClick={() => { setFilterAccountId("all") }}
          >
            <X className="w-3.5 h-3.5" />
            Limpar
          </Button>
        )}
      </div>}

      {/* Calendário */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Header mês */}
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

        {/* Dias da semana */}
        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map((day) => (
            <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Grid de dias */}
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
                    isTodayDay
                      ? "bg-primary text-primary-foreground"
                      : isCurrentMonth
                      ? "text-foreground"
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
                    const postAccounts = getAccountsForPost(post)
                    const firstAccount = postAccounts[0]
                    const colorIdx = firstAccount ? (accountColorMap.get(firstAccount.id) ?? 0) : 0
                    // Mostrar nome da conta: preferir account_name, fallback account_username
                    const displayName = firstAccount?.account_name || firstAccount?.account_username || "Post"

                    return (
                      <div
                        key={post.id}
                        className={cn(
                          "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border",
                          post.status === "scheduled" && "bg-primary/8 border-primary/15",
                          post.status === "published" && "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800",
                          post.status === "failed" && "bg-destructive/8 border-destructive/15",
                          post.status === "draft" && "bg-muted border-border",
                        )}
                      >
                        {/* Ícone de status */}
                        <span className={cn(
                          "shrink-0",
                          post.status === "scheduled" && "text-primary",
                          post.status === "published" && "text-emerald-500",
                          post.status === "failed" && "text-destructive",
                          post.status === "draft" && "text-muted-foreground",
                        )}>
                          {status.icon}
                        </span>
                        {/* Nome da conta com cor distinta */}
                        <span className={cn(
                          "truncate text-[10px] font-semibold px-1 rounded leading-tight",
                          ACCOUNT_COLORS[colorIdx]
                        )}>
                          {displayName}
                        </span>
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

      {/* Sheet de detalhe */}
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
                const postType = post.post_type || "feed"
                const mediaItems = post.media || []
                const hasVideo = mediaItems.some((m) => m.media_type === "video") || postType === "reel"

                return (
                  <div key={post.id} className="border border-border rounded-xl overflow-hidden">
                    {/* Thumbnail */}
                    {post.thumbnail && (
                      <div className="relative w-full h-48 bg-black">
                        {hasVideo ? (
                          <video src={post.thumbnail} className="w-full h-full object-cover" muted />
                        ) : (
                          <img src={post.thumbnail} alt="" className="w-full h-full object-cover" />
                        )}
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
                      {/* Status + data/hora completa */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
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
                            {new Intl.DateTimeFormat("pt-BR", {
                              timeZone: "America/Sao_Paulo",
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(post.scheduled_at))}
                            {" "}(Brasília)
                          </span>
                        )}
                      </div>

                      {/* Contas vinculadas */}
                      {postAccounts.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contas</span>
                          <div className="flex flex-col gap-2">
                            {postAccounts.map((acc) => {
                              const colorIdx = accountColorMap.get(acc.id) ?? 0
                              return (
                                <div key={acc.id} className="flex items-center gap-2.5">
                                  {acc.profile_picture_url ? (
                                    <img
                                      src={acc.profile_picture_url}
                                      alt={acc.account_name}
                                      className="w-8 h-8 rounded-full object-cover shrink-0"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                      {acc.platform === "instagram"
                                        ? <Instagram className="w-4 h-4 text-muted-foreground" />
                                        : <Facebook className="w-4 h-4 text-muted-foreground" />
                                      }
                                    </div>
                                  )}
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-semibold text-foreground truncate">
                                      {acc.account_name}
                                    </span>
                                    {acc.account_username && (
                                      <span className={cn(
                                        "text-[11px] font-medium px-1.5 py-0.5 rounded mt-0.5 w-fit",
                                        ACCOUNT_COLORS[colorIdx]
                                      )}>
                                        @{acc.account_username}
                                      </span>
                                    )}
                                  </div>
                                  <div className="ml-auto shrink-0">
                                    {acc.platform === "instagram"
                                      ? <Instagram className="w-4 h-4 text-pink-500" />
                                      : <Facebook className="w-4 h-4 text-blue-600" />
                                    }
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
                        <Badge variant="outline" className="text-xs font-medium">
                          {POST_TYPE_LABELS[postType] || postType}
                        </Badge>
                      </div>

                      {/* Legenda */}
                      {post.content && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Legenda</span>
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line line-clamp-6">
                            {post.content}
                          </p>
                        </div>
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
