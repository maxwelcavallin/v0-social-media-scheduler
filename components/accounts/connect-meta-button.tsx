"use client"

import { Button } from "@/components/ui/button"
import { Facebook, Plus } from "lucide-react"

interface Props {
  workspaceId: string
}

export function ConnectMetaButton({ workspaceId }: Props) {
  const handleConnect = () => {
    window.location.href = `/api/social/meta/authorize?workspaceId=${workspaceId}`
  }

  return (
    <Button onClick={handleConnect} className="gap-2" size="sm">
      <Facebook className="w-4 h-4" />
      Conectar via Facebook
    </Button>
  )
}
