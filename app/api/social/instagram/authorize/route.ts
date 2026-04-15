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
  const CLIENT_ID = process.env.INSTAGRAM_APP_ID!

  if (!CLIENT_ID) {
    return NextResponse.json({ error: "INSTAGRAM_APP_ID não configurado" }, { status: 500 })
  }

  const state = Buffer.from(JSON.stringify({ workspaceId, redirectUri: REDIRECT_URI })).toString("base64")

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: [
      "instagram_business_basic",
      "instagram_content_publish",
    ].join(","),
    state,
  })

  // www.instagram.com/oauth/authorize → autorização (Instagram Login atual)
  // api.instagram.com/oauth/access_token → troca de token (no callback)
  // Esses dois endpoints formam o par correto — não misturar com o Basic Display API (depreciado)
  return NextResponse.redirect(
    `https://www.instagram.com/oauth/authorize?${params.toString()}`
  )
}
