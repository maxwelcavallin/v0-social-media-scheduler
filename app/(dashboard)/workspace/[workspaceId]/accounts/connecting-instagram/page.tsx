"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import { CheckCircle2, XCircle, Loader2, Instagram } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ConnectingInstagramPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { workspaceId } = useParams<{ workspaceId: string }>()

  const code = searchParams.get("code")
  const redirectUri = searchParams.get("redirectUri")

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")
  const [accounts, setAccounts] = useState<string[]>([])

  useEffect(() => {
    if (!code || !workspaceId) {
      setStatus("error")
      setMessage("Parâmetros inválidos.")
      return
    }

    const process = async () => {
      try {
        const res = await fetch("/api/social/instagram/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, workspaceId, redirectUri }),
        })
        const data = await res.json()

        if (!res.ok || data.error) {
          setStatus("error")
          setMessage(data.error || "Erro ao conectar conta.")
          return
        }

        setStatus("success")
        setAccounts(data.accounts || [])
        setMessage(`${data.saved} conta(s) conectada(s) com sucesso.`)
        setTimeout(() => {
          router.push(`/workspace/${workspaceId}/accounts`)
        }, 2500)
      } catch (err: any) {
        setStatus("error")
        setMessage(err.message || "Erro inesperado.")
      }
    }

    process()
  }, [code, workspaceId, redirectUri, router])

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
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Instagram conectado com sucesso!</p>
              {accounts.length > 0 && (
                <p className="text-sm text-muted-foreground mt-1">{accounts.join(", ")}</p>
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
              <p className="font-semibold text-foreground">Não foi possível conectar</p>
              {message && (
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{message}</p>
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
                onClick={() => router.push(`/workspace/${workspaceId}/accounts`)}
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
