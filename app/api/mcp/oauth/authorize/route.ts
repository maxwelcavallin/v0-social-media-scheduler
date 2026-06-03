import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import crypto from "crypto"

// GET — exibir tela de autorização (redireciona para a UI)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const client_id = searchParams.get("client_id") ?? ""
  const redirect_uri = searchParams.get("redirect_uri") ?? ""
  const state = searchParams.get("state") ?? ""
  const code_challenge = searchParams.get("code_challenge") ?? ""
  const code_challenge_method = searchParams.get("code_challenge_method") ?? ""

  const session = await getSession()

  // Se não há sessão, redireciona para login com retorno para esta URL
  if (!session?.user) {
    const returnTo = encodeURIComponent(req.url)
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://social.list.dog"
    return NextResponse.redirect(`${base}/login?next=${returnTo}`)
  }

  // Busca os workspaces do usuário para exibir seletor
  const orgs = await sql`
    SELECT o.id, o.name
    FROM organization o
    INNER JOIN member m ON m.organization_id = o.id
    WHERE m.user_id = ${session.user.id}
    ORDER BY o.name
  `

  // Monta página HTML de consentimento
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://social.list.dog"
  const orgsOptions = orgs
    .map((o: any) => `<option value="${o.id}">${o.name}</option>`)
    .join("")

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Autorizar acesso MCP — SocialDog</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .card { background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); width: 100%; max-width: 440px; padding: 2rem; }
    .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 1.5rem; }
    .logo img { width: 32px; height: 32px; border-radius: 8px; }
    .logo span { font-weight: 700; font-size: 1.1rem; color: #111; }
    h1 { font-size: 1.2rem; font-weight: 600; color: #111; margin-bottom: 0.4rem; }
    p { font-size: 0.875rem; color: #555; line-height: 1.5; margin-bottom: 1.25rem; }
    label { font-size: 0.8rem; font-weight: 500; color: #333; display: block; margin-bottom: 0.35rem; }
    select { width: 100%; padding: 0.6rem 0.75rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.875rem; background: #fff; color: #111; margin-bottom: 1.25rem; }
    .perms { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; }
    .perms li { font-size: 0.8rem; color: #444; margin-left: 1rem; margin-bottom: 0.25rem; }
    .actions { display: flex; gap: 0.75rem; }
    .btn { flex: 1; padding: 0.65rem 1rem; border-radius: 8px; font-size: 0.875rem; font-weight: 500; cursor: pointer; border: none; }
    .btn-primary { background: #2563eb; color: #fff; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-cancel { background: #f3f4f6; color: #333; }
    .btn-cancel:hover { background: #e5e7eb; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <img src="${base}/logo-dog.png" alt="SocialDog" />
      <span>SocialDog</span>
    </div>
    <h1>Autorizar acesso via MCP</h1>
    <p>Um cliente externo está solicitando acesso para gerenciar posts e contas em seu nome.</p>

    <form method="POST" action="${base}/api/mcp/oauth/authorize">
      <input type="hidden" name="client_id" value="${client_id}" />
      <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
      <input type="hidden" name="state" value="${state}" />
      <input type="hidden" name="code_challenge" value="${code_challenge}" />
      <input type="hidden" name="code_challenge_method" value="${code_challenge_method}" />

      <label for="org">Workspace</label>
      <select id="org" name="organization_id" required>${orgsOptions}</select>

      <div class="perms">
        <p style="margin-bottom:0.5rem;font-weight:600;font-size:0.8rem;color:#111;">Permissões solicitadas:</p>
        <ul>
          <li>Listar contas conectadas com MCP ativo</li>
          <li>Criar, agendar e publicar posts</li>
          <li>Listar posts existentes</li>
        </ul>
      </div>

      <div class="actions">
        <button type="button" class="btn btn-cancel" onclick="window.close()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Autorizar</button>
      </div>
    </form>
  </div>
</body>
</html>`

  return new Response(html, { headers: { "Content-Type": "text/html" } })
}

// POST — usuário confirmou: gera code e redireciona de volta ao Claude
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const body = await req.formData()
  const client_id = body.get("client_id") as string
  const redirect_uri = body.get("redirect_uri") as string
  const state = body.get("state") as string
  const code_challenge = body.get("code_challenge") as string
  const code_challenge_method = body.get("code_challenge_method") as string
  const organization_id = body.get("organization_id") as string

  if (!redirect_uri || !organization_id) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 })
  }

  // Verifica se o usuário pertence ao workspace
  const membership = await sql`
    SELECT 1 FROM member
    WHERE user_id = ${session.user.id} AND organization_id = ${organization_id}
  `
  if (!membership.length) {
    return NextResponse.json({ error: "Sem acesso a este workspace" }, { status: 403 })
  }

  // Gera authorization code único (válido por 5 min)
  const code = crypto.randomBytes(32).toString("hex")

  await sql`
    INSERT INTO mcp_oauth_codes (code, organization_id, user_id, client_id, redirect_uri, code_challenge, expires_at)
    VALUES (${code}, ${organization_id}, ${session.user.id}, ${client_id}, ${redirect_uri}, ${code_challenge}, NOW() + interval '5 minutes')
  `

  const redirectUrl = new URL(redirect_uri)
  redirectUrl.searchParams.set("code", code)
  if (state) redirectUrl.searchParams.set("state", state)

  // Usa HTML com window.location para garantir GET no callback (evita que o browser reenvie como POST em alguns casos)
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<script>window.location.replace(${JSON.stringify(redirectUrl.toString())})</script>
</head><body>Redirecionando...</body></html>`
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  })
}
