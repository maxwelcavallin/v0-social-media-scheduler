"use client"

import { Button } from "@/components/ui/button"
import { Facebook, Plus } from "lucide-react"

interface Props {
  workspaceId: string
}

export function ConnectMetaButton({ workspaceId }: Props) {
  const handleConnect = () => {
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "",
      redirect_uri: `${window.location.origin}/api/social/meta/callback`,
      scope: [
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_posts",
        "instagram_basic",
        "instagram_content_publish",
        "ads_management",
      ].join(","),
      response_type: "code",
      state: workspaceId,
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
