"use client"

import { useEffect, useState } from "react"
import {
  CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight,
  Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Volume2, VolumeX
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

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
  account_name?: string
  account_username?: string
  profile_picture_url?: string
  platform?: string
}

type Decision = "approved" | "needs_changes"

export default function ReviewPageClient({ token }: { token: string }) {
  const [post, setPost] = useState<ReviewPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mediaIndex, setMediaIndex] = useState(0)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    fetch(`/api/review/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          data.media = (data.media || [])
            .filter((m: PostMedia) => m.order_index >= 0)
            .sort((a: PostMedia, b: PostMedia) => a.order_index - b.order_index)
          setPost(data)
          // Só marca como já respondido se foi explicitamente aprovado ou ajustado pelo revisor
          // "in_review" significa aguardando revisão — não deve mostrar tela de resultado
          const alreadyDecided =
            data.review_status === "approved" || data.review_status === "needs_changes"
          if (alreadyDecided) {
            setSubmitted(true)
            setDecision(data.review_status as Decision)
            setNotes(data.review_notes || "")
          }
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

  const visibleMedia = post.media.filter((m) => m.order_index >= 0)
  const currentMedia = visibleMedia[mediaIndex]
  const accountName = post.account_name || "Sua Conta"
  const username = post.account_username || "sua_conta"
  const avatar = post.profile_picture_url || null
  const initials = accountName.slice(0, 2).toUpperCase()

  // Truncate legenda para preview do instagram (mostra "mais" como no app real)
  const maxCaptionPreview = 120
  const captionTruncated = post.content && post.content.length > maxCaptionPreview

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans">

      {/* Header da página de revisão */}
      <header className="bg-white border-b border-[#DBDBDB] sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#8E8E8E] uppercase tracking-widest font-medium">Revisão de conteúdo</p>
            <h1 className="text-sm font-semibold text-[#262626]">Aprovação de publicação</h1>
          </div>
          <span className={cn(
            "text-[11px] font-semibold px-2.5 py-1 rounded-full",
            submitted && decision === "approved"
              ? "bg-[#D4EDDA] text-[#155724]"
              : submitted && decision === "needs_changes"
              ? "bg-[#FFF3CD] text-[#856404]"
              : "bg-[#F0F0F0] text-[#8E8E8E]"
          )}>
            {submitted && decision === "approved"
              ? "Aprovado"
              : submitted && decision === "needs_changes"
              ? "Ajustes solicitados"
              : "Aguardando revisão"}
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 flex flex-col items-center gap-8">

        {/* iPhone 16 Pro Mockup */}
        <div className="w-full flex justify-center">
          <div className="relative" style={{ width: 320, filter: "drop-shadow(0 32px 64px rgba(0,0,0,0.18))" }}>

            {/* Corpo do iPhone */}
            <div
              className="relative rounded-[52px] overflow-hidden bg-black"
              style={{
                width: 320,
                boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.15), 0 0 0 1.5px #1C1C1C",
                aspectRatio: "320/660",
              }}
            >
              {/* Moldura lateral metalizada */}
              <div className="absolute inset-0 rounded-[52px] pointer-events-none z-30"
                style={{ boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.08)" }} />

              {/* Dynamic Island */}
              <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-20 bg-black rounded-full"
                style={{ width: 126, height: 34 }} />

              {/* Tela do Instagram */}
              <div className="absolute inset-0 bg-white overflow-y-auto overflow-x-hidden" style={{ borderRadius: 50 }}>

                {/* Status bar iOS */}
                <div className="flex items-center justify-between px-7 pt-14 pb-1 bg-white">
                  <span className="text-[11px] font-semibold text-[#262626]">9:41</span>
                  <div className="flex items-center gap-1.5">
                    {/* Signal */}
                    <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
                      <rect x="0" y="4" width="3" height="8" rx="1" fill="#262626"/>
                      <rect x="4.5" y="2.5" width="3" height="9.5" rx="1" fill="#262626"/>
                      <rect x="9" y="1" width="3" height="11" rx="1" fill="#262626"/>
                      <rect x="13.5" y="0" width="3" height="12" rx="1" fill="#262626"/>
                    </svg>
                    {/* Wifi */}
                    <svg width="16" height="12" viewBox="0 0 16 12" fill="#262626">
                      <path d="M8 9.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0-3.8a5.3 5.3 0 013.75 1.55l1.06-1.06A6.8 6.8 0 008 4.2a6.8 6.8 0 00-4.81 2l1.06 1.06A5.3 5.3 0 018 5.7zm0-3.8a8.6 8.6 0 016.1 2.53l1.07-1.07A10.1 10.1 0 008 0a10.1 10.1 0 00-7.17 3.36L1.9 4.43A8.6 8.6 0 018 1.9z"/>
                    </svg>
                    {/* Battery */}
                    <div className="flex items-center gap-0.5">
                      <div className="w-6 h-3 border border-[#262626] rounded-sm relative flex items-center px-0.5">
                        <div className="bg-[#262626] h-1.5 rounded-[1px]" style={{ width: "75%" }} />
                      </div>
                      <div className="w-0.5 h-1.5 bg-[#262626] rounded-r-sm" />
                    </div>
                  </div>
                </div>

                {/* Instagram top bar */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-[#DBDBDB]">
                  <svg viewBox="0 0 120 40" width="90" height="30" fill="none">
                    <text y="28" fontFamily="-apple-system, 'Billabong', cursive" fontSize="32" fill="#262626" fontStyle="italic">Instagram</text>
                  </svg>
                  <div className="flex items-center gap-4">
                    <Heart className="w-5 h-5 text-[#262626]" />
                    <MessageCircle className="w-5 h-5 text-[#262626]" />
                  </div>
                </div>

                {/* Stories bar */}
                <div className="flex gap-3 px-4 py-3 overflow-x-hidden bg-white border-b border-[#DBDBDB]">
                  {["Sua conta", "viagens", "food", "moda"].map((s, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0">
                      <div className={cn(
                        "w-11 h-11 rounded-full flex items-center justify-center",
                        i === 0 ? "bg-[#F0F0F0] border-2 border-[#DBDBDB]" : "p-0.5 bg-gradient-to-tr from-[#FFC300] via-[#E1306C] to-[#833AB4]"
                      )}>
                        <div className={cn(
                          "w-full h-full rounded-full bg-[#DBDBDB] flex items-center justify-center",
                          i !== 0 && "border-2 border-white"
                        )}>
                          <span className="text-[8px] font-bold text-[#8E8E8E]">{s[0].toUpperCase()}</span>
                        </div>
                      </div>
                      <span className="text-[9px] text-[#262626] truncate w-12 text-center">{s}</span>
                    </div>
                  ))}
                </div>

                {/* Post */}
                <div className="bg-white">
                  {/* Post header */}
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FFC300] via-[#E1306C] to-[#833AB4] p-0.5 flex-shrink-0">
                        <div className="w-full h-full rounded-full bg-white border border-white overflow-hidden flex items-center justify-center bg-[#DBDBDB]">
                          {avatar ? (
                            <img src={avatar} alt={accountName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[9px] font-bold text-[#8E8E8E]">{initials}</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-[#262626] leading-tight">{username}</p>
                        <p className="text-[9px] text-[#8E8E8E]">São Paulo, SP</p>
                      </div>
                    </div>
                    <MoreHorizontal className="w-4 h-4 text-[#262626]" />
                  </div>

                  {/* Mídia */}
                  <div className="relative bg-black" style={{ aspectRatio: "1/1" }}>
                    {currentMedia ? (
                      currentMedia.media_type === "video" ? (
                        <div className="relative w-full h-full">
                          <video
                            src={currentMedia.url}
                            autoPlay
                            loop
                            muted={muted}
                            playsInline
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => setMuted((m) => !m)}
                            className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center"
                          >
                            {muted
                              ? <VolumeX className="w-3.5 h-3.5 text-white" />
                              : <Volume2 className="w-3.5 h-3.5 text-white" />}
                          </button>
                        </div>
                      ) : (
                        <img src={currentMedia.url} alt="Post" className="w-full h-full object-cover" />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#F0F0F0]">
                        <span className="text-[#8E8E8E] text-xs">Sem mídia</span>
                      </div>
                    )}

                    {/* Carrossel navigation */}
                    {visibleMedia.length > 1 && (
                      <>
                        <button
                          onClick={() => setMediaIndex((i) => Math.max(0, i - 1))}
                          disabled={mediaIndex === 0}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center disabled:opacity-0 transition-opacity"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setMediaIndex((i) => Math.min(visibleMedia.length - 1, i + 1))}
                          disabled={mediaIndex === visibleMedia.length - 1}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center disabled:opacity-0 transition-opacity"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                          {visibleMedia.map((_, i) => (
                            <div
                              key={i}
                              className={cn(
                                "rounded-full transition-all",
                                i === mediaIndex ? "w-1.5 h-1.5 bg-[#0095F6]" : "w-1.5 h-1.5 bg-white/70"
                              )}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="px-3 pt-2.5 pb-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3.5">
                        <Heart className="w-5 h-5 text-[#262626]" />
                        <MessageCircle className="w-5 h-5 text-[#262626]" />
                        <Send className="w-5 h-5 text-[#262626]" />
                      </div>
                      <Bookmark className="w-5 h-5 text-[#262626]" />
                    </div>
                    <p className="text-[11px] font-semibold text-[#262626] mb-1">1.284 curtidas</p>

                    {/* Legenda */}
                    {post.content && (
                      <p className="text-[11px] text-[#262626] leading-relaxed">
                        <span className="font-semibold">{username} </span>
                        {captionTruncated
                          ? <>{post.content.slice(0, maxCaptionPreview)}<span className="text-[#8E8E8E]">... mais</span></>
                          : post.content
                        }
                      </p>
                    )}
                    <p className="text-[9px] text-[#8E8E8E] mt-1.5 uppercase tracking-wide">Há 2 horas</p>
                  </div>

                  {/* Bottom bar do Instagram */}
                  <div className="flex items-center justify-around px-4 py-2 border-t border-[#DBDBDB] mt-1">
                    {[
                      <svg key="home" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#262626" strokeWidth="1.5"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
                      <svg key="search" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#8E8E8E" strokeWidth="1.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-3.5-3.5"/></svg>,
                      <svg key="add" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#8E8E8E" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>,
                      <svg key="reel" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#8E8E8E" strokeWidth="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 9h20M7 5v4M12 5v4M17 5v4"/></svg>,
                      <div key="profile" className="w-6 h-6 rounded-full bg-[#DBDBDB] overflow-hidden flex items-center justify-center">
                        {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-[8px] font-bold text-[#8E8E8E]">{initials}</span>}
                      </div>
                    ].map((icon, i) => (
                      <button key={i} className="p-1">{icon}</button>
                    ))}
                  </div>

                  {/* Home indicator iOS */}
                  <div className="flex justify-center py-2">
                    <div className="w-28 h-1 bg-[#262626] rounded-full opacity-20" />
                  </div>
                </div>
              </div>
            </div>

            {/* Botões laterais do iPhone */}
            {/* Volume */}
            <div className="absolute left-[-4px] top-[120px] w-1 h-8 bg-[#2A2A2A] rounded-l-sm" />
            <div className="absolute left-[-4px] top-[162px] w-1 h-12 bg-[#2A2A2A] rounded-l-sm" />
            <div className="absolute left-[-4px] top-[188px] w-1 h-12 bg-[#2A2A2A] rounded-l-sm" />
            {/* Power */}
            <div className="absolute right-[-4px] top-[148px] w-1 h-16 bg-[#2A2A2A] rounded-r-sm" />
          </div>
        </div>

        {/* Seção de decisão */}
        <div className="w-full">
          {submitted ? (
            <div className={cn(
              "rounded-2xl border p-6 flex flex-col items-center text-center gap-4",
              decision === "approved"
                ? "border-green-200 bg-green-50"
                : "border-amber-200 bg-amber-50"
            )}>
              {decision === "approved"
                ? <CheckCircle className="w-10 h-10 text-green-600" />
                : <XCircle className="w-10 h-10 text-amber-600" />
              }
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
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                    decision === "approved" ? "bg-green-100" : "bg-[#F0F0F0]"
                  )}>
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
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                    decision === "needs_changes" ? "bg-amber-100" : "bg-[#F0F0F0]"
                  )}>
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
                    onChange={(e) => setNotes(e.target.value)}
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
                  decision === "approved"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : decision === "needs_changes"
                    ? "bg-amber-500 hover:bg-amber-600 text-white"
                    : "bg-[#0095F6] hover:bg-[#0086E0] text-white"
                )}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </span>
                ) : decision === "approved"
                  ? "Confirmar aprovação"
                  : decision === "needs_changes"
                  ? "Enviar considerações"
                  : "Selecione uma opção acima"}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
