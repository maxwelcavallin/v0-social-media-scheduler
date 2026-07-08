"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, XCircle, Loader2, Facebook, Instagram } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SavedAccount {
  platform: string
  name: string
}

export default function DashboardConnectingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const code = searchParams.get("code")
  const redirectUri = searchParams.get("redirectUri")
  const fbError = searchParams.get("fb_error")

  const [status, setStatus] = useState<"processing" | "success" | "error">("processing")
  const [message, setMessage] = useState("Conectando com o Facebook...")
  const [saved, setSaved] = useState<SavedAccount[]>([])
  const [errorDetail, setErrorDetail] = useState("")

  useEffect(() => {
    // Erro devolvido direto pelo Facebook
    if (fbError) {
      setStatus("error")
      setMessage("Autorização negada pelo Facebook.")
      setErrorDetail(searchParams.get("fb_reason") || fbError)
      return
    }

    if (!code || !redirectUri) {
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
          // Conexão no nível da empresa — sem workspaceId
          body: JSON.stringify({ code, redirectUri }),
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
        setMessage(
          data.count > 0
            ? `${data.count} conta(s) adicionada(s) ao pool da empresa.`
            : "Contas já estavam no pool da empresa (tokens atualizados)."
        )

        setTimeout(() => {
          router.push("/dashboard?connected=facebook")
        }, 2500)
      } catch (err) {
        setStatus("error")
        setMessage("Erro de comunicação com o servidor.")
        setErrorDetail(err instanceof Error ? err.message : "Erro desconhecido")
      }
    }

    process()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card border rounded-xl p-8 max-w-md w-full text-center space-y-6">
        {/* Ícone de status */}
        <div className="flex justify-center">
          {status === "processing" && (
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          )}
          {status === "success" && (
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          )}
          {status === "error" && (
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
          )}
        </div>

        {/* Título e mensagem */}
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">
            {status === "processing" && "Conectando contas..."}
            {status === "success" && "Contas conectadas!"}
            {status === "error" && "Falha na conexão"}
          </h2>
          <p className="text-sm text-muted-foreground">{message}</p>
          {errorDetail && (
            <p className="text-xs text-destructive mt-2 bg-destructive/10 rounded p-2 text-left font-mono break-all">
              {errorDetail}
            </p>
          )}
        </div>

        {/* Lista de contas salvas */}
        {saved.length > 0 && (
          <div className="space-y-2 text-left">
            {saved.map((account, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                {account.platform === "facebook" ? (
                  <Facebook className="w-4 h-4 text-blue-600 shrink-0" />
                ) : (
                  <Instagram className="w-4 h-4 text-pink-600 shrink-0" />
                )}
                <span className="text-sm font-medium text-foreground truncate">{account.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Ações */}
        {status === "error" && (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => router.push("/dashboard")}>
              Voltar
            </Button>
            <Button className="flex-1" onClick={() => router.push("/dashboard")}>
              Tentar novamente
            </Button>
          </div>
        )}

        {status === "success" && (
          <p className="text-xs text-muted-foreground">Redirecionando para a Visão Geral...</p>
        )}
      </div>
    </div>
  )
}
