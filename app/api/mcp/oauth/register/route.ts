import { NextRequest, NextResponse } from "next/server"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

// RFC 7591 — Dynamic Client Registration
// O Claude.ai se auto-registra como client antes de iniciar o fluxo OAuth
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  // Gera um client_id único por redirect_uri para não conflitar entre clientes diferentes
  const clientId = `claude-${Buffer.from(body.redirect_uris?.[0] ?? "mcp").toString("base64url").slice(0, 12)}`

  return NextResponse.json(
    {
      client_id: clientId,
      client_name: body.client_name ?? "Claude MCP Client",
      redirect_uris: body.redirect_uris ?? [],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201, headers: CORS }
  )
}
