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

// Parse an ISO string and return a Date adjusted to Brasília (UTC-3)
// so comparisons and display are always in the correct local time.
const parseBrasilia = (iso: string): Date => {
  // Create a date using the Intl API to get the Brasília wall-clock time
  const utc = new Date(iso)
  // Offset Brasília is UTC-3 = -180 minutes
  const brasiliaOffset = -3 * 60
  const localOffset = utc.getTimezoneOffset() // browser/server offset in minutes (positive = behind UTC)
  const diff = (localOffset + brasiliaOffset) * 60 * 1000 // ms to subtract
  return new Date(utc.getTime() - diff)
}

const formatTimeBrasilia = (iso: string): string => {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}
import { ChevronLeft, ChevronRight, Instagram, Facebook, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface Post {
  id: string
  content: string
  status: string
  scheduled_at: string
  platforms?: string[]
  post_types?: string[]
  media_count?: number
  thumbnail?: string
  workspace_name?: string
  workspace_id?: string
}

interface Props {
  posts: Post[]
  showWorkspace?: boolean
}

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="w-3 h-3" style={{ color: "oklch(0.52 0.25 15)" }} />,
  facebook: <Facebook className="w-3 h-3" style={{ color: "oklch(0.46 0.18 242)" }} />,
}

const statusColors: Record<string, string> = {
  scheduled: "bg-primary",
  published: "bg-success",
  failed: "bg-destructive",
  draft: "bg-muted-foreground",
}

export function CalendarView({ posts, showWorkspace }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { locale: ptBR })
  const calEnd = endOfWeek(monthEnd, { locale: ptBR })

  const days = eachDayOfInterval({ start: calStart, end: calEnd })
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

  const getPostsForDay = (day: Date) =>
    posts.filter((p) => p.scheduled_at && isSameDay(parseBrasilia(p.scheduled_at), day))

  const selectedDayPosts = selectedDay ? getPostsForDay(selectedDay) : []

  const handleDayClick = (day: Date) => {
    const dayPosts = getPostsForDay(day)
    if (dayPosts.length > 0) {
      setSelectedDay(day)
      setSheetOpen(true)
    }
  }

  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Calendar Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground capitalize">
            {format(currentDate, "MMMM yyyy", { locale: ptBR })}
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
              className="text-xs h-8 px-3"
            >
              Hoje
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Week days header */}
        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-medium text-muted-foreground"
            >
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
                  "min-h-[80px] p-1.5 border-r border-b border-border last:border-r-0 transition-colors",
                  !isCurrentMonth && "bg-muted/30",
                  hasPost && "cursor-pointer hover:bg-accent/40",
                  idx % 7 === 6 && "border-r-0"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                      isTodayDay
                        ? "bg-primary text-primary-foreground"
                        : isCurrentMonth
                        ? "text-foreground"
                        : "text-muted-foreground/40"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {dayPosts.length > 1 && (
                    <span className="text-xs text-muted-foreground font-medium">
                      {dayPosts.length}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-0.5">
                  {dayPosts.slice(0, 3).map((post) => (
                    <div
                      key={post.id}
                      className={cn(
                        "flex items-center gap-1 px-1 py-0.5 rounded text-xs truncate",
                        post.status === "scheduled" && "bg-primary/10 text-primary",
                        post.status === "published" && "bg-success/10 text-success",
                        post.status === "failed" && "bg-destructive/10 text-destructive",
                        post.status === "draft" && "bg-muted text-muted-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          statusColors[post.status] || "bg-muted-foreground"
                        )}
                      />
                      <span className="truncate">{post.content || "Post"}</span>
                    </div>
                  ))}
                  {dayPosts.length > 3 && (
                    <span className="text-xs text-muted-foreground px-1">
                      +{dayPosts.length - 3} mais
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Post Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {selectedDay &&
                format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-3 mt-6">
            {selectedDayPosts.map((post) => (
              <div key={post.id} className="border border-border rounded-xl p-4 flex flex-col gap-3">
                {/* Thumbnail */}
                {post.thumbnail && (
                  <img
                    src={post.thumbnail}
                    alt=""
                    className="w-full h-40 object-cover rounded-lg"
                  />
                )}

                {/* Content */}
                <div>
                  <p className="text-sm text-foreground leading-relaxed line-clamp-3">
                    {post.content || "Sem legenda"}
                  </p>
                </div>

                {/* Meta */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {(post.platforms || []).map((p) => (
                        <span key={p} className="flex items-center">{platformIcons[p]}</span>
                      ))}
                    </div>
                    {post.media_count ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ImageIcon className="w-3 h-3" />
                        {post.media_count}
                      </span>
                    ) : null}
                    {showWorkspace && post.workspace_name && (
                      <Badge variant="outline" className="text-xs">{post.workspace_name}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {post.scheduled_at && (
                      <span className="text-xs text-muted-foreground">
                        {formatTimeBrasilia(post.scheduled_at)}
                      </span>
                    )}
                    <Badge
                      variant={
                        post.status === "published"
                          ? "default"
                          : post.status === "failed"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      {post.status === "scheduled"
                        ? "Agendado"
                        : post.status === "published"
                        ? "Publicado"
                        : post.status === "failed"
                        ? "Falhou"
                        : "Rascunho"}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
