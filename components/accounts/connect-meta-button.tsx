"use client"

import { Button } from "@/components/ui/button"
import { Facebook, Plus } from "lucide-react"

interface Props {
  workspaceId: string
}

export function ConnectMetaButton({ workspaceId }: Props) {
  const handleConnect = () => {
    // Use NEXT_PUBLIC_APP_URL if set, else fall back to current origin
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const redirectUri = `${baseUrl}/api/social/meta/callback`

    // Encode workspaceId AND the exact redirectUri in state so the callback
    // can pass the same value back for the token exchange
    const state = JSON.stringify({ workspaceId, redirectUri })

    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_APP_FACEBOOK_ID || "",
      redirect_uri: redirectUri,
      scope: [
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_posts",
        "instagram_basic",
        "instagram_content_publish",
        "ads_management",
      ].join(","),
      response_type: "code",
      state: btoa(state),
    })

    window.location.href = `https://www.facebook.com/v22.0/dialog/oauth?${params.toString()}`
  }

  return (
    <Button onClick={handleConnect} className="gap-2" size="sm">
      <Facebook className="w-4 h-4" />
      Conectar via Facebook
    </Button>
  )
}
