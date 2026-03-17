import { NextRequest, NextResponse } from "next/server"

// Instagram Business Login — Instagram API with Instagram Login
// https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
// Funciona para qualquer conta profissional Instagram (business ou creator)
// NÃO requer vinculação com página do Facebook ou Business Suite
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const workspaceId = searchParams.get("workspaceId")

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 })
  }

  const appId = process.env.INSTAGRAM_APP_ID
  if (!appId) {
    return NextResponse.json({ error: "Configuração interna ausente." }, { status: 500 })
  }

  // redirect_uri deve ser exatamente o cadastrado no painel Meta para o INSTAGRAM_APP_ID
  const redirectUri = "https://social.list.dog/api/social/instagram/callback"

  const state = Buffer.from(JSON.stringify({ workspaceId, redirectUri })).toString("base64")

  const params = new URLSearchParams({
    force_reauth: "true",
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "instagram_business_basic",
      "instagram_business_content_publish",
      "instagram_business_manage_comments",
      "instagram_business_manage_messages",
    ].join(","),
    state,
  })

  return NextResponse.redirect(
    `https://www.instagram.com/oauth/authorize?${params.toString()}`
  )
}
