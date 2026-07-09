"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import {
  CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight,
  Heart, MessageCircle, Send, Bookmark, MoreHorizontal,
  Volume2, VolumeX, Play, Music2, X, Instagram, Facebook
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────
interface PostMedia {
  url: string
  media_type: "image" | "video"
  order_index: number
}

interface BatchPost {
  id: string
  content: string | null
  status: string
  post_type?: string
  scheduled_at?: string
  position: number
  review_status: string | null
  review_notes: string | null
  review_at: string | null
  media: PostMedia[]
  account_name?: string
  account_username?: string
  profile_picture_url?: string
  platform?: string
}

type Decision = "approved" | "needs_changes"

// ── Helpers ───────────────────────────────────────────────────────────────────
function useSwipe(onLeft: () => void, onRight: () => void) {
  const startX = useRef<number | null>(null)
  const onTouchStart = useCallback((e: React.TouchEvent) => { startX.current = e.touches[0].clientX }, [])
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (startX.current === null) return
    const diff = startX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) diff > 0 ? onLeft() : onRight()
    startX.current = null
  }, [onLeft, onRight])
  return { onTouchStart, onTouchEnd }
}

// ── Simuladores (mesma lógica da página de revisão individual) ─────────────────
function MediaSlider({ media, className }: { media: PostMedia[]; className?: string }) {
  const [idx, setIdx] = useState(0)
  const [muted, setMuted] = useState(true)
  const cur = media[idx]
  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), [])
  const next = useCallback(() => setIdx(i => Math.min(media.length - 1, i + 1)), [media.length])
  const { onTouchStart, onTouchEnd } = useSwipe(next, prev)

  useEffect(() => { setIdx(0) }, [media])

  if (!cur) return (
    <div className={cn("bg-[#F0F0F0] flex items-center justify-center", className)}>
      <span className="text-[#8E8E8E] text-sm">Sem mídia</span>
    </div>
  )

  return (
    <div className={cn("relative bg-black", className)} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {cur.media_type === "video"
        ? <video key={cur.url} src={cur.url} autoPlay loop muted={muted} playsInline className="w-full h-full object-cover" />
        : <img src={cur.url} alt="Post" className="w-full h-full object-cover" />}
      {cur.media_type === "video" && (
        <button onClick={e => { e.stopPropagation(); setMuted(m => !m) }}
          className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
          {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
        </button>
      )}
      {media.length > 1 && (
        <>
          <button onClick={prev} disabled={idx === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center disabled:opacity-0">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={next} disabled={idx === media.length - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center disabled:opacity-0">
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {media.map((_, i) => (
              <div key={i} className={cn("rounded-full transition-all", i === idx ? "w-2 h-2 bg-[#0095F6]" : "w-1.5 h-1.5 bg-white/70")} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function FeedSimulator({ post }: { post: BatchPost }) {
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const username = post.account_username || post.account_name?.split(" ")[0]?.toLowerCase() || "sua_conta"
  const avatar = post.profile_picture_url || null
  const initials = (post.account_name || "SC").slice(0, 2).toUpperCase()
  const media = post.media.filter(m => m.media_type !== "cover" as any)
  const maxCap = 100
  const long = post.content && post.content.length > maxCap

  return (
    <div className="bg-white border border-[#DBDBDB] rounded-lg overflow-hidden w-full">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FFC300] via-[#E1306C] to-[#833AB4] p-0.5 flex-shrink-0">
            <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center bg-[#DBDBDB]">
              {avatar
                ? <img src={avatar} alt={username} className="w-full h-full object-cover" />
                : <span className="text-[10px] font-bold text-[#8E8E8E]">{initials}</span>}
            </div>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#262626] leading-tight">{username}</p>
            <p className="text-[11px] text-[#8E8E8E]">Patrocinado</p>
          </div>
        </div>
        <MoreHorizontal className="w-5 h-5 text-[#262626]" />
      </div>
      <MediaSlider media={media} className="aspect-[4/5]" />
      <div className="px-3 pt-2.5 pb-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-4">
            <button onClick={() => setLiked(l => !l)}>
              <Heart className={cn("w-6 h-6", liked ? "fill-red-500 text-red-500" : "text-[#262626]")} />
            </button>
            <MessageCircle className="w-6 h-6 text-[#262626]" />
            <Send className="w-6 h-6 text-[#262626]" />
          </div>
          <button onClick={() => setSaved(s => !s)}>
            <Bookmark className={cn("w-6 h-6", saved ? "fill-[#262626] text-[#262626]" : "text-[#262626]")} />
          </button>
        </div>
        <p className="text-[13px] font-semibold text-[#262626] mb-1">{liked ? "1.285" : "1.284"} curtidas</p>
        {post.content && (
          <p className="text-[13px] text-[#262626] leading-relaxed whitespace-pre-wrap">
            <span className="font-semibold">{username} </span>
            {long && !expanded
              ? <>{post.content.slice(0, maxCap)}<button onClick={() => setExpanded(true)} className="text-[#8E8E8E]">... mais</button></>
              : post.content}
          </p>
        )}
        <p className="text-[11px] text-[#8E8E8E] mt-1.5 uppercase tracking-wide">Há 2 horas</p>
      </div>
    </div>
  )
}

function StorySimulator({ post }: { post: BatchPost }) {
  const [idx, setIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [muted, setMuted] = useState(true)
  const intervalRef = useRef<any>(null)
  const media = post.media.filter(m => m.media_type !== "cover" as any)
  const cur = media[idx] || media[0]
  const username = post.account_username || post.account_name?.split(" ")[0]?.toLowerCase() || "sua_conta"
  const avatar = post.profile_picture_url || null
  const initials = (post.account_name || "SC").slice(0, 2).toUpperCase()

  useEffect(() => {
    setProgress(0)
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(intervalRef.current); if (idx < media.length - 1) setIdx(i => i + 1); return 100 }
        return p + 2
      })
    }, 100)
    return () => clearInterval(intervalRef.current)
  }, [idx, media.length])

  return (
    <div className="relative rounded-2xl overflow-hidden w-full" style={{ aspectRatio: "9/16" }}>
      {cur ? (
        cur.media_type === "video"
          ? <video src={cur.url} autoPlay loop muted={muted} playsInline className="absolute inset-0 w-full h-full object-cover" />
          : <img src={cur.url} alt="Story" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#FFC300]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/30" />
      <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
        {(media.length > 0 ? media : [null]).map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/40 rounded-full overflow-hidden">
            <div className="h-full bg-white" style={{ width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%" }} />
          </div>
        ))}
      </div>
      <div className="absolute top-7 left-3 right-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-[#DBDBDB] flex items-center justify-center">
            {avatar ? <img src={avatar} alt={username} className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-white">{initials}</span>}
          </div>
          <p className="text-white text-[13px] font-semibold">{username}</p>
        </div>
        <button onClick={() => setMuted(m => !m)}>
          {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
        </button>
      </div>
      {post.content && (
        <div className="absolute bottom-20 left-4 right-4 z-10">
          <p className="text-white text-sm leading-relaxed line-clamp-3 whitespace-pre-wrap">{post.content}</p>
        </div>
      )}
    </div>
  )
}

function ReelSimulator({ post }: { post: BatchPost }) {
  const [muted, setMuted] = useState(true)
  const [liked, setLiked] = useState(false)
  const media = post.media.filter(m => m.media_type !== "cover" as any)
  const cur = media[0]
  const username = post.account_username || post.account_name?.split(" ")[0]?.toLowerCase() || "sua_conta"
  const avatar = post.profile_picture_url || null
  const initials = (post.account_name || "SC").slice(0, 2).toUpperCase()

  return (
    <div className="relative rounded-2xl overflow-hidden w-full" style={{ aspectRatio: "9/16" }}>
      {cur ? (
        cur.media_type === "video"
          ? <video src={cur.url} autoPlay loop muted={muted} playsInline className="absolute inset-0 w-full h-full object-cover" />
          : <img src={cur.url} alt="Reel" className="absolute inset-0 w-full h-full object-cover opacity-80" />
      ) : (
        <div className="absolute inset-0 bg-black" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
      <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5 z-10">
        <button onClick={() => setLiked(l => !l)} className="flex flex-col items-center gap-1">
          <Heart className={cn("w-7 h-7", liked ? "fill-red-500 text-red-500" : "text-white")} />
          <span className="text-white text-[11px]">{liked ? "1.3M" : "1.2M"}</span>
        </button>
        <MessageCircle className="w-7 h-7 text-white" />
        <Send className="w-7 h-7 text-white" />
      </div>
      <div className="absolute bottom-4 left-4 right-16 z-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full border border-white overflow-hidden bg-[#DBDBDB] flex items-center justify-center">
            {avatar ? <img src={avatar} alt={username} className="w-full h-full object-cover" /> : <span className="text-[8px] font-bold text-white">{initials}</span>}
          </div>
          <span className="text-white text-[13px] font-semibold">{username}</span>
        </div>
        {post.content && <p className="text-white text-[13px] line-clamp-2 whitespace-pre-wrap">{post.content}</p>}
        <div className="flex items-center gap-1.5 mt-1">
          <Music2 className="w-3.5 h-3.5 text-white" />
          <span className="text-white text-[11px]">Áudio original • {username}</span>
        </div>
      </div>
      <button onClick={() => setMuted(m => !m)}
        className="absolute top-4 right-3 z-10 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
        {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
      </button>
    </div>
  )
}

// ── Main: ReviewBatchClient ───────────────────────────────────────────────────
export function ReviewBatchClient({ token }: { token: string }) {
  const [posts, setPosts] = useState<BatchPost[]>([])
  const [batchTitle, setBatchTitle] = useState<string | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Por post: decisão e notas locais
  const [decisions, setDecisions] = useState<Record<string, Decision | null>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch(`/api/review-batches/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        const ps: BatchPost[] = (data.posts || []).map((p: any) => ({
          ...p,
          media: (p.media || []).filter((m: any) => m.media_type !== "cover").sort((a: any, b: any) => a.order_index - b.order_index),
        }))
        setPosts(ps)
        setBatchTitle(data.title || null)
        // Restaura estados de revisão já enviados
        const initDecisions: Record<string, Decision | null> = {}
        const initSubmitted: Record<string, boolean> = {}
        const initNotes: Record<string, string> = {}
        ps.forEach(p => {
          if (p.review_status === "approved" || p.review_status === "needs_changes") {
            initDecisions[p.id] = p.review_status as Decision
            initSubmitted[p.id] = true
            initNotes[p.id] = p.review_notes || ""
          } else {
            initDecisions[p.id] = null
          }
        })
        setDecisions(initDecisions)
        setSubmitted(initSubmitted)
        setNotes(initNotes)
      })
      .catch(() => setError("Erro ao carregar conteúdo"))
      .finally(() => setLoading(false))
  }, [token])

  const currentPost = posts[currentIdx]
  const total = posts.length
  const allDone = posts.length > 0 && posts.every(p => submitted[p.id])
  const approvedCount = posts.filter(p => decisions[p.id] === "approved").length
  const changesCount = posts.filter(p => decisions[p.id] === "needs_changes").length

  const goNext = useCallback(() => {
    if (currentIdx < total - 1) setCurrentIdx(i => i + 1)
  }, [currentIdx, total])

  const goPrev = useCallback(() => {
    if (currentIdx > 0) setCurrentIdx(i => i - 1)
  }, [currentIdx])

  const handleSubmitCurrent = async () => {
    if (!currentPost) return
    const dec = decisions[currentPost.id]
    if (!dec) return
    if (dec === "needs_changes" && !(notes[currentPost.id] || "").trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/review-batches/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: currentPost.id,
          decision: dec,
          notes: (notes[currentPost.id] || "").trim() || null,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSubmitted(prev => ({ ...prev, [currentPost.id]: true }))
      // Avança automaticamente para o próximo não revisado
      const nextUndone = posts.findIndex((p, i) => i > currentIdx && !submitted[p.id] && p.id !== currentPost.id)
      if (nextUndone !== -1) setCurrentIdx(nextUndone)
      else if (currentIdx < total - 1) setCurrentIdx(i => i + 1)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="w-6 h-6 border-2 border-[#0095F6] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !currentPost) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] p-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2 text-[#262626]">Link inválido</h1>
          <p className="text-[#8E8E8E] text-sm">{error || "Este link de revisão não existe ou expirou."}</p>
        </div>
      </div>
    )
  }

  const postType = currentPost.post_type || (currentPost.media.some(m => m.media_type === "video") ? "reel" : "feed")
  const isStory = postType === "story"
  const isReel = postType === "reel"
  const curDecision = decisions[currentPost.id] ?? null
  const curNotes = notes[currentPost.id] ?? ""
  const curSubmitted = submitted[currentPost.id] ?? false

  // Badge de status do post atual
  const postStatusBadge = curSubmitted
    ? curDecision === "approved"
      ? { label: "Aprovado", cls: "bg-green-100 text-green-700" }
      : { label: "Ajustes", cls: "bg-amber-100 text-amber-700" }
    : { label: "Aguardando", cls: "bg-[#F0F0F0] text-[#8E8E8E]" }

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans">
      {/* Header fixo */}
      <header className="bg-white border-b border-[#DBDBDB] sticky top-0 z-20">
        <div className="w-full max-w-xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] text-[#8E8E8E] uppercase tracking-widest font-medium">Revisão de conteúdo</p>
              {batchTitle && <p className="text-sm font-semibold text-[#262626] truncate">{batchTitle}</p>}
            </div>
            <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap", postStatusBadge.cls)}>
              {postStatusBadge.label}
            </span>
          </div>

          {/* Barra de progresso dos posts */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1 flex-1">
              {posts.map((p, i) => {
                const dec = decisions[p.id]
                const done = submitted[p.id]
                return (
                  <button
                    key={p.id}
                    onClick={() => setCurrentIdx(i)}
                    className={cn(
                      "flex-1 h-1.5 rounded-full transition-all",
                      i === currentIdx
                        ? "bg-[#0095F6]"
                        : done && dec === "approved"
                          ? "bg-green-500"
                          : done && dec === "needs_changes"
                            ? "bg-amber-400"
                            : "bg-[#DBDBDB]"
                    )}
                    aria-label={`Post ${i + 1}`}
                  />
                )
              })}
            </div>
            <span className="text-[11px] text-[#8E8E8E] shrink-0">{currentIdx + 1}/{total}</span>
          </div>
        </div>
      </header>

      <main className="w-full max-w-xl mx-auto px-3 sm:px-4 py-4 flex flex-col items-center gap-4">

        {/* Info da conta */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentPost.profile_picture_url ? (
              <img src={currentPost.profile_picture_url} alt={currentPost.account_name || ""} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#DBDBDB] flex items-center justify-center">
                {currentPost.platform === "instagram"
                  ? <Instagram className="w-4 h-4 text-[#8E8E8E]" />
                  : <Facebook className="w-4 h-4 text-[#8E8E8E]" />}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-[#262626] leading-tight">
                {currentPost.account_username ? `@${currentPost.account_username}` : currentPost.account_name || "Conta"}
              </p>
              {currentPost.account_name && currentPost.account_username && (
                <p className="text-xs text-[#8E8E8E]">{currentPost.account_name}</p>
              )}
            </div>
          </div>
          <span className="text-xs font-semibold text-[#262626] bg-white border border-[#DBDBDB] px-2.5 py-1 rounded-full capitalize">
            {isStory ? "Story" : isReel ? "Reels" : currentPost.media.length > 1 ? "Carrossel" : "Feed"}
          </span>
        </div>

        {/* Simulação */}
        <div className={cn("w-full flex justify-center", (isStory || isReel) ? "px-6 sm:px-12" : "")}>
          {isStory
            ? <StorySimulator post={currentPost} />
            : isReel
              ? <ReelSimulator post={currentPost} />
              : <FeedSimulator post={currentPost} />}
        </div>

        {/* Painel de decisão */}
        <div className="w-full">
          {curSubmitted ? (
            <div className={cn(
              "rounded-2xl border p-6 flex flex-col items-center text-center gap-4",
              curDecision === "approved" ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"
            )}>
              {curDecision === "approved"
                ? <CheckCircle className="w-10 h-10 text-green-600" />
                : <XCircle className="w-10 h-10 text-amber-600" />}
              <div>
                <p className="font-semibold text-[#262626] text-base">
                  {curDecision === "approved" ? "Conteúdo aprovado!" : "Ajustes solicitados"}
                </p>
                {curNotes && (
                  <div className="mt-3 w-full bg-white rounded-xl p-4 text-left border border-[#DBDBDB]">
                    <p className="text-xs text-[#8E8E8E] mb-1 font-medium uppercase tracking-wide">Suas considerações</p>
                    <p className="text-sm text-[#262626] whitespace-pre-wrap leading-relaxed">{curNotes}</p>
                  </div>
                )}
              </div>
              {/* Navegar para outro post */}
              {total > 1 && (
                <div className="flex gap-2 mt-2">
                  {currentIdx > 0 && (
                    <Button variant="outline" size="sm" onClick={goPrev} className="gap-1.5">
                      <ChevronLeft className="w-4 h-4" /> Anterior
                    </Button>
                  )}
                  {currentIdx < total - 1 && (
                    <Button size="sm" onClick={goNext} className="gap-1.5">
                      Próximo <ChevronRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#DBDBDB] rounded-2xl p-5 flex flex-col gap-5">
              <div>
                <p className="text-sm font-semibold text-[#262626]">O que você acha deste conteúdo?</p>
                <p className="text-xs text-[#8E8E8E] mt-0.5">Post {currentIdx + 1} de {total}</p>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => setDecisions(d => ({ ...d, [currentPost.id]: "approved" }))}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all",
                    curDecision === "approved" ? "border-green-500 bg-green-50" : "border-[#DBDBDB] hover:border-green-300 hover:bg-green-50/40"
                  )}
                >
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                    curDecision === "approved" ? "bg-green-100" : "bg-[#F0F0F0]")}>
                    <CheckCircle className={cn("w-5 h-5", curDecision === "approved" ? "text-green-600" : "text-[#8E8E8E]")} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#262626]">Aprovar publicação</p>
                    <p className="text-xs text-[#8E8E8E]">O conteúdo está ótimo, pode publicar!</p>
                  </div>
                </button>

                <button
                  onClick={() => setDecisions(d => ({ ...d, [currentPost.id]: "needs_changes" }))}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all",
                    curDecision === "needs_changes" ? "border-amber-500 bg-amber-50" : "border-[#DBDBDB] hover:border-amber-300 hover:bg-amber-50/40"
                  )}
                >
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                    curDecision === "needs_changes" ? "bg-amber-100" : "bg-[#F0F0F0]")}>
                    <XCircle className={cn("w-5 h-5", curDecision === "needs_changes" ? "text-amber-600" : "text-[#8E8E8E]")} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#262626]">Solicitar ajustes</p>
                    <p className="text-xs text-[#8E8E8E]">Tenho considerações sobre este conteúdo.</p>
                  </div>
                </button>
              </div>

              {curDecision === "needs_changes" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-[#262626]">
                    Descreva os ajustes necessários <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    placeholder="Escreva suas considerações aqui..."
                    value={curNotes}
                    onChange={e => setNotes(n => ({ ...n, [currentPost.id]: e.target.value }))}
                    rows={4}
                    className="resize-none border-[#DBDBDB] text-sm"
                  />
                </div>
              )}

              <Button
                onClick={handleSubmitCurrent}
                disabled={!curDecision || (curDecision === "needs_changes" && !curNotes.trim()) || submitting}
                className={cn(
                  "w-full h-11 font-semibold text-sm rounded-xl",
                  curDecision === "approved" ? "bg-green-600 hover:bg-green-700 text-white"
                    : curDecision === "needs_changes" ? "bg-amber-500 hover:bg-amber-600 text-white"
                      : "bg-[#0095F6] hover:bg-[#0086E0] text-white"
                )}
              >
                {submitting
                  ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Enviando...</span>
                  : curDecision === "approved" ? "Confirmar aprovação"
                    : curDecision === "needs_changes" ? "Enviar considerações"
                      : "Selecione uma opção acima"}
              </Button>
            </div>
          )}
        </div>

        {/* Resumo final */}
        {allDone && (
          <div className="w-full bg-white border border-[#DBDBDB] rounded-2xl p-5 text-center flex flex-col gap-2">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto" />
            <p className="font-semibold text-[#262626]">Revisão concluída!</p>
            <p className="text-sm text-[#8E8E8E]">
              {approvedCount} aprovado(s) · {changesCount} com ajustes solicitados
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
