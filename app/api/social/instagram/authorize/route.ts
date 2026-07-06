import { NextRequest, NextResponse } from "next/server"

// Conectar Instagram diretamente via Instagram OAuth nativo (api.instagram.com)
// Funciona para qualquer conta: pessoal, criador de conteúdo ou empresarial
// NÃO requer vinculação com página do Facebook ou Business Suite.
// A conexão é no nível da EMPRESA (Visão Geral) — a empresa é derivada da sessão
// no endpoint /process, então não exigimos mais workspaceId aqui.
export async function GET(request: NextRequest) {
  // redirect_uri fixo — deve ser idêntico ao cadastrado no painel Meta do app INSTAGRAM_APP_ID
  const REDIRECT_URI = "https://social.list.dog/api/social/instagram/callback"
  const CLIENT_ID = process.env.INSTAGRAM_APP_ID!

  if (!CLIENT_ID) {
    return NextResponse.json({ error: "INSTAGRAM_APP_ID não configurado" }, { status: 500 })
  }

  const state = Buffer.from(JSON.stringify({ redirectUri: REDIRECT_URI })).toString("base64")

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: [
      "instagram_business_basic",
      "instagram_business_manage_messages",
      "instagram_business_manage_comments",
      "instagram_business_content_publish",
    ].join(","),
    state,
  })

  // www.instagram.com/oauth/authorize → autorização (Instagram Login atual)
  // api.instagram.com/oauth/access_token → troca de token (no callback)
  return NextResponse.redirect(
    `https://www.instagram.com/oauth/authorize?${params.toString()}`
  )
}
