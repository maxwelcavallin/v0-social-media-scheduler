"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, XCircle, Loader2, Facebook, Instagram } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SavedAccount {
  platform: string
  name: string
}

export default function ConnectingPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const workspaceId = params.workspaceId as string

  const code = searchParams.get("code")
  const redirectUri = searchParams.get("redirectUri")

  const [status, setStatus] = useState<"processing" | "success" | "error">("processing")
  const [message, setMessage] = useState("Conectando com o Facebook...")
  const [saved, setSaved] = useState<SavedAccount[]>([])
  const [errorDetail, setErrorDetail] = useState("")

  useEffect(() => {
    if (!code || !workspaceId || !redirectUri) {
      setStatus("error")
      setMessage("Parâmetros inválidos.")
      return
    }

    const process = async () => {
      try {
        setMessage("Trocando código de autorização...")
        const res = await fetch("/api/social/meta/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, workspaceId, redirectUri }),
        })

        const data = await res.json()

        if (!res.ok || data.error) {
          setStatus("error")
          setMessage("Erro ao conectar conta.")
          setErrorDetail(data.error || "Erro desconhecido")
          return
        }

        setSaved(data.saved || [])
        setStatus("success")
        setMessage(`${data.count} conta(s) conectada(s) com sucesso!`)

        setTimeout(() => {
          router.push(`/workspace/${workspaceId}/accounts?connected=${data.count}`)
        }, 2500)
      } catch (err) {
        setStatus("error")
        setMessage("Erro de comunicação com o servidor.")
        setErrorDetail(err instanceof Error ? err.message : "Erro desconhecido")
      }
    }

    process()
  }, [code, workspaceId, redirectUri, router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card border rounded-xl p-8 max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          {status === "processing" && (
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          )}
          {status === "success" && (
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          )}
          {status === "error" && (
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
          )}
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">
            {status === "processing" && "Conectando contas..."}
            {status === "success" && "Contas conectadas!"}
            {status === "error" && "Falha na conexão"}
          </h2>
          <p className="text-sm text-muted-foreground">{message}</p>
          {errorDetail && (
            <p className="text-xs text-destructive mt-2 bg-destructive/10 rounded p-2 text-left font-mono">
              {errorDetail}
            </p>
          )}
        </div>

        {/* Saved accounts list */}
        {saved.length > 0 && (
          <div className="space-y-2 text-left">
            {saved.map((account, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                {account.platform === "facebook" ? (
                  <Facebook className="w-4 h-4 text-blue-600 shrink-0" />
                ) : (
                  <Instagram className="w-4 h-4 text-pink-600 shrink-0" />
                )}
                <span className="text-sm font-medium text-foreground">{account.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        {status === "error" && (
          <div className="flex gap-2">
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
        )}

        {status === "success" && (
          <p className="text-xs text-muted-foreground">Redirecionando em instantes...</p>
        )}
      </div>
    </div>
  )
}
