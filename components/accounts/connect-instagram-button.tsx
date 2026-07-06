"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  Instagram,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
  UserCheck,
  Check,
  ExternalLink,
  RefreshCw,
} from "lucide-react"

type Step = "intro" | "waiting" | "processing" | "success" | "error"

interface ConnectedProfile {
  username: string
  name: string
  profile_picture_url?: string
  account_type?: string
  followers_count?: number
}

const ERROR_MESSAGES: Record<string, string> = {
  cancelled: "A autorização foi cancelada. Tente novamente quando estiver pronto.",
  insufficient_permissions:
    "O acesso foi autorizado, mas algumas permissões necessárias não foram concedidas. Tente novamente e aceite todas as permissões solicitadas.",
  popup_blocked:
    "O popup foi bloqueado pelo navegador. Por favor, permita popups para este site e tente novamente.",
  default: "Ocorreu um erro inesperado. Tente novamente em instantes.",
}

function InstagramGradientIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ig-grad" x1="0" y1="32" x2="32" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F77737" />
          <stop offset="0.5" stopColor="#FD1D1D" />
          <stop offset="1" stopColor="#833AB4" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#ig-grad)" />
      <circle cx="16" cy="16" r="5.5" stroke="white" strokeWidth="2" fill="none" />
      <circle cx="22.5" cy="9.5" r="1.5" fill="white" />
    </svg>
  )
}

function formatFollowers(n?: number) {
  if (!n) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString("pt-BR")
}

export function ConnectInstagramButton({
  onSuccess,
  label = "Conectar Instagram",
  className,
}: {
  onSuccess?: () => void
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("intro")
  const [errorMessage, setErrorMessage] = useState("")
  const [profile, setProfile] = useState<ConnectedProfile | null>(null)
  const popupRef = useRef<Window | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const messageHandlerRef = useRef<((e: MessageEvent) => void) | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (messageHandlerRef.current) window.removeEventListener("message", messageHandlerRef.current)
    }
  }, [])

  const resetModal = () => {
    setStep("intro")
    setErrorMessage("")
    setProfile(null)
    if (pollRef.current) clearInterval(pollRef.current)
    if (messageHandlerRef.current) window.removeEventListener("message", messageHandlerRef.current)
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close()
  }

  const handleClose = () => {
    resetModal()
    setOpen(false)
  }

  const handleSuccess = () => {
    onSuccess?.()
    handleClose()
    window.location.reload()
  }

  const startOAuth = () => {
    setStep("waiting")
    setErrorMessage("")

    const w = 560, h = 650
    const left = Math.round(window.screen.width / 2 - w / 2)
    const top = Math.round(window.screen.height / 2 - h / 2)
    const popup = window.open(
      `/api/social/instagram/authorize`,
      "instagram_oauth",
      `width=${w},height=${h},left=${left},top=${top},toolbar=0,menubar=0,status=0`
    )

    if (!popup) {
      setStep("error")
      setErrorMessage(ERROR_MESSAGES.popup_blocked)
      return
    }
    popupRef.current = popup

    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== "instagram_oauth_callback") return

      window.removeEventListener("message", onMessage)
      if (pollRef.current) clearInterval(pollRef.current)
      popup.close()

      const { code, redirectUri, error } = event.data

      if (error === "access_denied" || !code) {
        setStep("error")
        setErrorMessage(ERROR_MESSAGES.cancelled)
        return
      }

      setStep("processing")

      try {
        const res = await fetch("/api/social/instagram/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirectUri }),
        })
        const data = await res.json()

        if (!res.ok) {
          setStep("error")
          setErrorMessage(data.error || ERROR_MESSAGES.default)
          return
        }

        setProfile(data.profile || null)
        setStep("success")
      } catch {
        setStep("error")
        setErrorMessage(ERROR_MESSAGES.default)
      }
    }

    messageHandlerRef.current = onMessage
    window.addEventListener("message", onMessage)

    pollRef.current = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollRef.current!)
        if (messageHandlerRef.current) {
          window.removeEventListener("message", messageHandlerRef.current)
          messageHandlerRef.current = null
        }
        // Se ainda estava esperando (nenhuma mensagem recebida), considera cancelado
        setStep((prev) => {
          if (prev === "waiting") {
            setErrorMessage(ERROR_MESSAGES.cancelled)
            return "error"
          }
          return prev
        })
      }
    }, 600)
  }

  return (
    <>
      <Button
        onClick={() => { resetModal(); setOpen(true) }}
        className={cn(
          "gap-2 text-white border-0",
          "bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737]",
          "hover:opacity-90 transition-opacity",
          className
        )}
      >
        <Instagram className="w-4 h-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
        <DialogContent className="max-w-[480px] p-0 overflow-hidden gap-0">

          {/* Intro */}
          {step === "intro" && (
            <div className="flex flex-col">
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <InstagramGradientIcon size={36} />
                  <DialogTitle className="text-lg font-semibold">Conectar Instagram</DialogTitle>
                </div>
              </DialogHeader>

              <div className="px-6 py-5 flex flex-col gap-5">
                <div>
                  <p className="text-sm font-medium text-foreground mb-3">O que você vai precisar:</p>
                  <div className="flex flex-col gap-2.5">
                    {[
                      { Icon: UserCheck, text: <span>Uma conta do Instagram do tipo <strong>Business</strong> ou <strong>Creator</strong></span> },
                      { Icon: ShieldCheck, text: <span>Acesso ao perfil do Instagram (login e senha do próprio Instagram)</span> },
                      { Icon: Check, text: <span>Não é necessário conta no Facebook ou Business Manager</span> },
                    ].map(({ Icon, text }, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className="w-3 h-3 text-emerald-600" />
                        </div>
                        <span className="text-sm text-foreground">{text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Você será redirecionado para a tela oficial do Instagram para autorizar o acesso. Seus dados de login <strong>nunca</strong> passam pela nossa plataforma.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30">
                <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                <Button
                  onClick={startOAuth}
                  className="gap-2 text-white border-0 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] hover:opacity-90"
                >
                  Continuar <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Aguardando popup */}
          {step === "waiting" && (
            <div className="flex flex-col items-center px-8 py-12 text-center gap-5">
              <div className="relative">
                <InstagramGradientIcon size={56} />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-background rounded-full border border-border flex items-center justify-center">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-foreground" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-base font-semibold text-foreground">Aguardando autorização...</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Uma janela do Instagram foi aberta. Faça login e autorize o acesso.
                </p>
              </div>
              <button
                onClick={startOAuth}
                className="text-xs text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
              >
                Se a janela não abriu, clique aqui para tentar novamente
              </button>
              <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
            </div>
          )}

          {/* Processando */}
          {step === "processing" && (
            <div className="flex flex-col items-center px-8 py-12 text-center gap-5">
              <div className="relative">
                <InstagramGradientIcon size={56} />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-background rounded-full border border-border flex items-center justify-center">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-foreground" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-base font-semibold text-foreground">Verificando permissões...</p>
                <p className="text-sm text-muted-foreground">Estamos configurando o acesso à sua conta.</p>
              </div>
            </div>
          )}

          {/* Sucesso */}
          {step === "success" && (
            <div className="flex flex-col">
              <div className="flex flex-col items-center px-8 pt-8 pb-6 text-center gap-4">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center animate-in zoom-in-50 duration-300">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-base font-semibold text-foreground">Conta conectada com sucesso!</p>

                {profile && (
                  <div className="w-full rounded-lg border border-border bg-muted/30 px-4 py-3 flex items-center gap-3 text-left">
                    {profile.profile_picture_url ? (
                      <img
                        src={profile.profile_picture_url}
                        alt={profile.username}
                        className="w-12 h-12 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#833AB4] to-[#F77737] flex items-center justify-center shrink-0">
                        <Instagram className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">@{profile.username}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {profile.account_type && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                            {profile.account_type === "BUSINESS" ? "Business" : profile.account_type === "MEDIA_CREATOR" ? "Creator" : profile.account_type}
                          </span>
                        )}
                        {profile.followers_count !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            {formatFollowers(profile.followers_count)} seguidores
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Token válido por 60 dias. Você receberá um aviso quando estiver próximo de expirar.
                </p>
              </div>

              <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
                <button
                  onClick={() => resetModal()}
                  className="text-xs text-primary underline underline-offset-2 hover:opacity-80"
                >
                  + Conectar outra conta
                </button>
                <Button onClick={handleSuccess}>Fechar</Button>
              </div>
            </div>
          )}

          {/* Erro */}
          {step === "error" && (
            <div className="flex flex-col">
              <div className="flex flex-col items-center px-8 pt-8 pb-6 text-center gap-4">
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-base font-semibold text-foreground">Não foi possível conectar</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {errorMessage || ERROR_MESSAGES.default}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30">
                <Button variant="outline" onClick={handleClose}>Fechar</Button>
                <Button onClick={() => setStep("intro")} className="gap-2">
                  <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
                </Button>
              </div>
            </div>
          )}

        </DialogContent>
      </Dialog>
    </>
  )
}
