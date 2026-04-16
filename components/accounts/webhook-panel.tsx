"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Copy, Check, RefreshCw, Webhook, ChevronDown, ChevronUp, Eye, EyeOff, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  accountId: string
}

export function WebhookPanel({ accountId }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [hasSecret, setHasSecret] = useState<boolean | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)

  const load = async () => {
    if (webhookUrl) return // já carregado
    setLoading(true)
    try {
      const res = await fetch(`/api/social/accounts/${accountId}/webhook`)
      const data = await res.json()
      setWebhookUrl(data.webhook_url)
      setSecret(data.webhook_secret || null)
      setHasSecret(data.has_secret)
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = () => {
    const next = !open
    setOpen(next)
    if (next) load()
  }

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/social/accounts/${accountId}/webhook`, { method: "POST" })
      const data = await res.json()
      setWebhookUrl(data.webhook_url)
      setSecret(data.webhook_secret)
      setHasSecret(true)
      setShowSecret(true)
    } finally {
      setGenerating(false)
    }
  }

  const copy = async (text: string, setter: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  return (
    <div className="border-t border-border/50 mt-3 pt-3">
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
      >
        <Webhook className="w-3.5 h-3.5" />
        <span className="font-medium">Webhook de automação</span>
        {open ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2.5">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Carregando...
            </div>
          ) : (
            <>
              {/* URL do endpoint */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Endpoint</span>
                <div className="flex gap-1.5">
                  <Input
                    readOnly
                    value={webhookUrl || ""}
                    className="text-xs font-mono h-8 bg-muted/50"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => webhookUrl && copy(webhookUrl, setCopiedUrl)}
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Secret */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Secret</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-[11px] px-1.5 text-muted-foreground"
                    onClick={generate}
                    disabled={generating}
                  >
                    {generating ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="w-3 h-3 mr-1" />
                    )}
                    {hasSecret ? "Regenerar" : "Gerar secret"}
                  </Button>
                </div>
                {secret ? (
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <Input
                        readOnly
                        type={showSecret ? "text" : "password"}
                        value={secret}
                        className="text-xs font-mono h-8 bg-muted/50 pr-8"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => secret && copy(secret, setCopiedSecret)}
                    >
                      {copiedSecret ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nenhum secret gerado. Clique em &quot;Gerar secret&quot; para criar.
                  </p>
                )}
              </div>

              {/* Instrução resumida */}
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Envie um <code className="bg-muted px-1 rounded">POST</code> para o endpoint com o header{" "}
                <code className="bg-muted px-1 rounded">Authorization: Bearer &lt;secret&gt;</code> e o payload JSON com{" "}
                <code className="bg-muted px-1 rounded">content</code>,{" "}
                <code className="bg-muted px-1 rounded">media_urls</code> e{" "}
                <code className="bg-muted px-1 rounded">post_type</code>.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
