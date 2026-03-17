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

  const appId = process.env.INSTAGRAM_APP_ID
  if (!appId) {
    return NextResponse.json({ error: "Configuração interna ausente." }, { status: 500 })
  }

  const host = request.headers.get("host") ?? ""
  const protocol = host.startsWith("localhost") ? "http" : "https"
  const redirectUri = `${protocol}://${host}/api/social/instagram/callback`

  const state = Buffer.from(JSON.stringify({ workspaceId, redirectUri })).toString("base64")

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: "instagram_business_basic,instagram_business_content_publish",
    response_type: "code",
    state,
  })

  return NextResponse.redirect(
    `https://api.instagram.com/oauth/authorize?${params.toString()}`
  )
}
