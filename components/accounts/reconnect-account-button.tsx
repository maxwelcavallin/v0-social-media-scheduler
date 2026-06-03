"use client"

import { RefreshCw } from "lucide-react"
import { ConnectInstagramButton } from "./connect-instagram-button"

interface Props {
  platform: "instagram" | "facebook"
  workspaceId: string
}

// Para o Facebook, abre o popup OAuth diretamente (mesmo fluxo do ConnectMetaButton)
function FacebookReconnectButton({ workspaceId }: { workspaceId: string }) {
  const handleReconnect = () => {
    const url = `/api/social/meta/authorize?workspaceId=${encodeURIComponent(workspaceId)}`
    const width = 720
    const height = 760
    const left = Math.max(0, (window.screen.width - width) / 2)
    const top = Math.max(0, (window.screen.height - height) / 2)
    const popup = window.open(
      url,
      "facebook_oauth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
    )
    if (popup) {
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer)
          window.location.reload()
        }
      }, 500)
    } else {
      window.location.href = url
    }
  }

  return (
    <button
      onClick={handleReconnect}
      className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 hover:underline font-medium"
      title="Reconectar conta do Facebook"
    >
      <RefreshCw className="w-3 h-3" />
      Reconectar
    </button>
  )
}

export function ReconnectAccountButton({ platform, workspaceId }: Props) {
  if (platform === "instagram") {
    return (
      <ConnectInstagramButton
        workspaceId={workspaceId}
        label="Reconectar"
        className="h-auto py-0.5 px-2 text-xs font-medium bg-none bg-transparent text-amber-700 dark:text-amber-400 hover:underline hover:opacity-100 shadow-none border-0 gap-1"
      />
    )
  }

  return <FacebookReconnectButton workspaceId={workspaceId} />
}
