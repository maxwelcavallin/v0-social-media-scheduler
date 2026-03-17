"use client"

import { Button } from "@/components/ui/button"
import { Instagram } from "lucide-react"

interface Props {
  workspaceId: string
}

// Instagram Login via the Meta "Login with Instagram" OAuth flow (2024+).
// This uses instagram.com/oauth/authorize — NOT the deprecated Basic Display API
// and NOT facebook.com dialog/oauth. It requires a dedicated Instagram App in Meta.
// The App ID must be set as NEXT_PUBLIC_INSTAGRAM_APP_ID (separate from NEXT_PUBLIC_APP_FACEBOOK_ID).
export function ConnectInstagramButton({ workspaceId }: Props) {
  const handleConnect = () => {
    const redirectUri = `${window.location.origin}/api/social/instagram/callback`
    const state = btoa(JSON.stringify({ workspaceId, redirectUri }))

    const instagramAppId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID

    if (!instagramAppId) {
      alert(
        "NEXT_PUBLIC_INSTAGRAM_APP_ID não configurado.\n\n" +
        "Para conectar via Instagram direto você precisa:\n" +
        "1. Criar um App do tipo 'Instagram' no Meta for Developers\n" +
        "2. Adicionar o produto 'Login com Instagram'\n" +
        "3. Definir NEXT_PUBLIC_INSTAGRAM_APP_ID com o App ID gerado\n\n" +
        "Alternativamente, use 'Conectar via Facebook' para contas Business/Creator vinculadas a uma Página."
      )
      return
    }

    const params = new URLSearchParams({
      client_id: instagramAppId,
      redirect_uri: redirectUri,
      scope: [
        "instagram_business_basic",
        "instagram_business_manage_messages",
        "instagram_business_content_publish",
        "instagram_business_manage_comments",
      ].join(","),
      response_type: "code",
      state,
    })

    // Instagram Login endpoint (distinct from Facebook OAuth, 2024+ Meta API)
    window.location.href = `https://www.instagram.com/oauth/authorize?${params.toString()}`
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
