"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { FlaskConical, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react"

interface TestResult {
  success: boolean
  error?: string
  action_required?: "reconnect"
  granted_scopes?: string[]
  account_username?: string
  container_id?: string
  media_id?: string
  api_responses?: { step: string; url?: string; status: number; body: unknown }[]
}

interface Props {
  accountId: string
  accountUsername?: string
}

export function InstagramTestButton({ accountId, accountUsername }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [open, setOpen] = useState(false)
  const [expandedSteps, setExpandedSteps] = useState<number[]>([])

  const toggleStep = (i: number) => {
    setExpandedSteps(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])
  }

  const handleTest = async () => {
    setLoading(true)
    setResult(null)
    setOpen(true)
    try {
      const res = await fetch("/api/social/instagram/test-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      })
      const data = await res.json()
      setResult(data)
    } catch (err: any) {
      setResult({ success: false, error: err.message || "Erro de rede" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs h-7 border-dashed border-primary/40 text-primary hover:bg-primary/5"
        onClick={handleTest}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <FlaskConical className="w-3 h-3" />
        )}
        Testar Graph API
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-primary" />
              Teste de Publicação — Instagram Graph API
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {loading && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm">Executando chamadas à Graph API…</p>
                <p className="text-xs text-muted-foreground/70">Aguardando processamento do container Instagram</p>
              </div>
            )}

            {result && (
              <>
                {/* Status principal */}
                <div className={`flex items-start gap-3 rounded-lg border p-4 ${
                  result.success
                    ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                    : result.action_required === "reconnect"
                      ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                }`}>
                  {result.success
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    : <XCircle className={`w-5 h-5 shrink-0 mt-0.5 ${result.action_required === "reconnect" ? "text-amber-500" : "text-red-500 dark:text-red-400"}`} />
                  }
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${
                      result.success
                        ? "text-emerald-800 dark:text-emerald-300"
                        : result.action_required === "reconnect"
                          ? "text-amber-800 dark:text-amber-300"
                          : "text-red-700 dark:text-red-300"
                    }`}>
                      {result.success
                        ? "Publicação realizada com sucesso"
                        : result.action_required === "reconnect"
                          ? "Reconexão necessária — token sem permissão de publicação"
                          : "Falha na publicação"}
                    </p>
                    {result.error && (
                      <p className={`text-xs mt-1 leading-relaxed whitespace-pre-wrap ${
                        result.action_required === "reconnect"
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        {result.error}
                      </p>
                    )}
                    {result.action_required === "reconnect" && (
                      <p className="text-xs mt-2 font-medium text-amber-900 dark:text-amber-200">
                        Clique em "Desconectar" nesta conta e reconecte-a para gerar um token atualizado com o scope de publicação.
                      </p>
                    )}
                  </div>
                </div>

                {/* IDs gerados */}
                {result.success && (
                  <div className="grid grid-cols-2 gap-3">
                    {result.container_id && (
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Container ID</p>
                        <p className="text-xs font-mono text-foreground break-all">{result.container_id}</p>
                      </div>
                    )}
                    {result.media_id && (
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Media ID</p>
                        <p className="text-xs font-mono text-foreground break-all">{result.media_id}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Log detalhado de chamadas */}
                {result.api_responses && result.api_responses.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Log de chamadas à API ({result.api_responses.length})
                    </p>
                    {result.api_responses.map((r, i) => {
                      const isExpanded = expandedSteps.includes(i)
                      const isOk = r.status >= 200 && r.status < 300
                      return (
                        <div key={i} className="rounded-lg border overflow-hidden">
                          <button
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/40 transition-colors text-left"
                            onClick={() => toggleStep(i)}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge
                                variant={isOk ? "outline" : "destructive"}
                                className="text-[10px] shrink-0"
                              >
                                {r.status}
                              </Badge>
                              <span className="text-xs font-medium text-foreground truncate">{r.step}</span>
                            </div>
                            {isExpanded
                              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            }
                          </button>
                          {isExpanded && (
                            <div className="border-t bg-muted/20 p-3 space-y-2">
                              <p className="text-[10px] text-muted-foreground font-mono break-all">{r.url.split("?")[0]}</p>
                              <pre className="text-[11px] font-mono bg-background rounded p-2 border overflow-auto max-h-48 whitespace-pre-wrap break-all">
                                {JSON.stringify(r.body, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
