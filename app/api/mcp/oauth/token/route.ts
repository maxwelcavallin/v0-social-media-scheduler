import { NextRequest, NextResponse } from "next/server"
import sql from "@/lib/db"
import crypto from "crypto"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

// RFC 6749 Token Endpoint — troca authorization_code por access_token
export async function POST(req: NextRequest) {
  let body: Record<string, string>

  const contentType = req.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    body = await req.json()
  } else {
    const form = await req.formData()
    body = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]))
  }

  const { grant_type, code, redirect_uri, client_id, code_verifier } = body

  if (grant_type !== "authorization_code") {
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 })
  }

  if (!code) {
    return NextResponse.json({ error: "invalid_request", error_description: "code ausente" }, { status: 400 })
  }

  // Busca e valida o authorization code
  const rows = await sql`
    SELECT * FROM mcp_oauth_codes
    WHERE code = ${code}
      AND used = false
      AND expires_at > NOW()
  `

  if (!rows.length) {
    return NextResponse.json({ error: "invalid_grant", error_description: "Código inválido ou expirado" }, { status: 400 })
  }

  const authCode = rows[0]

  // Valida PKCE (code_verifier vs code_challenge)
  if (authCode.code_challenge && code_verifier) {
    const hash = crypto
      .createHash("sha256")
      .update(code_verifier)
      .digest("base64url")
    if (hash !== authCode.code_challenge) {
      return NextResponse.json({ error: "invalid_grant", error_description: "PKCE inválido" }, { status: 400 })
    }
  }

  // Marca code como usado (uso único)
  await sql`UPDATE mcp_oauth_codes SET used = true WHERE id = ${authCode.id}`

  // Reutiliza token existente do workspace ou cria um novo
  const existing = await sql`
    SELECT token FROM mcp_tokens WHERE organization_id = ${authCode.organization_id}
  `

  let accessToken: string
  if (existing.length) {
    accessToken = existing[0].token
  } else {
    accessToken = crypto.randomBytes(40).toString("hex")
    await sql`
      INSERT INTO mcp_tokens (organization_id, token, created_by, created_at)
      VALUES (${authCode.organization_id}, ${accessToken}, ${authCode.user_id}, NOW())
    `
  }

  // Atualiza last_used_at
  await sql`UPDATE mcp_tokens SET last_used_at = NOW() WHERE token = ${accessToken}`

  return NextResponse.json(
    { access_token: accessToken, token_type: "Bearer", scope: "mcp" },
    { headers: CORS }
  )
}
