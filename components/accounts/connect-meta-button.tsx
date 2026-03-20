"use client"

import { Button } from "@/components/ui/button"
import { Facebook } from "lucide-react"

interface Props {
  workspaceId: string
}

export function ConnectMetaButton({ workspaceId }: Props) {
  const handleConnect = () => {
    const url = `/api/social/meta/authorize?workspaceId=${encodeURIComponent(workspaceId)}`

    // Dimensões generosas para o Facebook exibir todas as empresas sem scroll truncado
    const width = 720
    const height = 760
    const left = Math.max(0, (window.screen.width - width) / 2)
    const top = Math.max(0, (window.screen.height - height) / 2)

    const popup = window.open(
      url,
      "facebook_oauth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
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
    <Button onClick={handleConnect} className="gap-2" size="sm">
      <Facebook className="w-4 h-4" />
      Conectar via Facebook
    </Button>
  )
}
