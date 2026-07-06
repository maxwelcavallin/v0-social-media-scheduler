import { NextRequest, NextResponse } from "next/server"
import { getAppUrl } from "@/lib/app-url"

// A conexão Meta agora acontece no nível da EMPRESA (Visão Geral), não por
// workspace. Não exigimos mais workspaceId — a empresa é derivada da sessão no
// endpoint /process, e o callback retorna para a página de conexão da empresa.
export async function GET(request: NextRequest) {
  const appId = process.env.FACEBOOK_APP_ID
  if (!appId) {
    return NextResponse.json(
      { error: "FACEBOOK_APP_ID não configurado no servidor." },
      { status: 500 }
    )
  }
  const redirectUri = `${getAppUrl(request)}/api/social/meta/callback`

  const state = Buffer.from(JSON.stringify({ redirectUri })).toString("base64")

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: [
      "pages_show_list",
      "pages_read_engagement",
      "pages_read_user_content",
      "pages_manage_metadata",
      "pages_manage_posts",
      "instagram_basic",
      "instagram_content_publish",
      "business_management",
    ].join(","),
    response_type: "code",
    auth_type: "rerequest",
    state,
  })

  return NextResponse.redirect(
    `https://www.facebook.com/v22.0/dialog/oauth?${params.toString()}`
  )
}
