"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Facebook, CheckCircle2, AlertTriangle } from "lucide-react"

interface Props {
  workspaceId: string
}

export function ConnectMetaButton({ workspaceId }: Props) {
  const [open, setOpen] = useState(false)

  const handleConnect = () => {
    setOpen(false)
    const url = `/api/social/meta/authorize?workspaceId=${encodeURIComponent(workspaceId)}`

    // Dimensões generosas para o Facebook exibir todas as empresas sem scroll truncado
    const width = 720
    const height = 760
    const left = Math.max(0, (window.screen.width - width) / 2)
    const top = Math.max(0, (window.screen.height - height) / 2)

    const popup = window.open(
      url,
      "facebook_oauth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`,
    )

    // Monitora o fechamento do popup e recarrega a página para refletir a conta conectada
    if (popup) {
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer)
          window.location.reload()
        }
      }, 500)
    } else {
      // Fallback: se o popup for bloqueado, redireciona na mesma aba
      window.location.href = url
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" size="sm">
          <Facebook className="w-4 h-4" />
          Conectar via Facebook
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Antes de conectar</DialogTitle>
          <DialogDescription>
            Você só precisa conectar uma vez. Depois, use <strong>&quot;Adicionar páginas&quot;</strong> para
            escolher quais páginas usar em cada workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              Na tela do Facebook, mantenha <strong>TODAS as páginas marcadas</strong> — inclusive as que você
              usa em outros workspaces. Desmarcar uma página faz o Facebook revogar o acesso a ela em todo o app.
            </p>
          </div>
          <div className="flex items-start gap-2.5 px-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Selecionar todas as páginas não expõe nada indevidamente: você continua escolhendo, dentro do app,
              quais páginas aparecem em cada workspace.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConnect} className="gap-2">
            <Facebook className="w-4 h-4" />
            Continuar para o Facebook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
