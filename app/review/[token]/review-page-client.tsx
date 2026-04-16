"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import {
  CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight,
  Heart, MessageCircle, Send, Bookmark, MoreHorizontal,
  Volume2, VolumeX, Play, Music2, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// ── Fullscreen viewer ─────────────────────────────────────────────────────────
function FullscreenViewer({ media, initialIdx, onClose }: {
  media: PostMedia[]
  initialIdx: number
  onClose: () => void
}) {
  const [idx, setIdx] = useState(initialIdx)
  const [muted, setMuted] = useState(false)
  const current = media[idx]

  // Fecha com ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") setIdx(i => Math.max(0, i - 1))
      if (e.key === "ArrowRight") setIdx(i => Math.min(media.length - 1, i + 1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [media.length, onClose])

  // Bloqueia scroll do body
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      onClick={onClose}
    >
      {/* Fecha */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      {/* Mute (para vídeos) */}
      {current?.media_type === "video" && (
        <button
          onClick={e => { e.stopPropagation(); setMuted(m => !m) }}
          className="absolute bottom-6 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
        </button>
      )}

      {/* Mídia */}
      <div className="relative w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
        {current?.media_type === "video" ? (
          <video
            key={current.url}
            src={current.url}
            autoPlay
            loop
            muted={muted}
            playsInline
            className="max-w-full max-h-full object-contain"
          />
        ) : current ? (
          <img
            src={current.url}
            alt="Mídia"
            className="max-w-full max-h-full object-contain"
          />
        ) : null}
      </div>

      {/* Navegação carrossel */}
      {media.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); setIdx(i => Math.max(0, i - 1)) }}
            disabled={idx === 0}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-20 hover:bg-white/20 transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); setIdx(i => Math.min(media.length - 1, i + 1)) }}
            disabled={idx === media.length - 1}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-20 hover:bg-white/20 transition-colors"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {media.map((_, i) => (
              <button
                key={i}
                onClick={e => { e.stopPropagation(); setIdx(i) }}
                className={cn("rounded-full transition-all", i === idx ? "w-2 h-2 bg-white" : "w-1.5 h-1.5 bg-white/40")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

interface PostMedia {
  url: string
  media_type: "image" | "video"
  order_index: number
}

interface ReviewPost {
  id: string
  content: string
  status: string
  review_status: string | null
  review_notes: string | null
  review_at: string | null
  media: PostMedia[]
  post_type?: string
  account_name?: string
  account_username?: string
  profile_picture_url?: string
  platform?: string
}

type Decision = "approved" | "needs_changes"

// ── Feed post simulator ───────────────────────────────────────────────────────
function FeedPost({ post, media, onExpand }: { post: ReviewPost; media: PostMedia[]; onExpand: (idx: number) => void }) {
  const [idx, setIdx] = useState(0)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [muted, setMuted] = useState(true)
  const [captionExpanded, setCaptionExpanded] = useState(false)
  const username = post.account_username || "sua_conta"
  const accountName = post.account_name || "Sua Conta"
  const avatar = post.profile_picture_url || null
  const initials = accountName.slice(0, 2).toUpperCase()
  const current = media[idx]
  const maxCaption = 100
  const longCaption = post.content && post.content.length > maxCaption

  return (
    <div className="bg-white border border-[#DBDBDB] rounded-lg sm:rounded-sm overflow-hidden w-full group">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FFC300] via-[#E1306C] to-[#833AB4] p-0.5 flex-shrink-0">
            <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center bg-[#DBDBDB]">
              {avatar
                ? <img src={avatar} alt={accountName} className="w-full h-full object-cover" />
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

      {/* Media */}
      <div className="relative bg-black cursor-pointer" style={{ aspectRatio: "1/1" }} onClick={() => current && onExpand(idx)}>
        {current ? (
          current.media_type === "video" ? (
            <div className="relative w-full h-full">
              <video src={current.url} autoPlay loop muted={muted} playsInline className="w-full h-full object-cover" />
              <button
                onClick={e => { e.stopPropagation(); setMuted(m => !m) }}
                className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
              >
                {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
              </button>
            </div>
          ) : (
            <img src={current.url} alt="Post" className="w-full h-full object-cover" />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#F0F0F0]">
            <span className="text-[#8E8E8E] text-sm">Sem mídia</span>
          </div>
        )}
        {media.length > 1 && (
          <>
            <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center disabled:opacity-0 transition-opacity">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => setIdx(i => Math.min(media.length - 1, i + 1))} disabled={idx === media.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center disabled:opacity-0 transition-opacity">
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

      {/* Actions */}
      <div className="px-3 pt-2.5 pb-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-4">
            <button onClick={() => setLiked(l => !l)}>
              <Heart className={cn("w-6 h-6 transition-colors", liked ? "fill-red-500 text-red-500" : "text-[#262626]")} />
            </button>
            <MessageCircle className="w-6 h-6 text-[#262626]" />
            <Send className="w-6 h-6 text-[#262626]" />
          </div>
          <button onClick={() => setSaved(s => !s)}>
            <Bookmark className={cn("w-6 h-6 transition-colors", saved ? "fill-[#262626] text-[#262626]" : "text-[#262626]")} />
          </button>
        </div>
        <p className="text-[13px] font-semibold text-[#262626] mb-1">{liked ? "1.285" : "1.284"} curtidas</p>
        {post.content && (
          <p className="text-[13px] text-[#262626] leading-relaxed">
            <span className="font-semibold">{username} </span>
            {longCaption && !captionExpanded
              ? <>{post.content.slice(0, maxCaption)}<button onClick={() => setCaptionExpanded(true)} className="text-[#8E8E8E]">... mais</button></>
              : post.content}
          </p>
        )}
        <p className="text-[11px] text-[#8E8E8E] mt-1.5 uppercase tracking-wide">Há 2 horas</p>
      </div>
    </div>
  )
}

// ── Story simulator ───────────────────────────────────────────────────────────
function StoryPost({ post, media, onExpand }: { post: ReviewPost; media: PostMedia[]; onExpand: (idx: number) => void }) {
  const [idx, setIdx] = useState(0)
  const [muted, setMuted] = useState(true)
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef<any>(null)
  const current = media[idx] || media[0]
  const username = post.account_username || "sua_conta"
  const accountName = post.account_name || "Sua Conta"
  const avatar = post.profile_picture_url || null
  const initials = accountName.slice(0, 2).toUpperCase()
  const duration = 5000

  useEffect(() => {
    setProgress(0)
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(intervalRef.current)
          if (idx < media.length - 1) setIdx(i => i + 1)
          return 100
        }
        return p + (100 / (duration / 100))
      })
    }, 100)
    return () => clearInterval(intervalRef.current)
  }, [idx, media.length])

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-2xl w-full" style={{ aspectRatio: "9/16" }}>
      {/* Background media */}
      {current ? (
        current.media_type === "video"
          ? <video src={current.url} autoPlay loop muted={muted} playsInline className="absolute inset-0 w-full h-full object-cover" />
          : <img src={current.url} alt="Story" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#FFC300]" />
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/30" />

      {/* Progress bars */}
      <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
        {media.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-none"
              style={{ width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%" }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-7 left-3 right-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full border-2 border-white overflow-hidden flex items-center justify-center bg-[#DBDBDB]">
            {avatar
              ? <img src={avatar} alt={accountName} className="w-full h-full object-cover" />
              : <span className="text-[10px] font-bold text-white">{initials}</span>}
          </div>
          <p className="text-white text-[13px] font-semibold drop-shadow-sm">{username}</p>
          <p className="text-white/70 text-[11px]">• 2h</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setMuted(m => !m)}>
            {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
          </button>
          <MoreHorizontal className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Toque na área central abre fullscreen; bordas esquerda/direita navegam entre mídias */}
      <div className="absolute inset-y-0 left-0 w-1/4 z-10 cursor-pointer" onClick={() => setIdx(i => Math.max(0, i - 1))} />
      <div className="absolute inset-y-0 left-1/4 right-1/4 z-10 cursor-zoom-in" onClick={() => onExpand(idx)} />
      <div className="absolute inset-y-0 right-0 w-1/4 z-10 cursor-pointer" onClick={() => setIdx(i => Math.min(media.length - 1, i + 1))} />

      {/* Caption */}
      {post.content && (
        <div className="absolute bottom-20 left-4 right-4 z-10">
          <p className="text-white text-sm leading-relaxed drop-shadow-md line-clamp-3">{post.content}</p>
        </div>
      )}

      {/* Bottom bar */}
      <div className="absolute bottom-4 left-3 right-3 flex items-center justify-between z-10">
        <div className="flex-1 bg-white/20 rounded-full px-4 py-2.5 border border-white/30">
          <span className="text-white/80 text-[13px]">Enviar mensagem</span>
        </div>
        <div className="flex items-center gap-3 ml-3">
          <Heart className="w-6 h-6 text-white" />
          <Send className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  )
}

// ── Reels simulator ───────────────────────────────────────────────────────────
function ReelsPost({ post, media, onExpand }: { post: ReviewPost; media: PostMedia[]; onExpand: (idx: number) => void }) {
  const [muted, setMuted] = useState(true)
  const [liked, setLiked] = useState(false)
  const [playing, setPlaying] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const current = media[0]
  const username = post.account_username || "sua_conta"
  const accountName = post.account_name || "Sua Conta"
  const avatar = post.profile_picture_url || null
  const initials = accountName.slice(0, 2).toUpperCase()

  const togglePlay = () => {
    if (videoRef.current) {
      if (playing) videoRef.current.pause()
      else videoRef.current.play()
      setPlaying(p => !p)
    }
  }

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-2xl w-full" style={{ aspectRatio: "9/16" }}>
      {/* Video */}
      {current?.media_type === "video" ? (
        <video ref={videoRef} src={current.url} autoPlay loop muted={muted} playsInline
          className="absolute inset-0 w-full h-full object-cover" onClick={togglePlay} />
      ) : (
        <div className="absolute inset-0 bg-black">
          {current && <img src={current.url} alt="Reel" className="w-full h-full object-cover opacity-80" />}
        </div>
      )}

      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
            <Play className="w-8 h-8 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />

      {/* Right actions */}
      <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5 z-10">
        <button onClick={() => setLiked(l => !l)} className="flex flex-col items-center gap-1">
          <Heart className={cn("w-7 h-7", liked ? "fill-red-500 text-red-500" : "text-white")} />
          <span className="text-white text-[11px]">{liked ? "1.3M" : "1.2M"}</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <MessageCircle className="w-7 h-7 text-white" />
          <span className="text-white text-[11px]">8.5K</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <Send className="w-7 h-7 text-white" />
          <span className="text-white text-[11px]">Enviar</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <MoreHorizontal className="w-6 h-6 text-white" />
        </button>
        <div className="w-10 h-10 rounded-lg border-2 border-white overflow-hidden bg-[#DBDBDB] flex items-center justify-center">
          {avatar
            ? <img src={avatar} alt={accountName} className="w-full h-full object-cover" />
            : <span className="text-[9px] font-bold text-white">{initials}</span>}
        </div>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-4 left-4 right-16 z-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full border border-white overflow-hidden flex items-center justify-center bg-[#DBDBDB]">
            {avatar
              ? <img src={avatar} alt={accountName} className="w-full h-full object-cover" />
              : <span className="text-[8px] font-bold text-white">{initials}</span>}
          </div>
          <span className="text-white text-[13px] font-semibold">{username}</span>
          <span className="text-white/70 text-[11px]">• Seguir</span>
        </div>
        {post.content && (
          <p className="text-white text-[13px] leading-relaxed line-clamp-2 mb-2">{post.content}</p>
        )}
        <div className="flex items-center gap-1.5">
          <Music2 className="w-3.5 h-3.5 text-white flex-shrink-0" />
          <span className="text-white text-[11px] truncate">Áudio original • {username}</span>
        </div>
      </div>

      {/* Mute button */}
      <button
        onClick={e => { e.stopPropagation(); setMuted(m => !m) }}
        className="absolute top-4 right-3 z-10 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
      >
        {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
      </button>

      {/* Frame inteiro clicável para fullscreen (exceto botões de ação) */}
      <div className="absolute inset-0 z-0 cursor-zoom-in" onClick={() => onExpand(0)} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ReviewPageClient({ token }: { token: string }) {
  const [post, setPost] = useState<ReviewPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [fullscreenIdx, setFullscreenIdx] = useState<number | null>(null)

  const openFullscreen = useCallback((idx: number) => setFullscreenIdx(idx), [])
  const closeFullscreen = useCallback(() => setFullscreenIdx(null), [])

  useEffect(() => {
    fetch(`/api/review/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
          return
        }
        data.media = (data.media || [])
          .filter((m: PostMedia) => m.media_type !== "cover")
          .sort((a: PostMedia, b: PostMedia) => a.order_index - b.order_index)
        setPost(data)
        // Só mostra resultado se o revisor JÁ respondeu (não in_review)
        if (data.review_status === "approved" || data.review_status === "needs_changes") {
          setSubmitted(true)
          setDecision(data.review_status as Decision)
          setNotes(data.review_notes || "")
        }
      })
      .catch(() => setError("Erro ao carregar conteúdo"))
      .finally(() => setLoading(false))
  }, [token])

  const handleSubmit = async () => {
    if (!decision) return
    if (decision === "needs_changes" && !notes.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/review/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, notes: notes.trim() || null }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSubmitted(true)
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

  if (error || !post) {
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

  const media = post.media
  const postType = post.post_type || (media.some(m => m.media_type === "video") ? "reel" : "feed")
  const isStory = postType === "story"
  const isReel = postType === "reel"

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans">
      {fullscreenIdx !== null && (
        <FullscreenViewer media={media} initialIdx={fullscreenIdx} onClose={closeFullscreen} />
      )}
      {/* Header */}
      <header className="bg-white border-b border-[#DBDBDB] sticky top-0 z-20">
        <div className="w-full max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#8E8E8E] uppercase tracking-widest font-medium">Revisão de conteúdo</p>
          </div>
          <span className={cn(
            "text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap",
            submitted && decision === "approved" ? "bg-green-100 text-green-700"
              : submitted && decision === "needs_changes" ? "bg-amber-100 text-amber-700"
              : "bg-[#F0F0F0] text-[#8E8E8E]"
          )}>
            {submitted && decision === "approved" ? "Aprovado"
              : submitted && decision === "needs_changes" ? "Ajustes solicitados"
              : "Aguardando revisão"}
          </span>
        </div>
      </header>

      <main className="w-full max-w-xl mx-auto px-3 sm:px-4 py-4 flex flex-col items-center gap-4">

        {/* Label do formato */}
        <div className="w-full flex items-center justify-between">
          <span className="text-xs text-[#8E8E8E] font-medium uppercase tracking-wide">
            Visualização do post
          </span>
          <span className="text-xs font-semibold text-[#262626] bg-white border border-[#DBDBDB] px-2.5 py-1 rounded-full capitalize">
            {isStory ? "Story" : isReel ? "Reels" : media.length > 1 ? "Carrossel" : "Feed"}
          </span>
        </div>

        {/* Simulação do post — story e reels ficam centralizados em 9:16, feed ocupa largura total */}
        <div className={cn("w-full flex justify-center", (isStory || isReel) ? "px-6 sm:px-12" : "")}>
          {isStory ? (
            <StoryPost post={post} media={media} onExpand={openFullscreen} />
          ) : isReel ? (
            <ReelsPost post={post} media={media} onExpand={openFullscreen} />
          ) : (
            <FeedPost post={post} media={media} onExpand={openFullscreen} />
          )}
        </div>

        {/* Seção de decisão */}
        <div className="w-full">
          {submitted ? (
            <div className={cn(
              "rounded-2xl border p-6 flex flex-col items-center text-center gap-4",
              decision === "approved" ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"
            )}>
              {decision === "approved"
                ? <CheckCircle className="w-10 h-10 text-green-600" />
                : <XCircle className="w-10 h-10 text-amber-600" />}
              <div>
                <p className="font-semibold text-[#262626] text-base">
                  {decision === "approved" ? "Conteúdo aprovado!" : "Ajustes solicitados"}
                </p>
                <p className="text-sm text-[#8E8E8E] mt-1">
                  {decision === "approved"
                    ? "Sua aprovação foi registrada com sucesso."
                    : "Suas considerações foram enviadas ao produtor de conteúdo."}
                </p>
              </div>
              {notes && (
                <div className="w-full bg-white rounded-xl p-4 text-left border border-[#DBDBDB]">
                  <p className="text-xs text-[#8E8E8E] mb-1 font-medium uppercase tracking-wide">Suas considerações</p>
                  <p className="text-sm text-[#262626] whitespace-pre-wrap leading-relaxed">{notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#DBDBDB] rounded-2xl p-5 flex flex-col gap-5">
              <div>
                <p className="text-sm font-semibold text-[#262626]">O que você acha deste conteúdo?</p>
                <p className="text-xs text-[#8E8E8E] mt-0.5">Selecione uma opção para enviar sua resposta.</p>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => setDecision("approved")}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all",
                    decision === "approved"
                      ? "border-green-500 bg-green-50"
                      : "border-[#DBDBDB] hover:border-green-300 hover:bg-green-50/40"
                  )}
                >
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                    decision === "approved" ? "bg-green-100" : "bg-[#F0F0F0]")}>
                    <CheckCircle className={cn("w-5 h-5", decision === "approved" ? "text-green-600" : "text-[#8E8E8E]")} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#262626]">Aprovar publicação</p>
                    <p className="text-xs text-[#8E8E8E]">O conteúdo está ótimo, pode publicar!</p>
                  </div>
                </button>

                <button
                  onClick={() => setDecision("needs_changes")}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all",
                    decision === "needs_changes"
                      ? "border-amber-500 bg-amber-50"
                      : "border-[#DBDBDB] hover:border-amber-300 hover:bg-amber-50/40"
                  )}
                >
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                    decision === "needs_changes" ? "bg-amber-100" : "bg-[#F0F0F0]")}>
                    <XCircle className={cn("w-5 h-5", decision === "needs_changes" ? "text-amber-600" : "text-[#8E8E8E]")} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#262626]">Solicitar ajustes</p>
                    <p className="text-xs text-[#8E8E8E]">Tenho considerações sobre este conteúdo.</p>
                  </div>
                </button>
              </div>

              {decision === "needs_changes" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-[#262626]">
                    Descreva os ajustes necessários <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    placeholder="Escreva suas considerações aqui..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={4}
                    className="resize-none border-[#DBDBDB] text-sm focus:border-[#0095F6] focus:ring-[#0095F6]"
                  />
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={!decision || (decision === "needs_changes" && !notes.trim()) || submitting}
                className={cn(
                  "w-full h-11 font-semibold text-sm rounded-xl transition-all",
                  decision === "approved" ? "bg-green-600 hover:bg-green-700 text-white"
                    : decision === "needs_changes" ? "bg-amber-500 hover:bg-amber-600 text-white"
                    : "bg-[#0095F6] hover:bg-[#0086E0] text-white"
                )}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </span>
                ) : decision === "approved" ? "Confirmar aprovação"
                  : decision === "needs_changes" ? "Enviar considerações"
                  : "Selecione uma opção acima"}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
