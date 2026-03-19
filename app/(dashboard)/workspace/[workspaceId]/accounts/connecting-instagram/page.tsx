"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ConnectingInstagramPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { workspaceId } = useParams<{ workspaceId: string }>()

  const success = searchParams.get("success")
  const username = searchParams.get("username")
  const errorParam = searchParams.get("error")

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (success === "1") {
      setStatus("success")
      setMessage(username ? `@${username}` : "Conta conectada.")
      setTimeout(() => {
        router.push(`/workspace/${workspaceId}/accounts`)
      }, 2500)
      return
    }

    if (errorParam) {
      setStatus("error")
      try {
        setMessage(decodeURIComponent(errorParam))
      } catch {
        setMessage(errorParam)
      }
      return
    }

    // Se não tem nenhum param ainda, aguarda (pode estar carregando o redirect)
    setStatus("loading")
  }, [success, username, errorParam, workspaceId, router])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-sm bg-background border border-border rounded-2xl p-8 flex flex-col items-center gap-5 shadow-sm">
        {status === "loading" && (
          <>
            <div className="w-14 h-14 rounded-full bg-[oklch(0.52_0.25_15)]/10 flex items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin" style={{ color: "oklch(0.52 0.25 15)" }} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Conectando Instagram...</p>
              <p className="text-sm text-muted-foreground mt-1">Aguarde enquanto verificamos sua conta.</p>
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-success" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Conectado com sucesso!</p>
              {message && (
                <p className="text-sm text-muted-foreground mt-1">{message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">Redirecionando...</p>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-7 h-7 text-destructive" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Falha na conexão</p>
              {message && (
                <pre className="mt-3 text-xs bg-destructive/5 text-destructive p-3 rounded-lg text-left whitespace-pre-wrap break-all max-h-40 overflow-auto">
                  {message}
                </pre>
              )}
            </div>
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push(`/workspace/${workspaceId}/accounts`)}
              >
                Voltar
              </Button>
              <Button
                className="flex-1"
                onClick={() => window.history.back()}
              >
                Tentar novamente
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
