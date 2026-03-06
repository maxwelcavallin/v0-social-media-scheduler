"use client"

import { Button } from "@/components/ui/button"
import { Instagram } from "lucide-react"

interface Props {
  workspaceId: string
}

export function ConnectInstagramButton({ workspaceId }: Props) {
  const handleConnect = () => {
    const redirectUri = `${window.location.origin}/api/social/instagram/callback`
    const state = btoa(JSON.stringify({ workspaceId, redirectUri }))

    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_APP_FACEBOOK_ID || "",
      redirect_uri: redirectUri,
      scope: [
        "instagram_basic",
        "instagram_content_publish",
        "instagram_manage_comments",
        "instagram_manage_insights",
        "pages_show_list",
        "pages_read_engagement",
      ].join(","),
      response_type: "code",
      state,
    })

    window.location.href = `https://api.instagram.com/oauth/authorize?${params.toString()}`
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
