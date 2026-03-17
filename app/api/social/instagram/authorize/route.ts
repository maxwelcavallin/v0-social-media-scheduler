import { NextRequest, NextResponse } from "next/server"

// Conectar Instagram diretamente via Instagram OAuth nativo (api.instagram.com)
// Funciona para qualquer conta: pessoal, criador de conteúdo ou empresarial
// NÃO requer vinculação com página do Facebook ou Business Suite
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const workspaceId = searchParams.get("workspaceId")

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 })
  }

  // redirect_uri fixo — deve ser idêntico ao cadastrado no painel Meta do app INSTAGRAM_APP_ID
  const REDIRECT_URI = "https://social.list.dog/api/social/instagram/callback"
  const CLIENT_ID = "2170374997100265"

  const state = Buffer.from(JSON.stringify({ workspaceId, redirectUri: REDIRECT_URI })).toString("base64")

  const params = new URLSearchParams({
    force_reauth: "true",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: [
      "instagram_business_basic",
      "instagram_business_manage_messages",
      "instagram_business_manage_comments",
      "instagram_business_content_publish",
      "instagram_business_manage_insights",
    ].join(","),
    state,
  })

  return NextResponse.redirect(
    `https://www.instagram.com/oauth/authorize?${params.toString()}`
  )
}
