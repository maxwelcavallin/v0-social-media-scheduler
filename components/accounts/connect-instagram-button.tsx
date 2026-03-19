"use client"

import { Button } from "@/components/ui/button"
import { Instagram } from "lucide-react"

interface Props {
  workspaceId: string
}

export function ConnectInstagramButton({ workspaceId }: Props) {
  const handleConnect = () => {
    window.location.href = `/api/social/instagram/authorize?workspaceId=${workspaceId}`
  }

  return (
    <Button
      onClick={handleConnect}
      variant="outline"
      size="sm"
      className="gap-2 border-[oklch(0.52_0.25_15)]/40 text-[oklch(0.52_0.25_15)] hover:bg-[oklch(0.52_0.25_15)]/5"
    >
      <Instagram className="w-4 h-4" />
      Conectar Instagram direto
    </Button>
  )
}
