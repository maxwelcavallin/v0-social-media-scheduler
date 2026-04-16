"use client"

import { useEffect, useState } from "react"
import { CheckCircle, XCircle, ChevronLeft, ChevronRight, AlertCircle, Clock } from "lucide-react"
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

  useEffect(() => {
    fetch(`/api/review/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else {
          // Ordena mídia por order_index, ignora -1 (capa)
          data.media = (data.media || [])
            .filter((m: PostMedia) => m.order_index >= 0)
            .sort((a: PostMedia, b: PostMedia) => a.order_index - b.order_index)
          setPost(data)
          if (data.review_status && data.review_status !== "pending") {
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Link inválido</h1>
          <p className="text-muted-foreground text-sm">{error || "Este link de revisão não existe ou expirou."}</p>
        </div>
      </div>
    )
  }

  const visibleMedia = post.media.filter((m) => m.order_index >= 0)
  const currentMedia = visibleMedia[mediaIndex]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Revisão de conteúdo</p>
            <h1 className="text-base font-semibold text-foreground">Aprovação de publicação</h1>
          </div>
          <div className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
            submitted && decision === "approved"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : submitted && decision === "needs_changes"
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-muted text-muted-foreground"
          )}>
            <Clock className="w-3 h-3" />
            {submitted && decision === "approved"
              ? "Aprovado"
              : submitted && decision === "needs_changes"
              ? "Ajustes solicitados"
              : "Aguardando revisão"}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Mídia */}
        {visibleMedia.length > 0 && (
          <div className="relative rounded-xl overflow-hidden bg-muted aspect-square">
            {currentMedia.media_type === "video" ? (
              <video
                src={currentMedia.url}
                controls
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <img
                src={currentMedia.url}
                alt={`Mídia ${mediaIndex + 1}`}
                className="w-full h-full object-contain"
              />
            )}

            {/* Navegação carrossel */}
            {visibleMedia.length > 1 && (
              <>
                <button
                  onClick={() => setMediaIndex((i) => Math.max(0, i - 1))}
                  disabled={mediaIndex === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center disabled:opacity-30 hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setMediaIndex((i) => Math.min(visibleMedia.length - 1, i + 1))}
                  disabled={mediaIndex === visibleMedia.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center disabled:opacity-30 hover:bg-black/70 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {visibleMedia.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setMediaIndex(i)}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full transition-colors",
                        i === mediaIndex ? "bg-white" : "bg-white/50"
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Legenda */}
        {post.content && (
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Legenda</p>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{post.content}</p>
          </div>
        )}

        {/* Resultado já enviado */}
        {submitted ? (
          <div className={cn(
            "rounded-xl border p-5 flex flex-col items-center text-center gap-3",
            decision === "approved"
              ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
              : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
          )}>
            {decision === "approved" ? (
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="w-10 h-10 text-amber-600 dark:text-amber-400" />
            )}
            <div>
              <p className="font-semibold text-foreground">
                {decision === "approved" ? "Conteúdo aprovado!" : "Ajustes solicitados"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {decision === "approved"
                  ? "Sua aprovação foi registrada com sucesso."
                  : "Suas considerações foram enviadas ao produtor de conteúdo."}
              </p>
            </div>
            {notes && (
              <div className="w-full bg-background rounded-lg p-3 text-left border border-border">
                <p className="text-xs text-muted-foreground mb-1 font-medium">Suas considerações</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{notes}</p>
              </div>
            )}
          </div>
        ) : (
          /* Área de decisão */
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
            <p className="text-sm font-medium text-foreground">O que você acha deste conteúdo?</p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => setDecision("approved")}
                className={cn(
                  "flex items-center gap-3 p-3.5 rounded-lg border-2 text-left transition-colors",
                  decision === "approved"
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                    : "border-border hover:border-green-300 hover:bg-green-50/50 dark:hover:bg-green-900/10"
                )}
              >
                <CheckCircle className={cn("w-5 h-5 flex-shrink-0", decision === "approved" ? "text-green-600" : "text-muted-foreground")} />
                <div>
                  <p className="text-sm font-medium text-foreground">Aprovar publicação</p>
                  <p className="text-xs text-muted-foreground">O conteúdo está ótimo, pode publicar!</p>
                </div>
              </button>

              <button
                onClick={() => setDecision("needs_changes")}
                className={cn(
                  "flex items-center gap-3 p-3.5 rounded-lg border-2 text-left transition-colors",
                  decision === "needs_changes"
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                    : "border-border hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-900/10"
                )}
              >
                <XCircle className={cn("w-5 h-5 flex-shrink-0", decision === "needs_changes" ? "text-amber-600" : "text-muted-foreground")} />
                <div>
                  <p className="text-sm font-medium text-foreground">Solicitar ajustes</p>
                  <p className="text-xs text-muted-foreground">Tenho considerações sobre este conteúdo.</p>
                </div>
              </button>
            </div>

            {decision === "needs_changes" && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground">
                  Descreva os ajustes necessários <span className="text-destructive">*</span>
                </label>
                <Textarea
                  placeholder="Escreva suas considerações aqui..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!decision || (decision === "needs_changes" && !notes.trim()) || submitting}
              className="w-full"
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
      </main>
    </div>
  )
}
