import { NextRequest, NextResponse } from "next/server"

// RFC 7591 — Dynamic Client Registration
// O Claude.ai se auto-registra como client antes de iniciar o fluxo OAuth
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  // Retornamos um client_id dinâmico baseado no client_name ou redirect_uri
  // Como não precisamos persistir (usamos nosso próprio sistema de tokens), retornamos um client estático
  const clientId = "claude-mcp-client"

  return NextResponse.json({
    client_id: clientId,
    client_name: body.client_name ?? "Claude MCP Client",
    redirect_uris: body.redirect_uris ?? [],
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  })
}
