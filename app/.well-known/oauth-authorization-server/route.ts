import { NextResponse } from "next/server"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

// RFC 8414 — OAuth 2.0 Authorization Server Metadata
// O Claude.ai descobre este endpoint automaticamente antes de iniciar o fluxo OAuth
export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://social.list.dog"

  return NextResponse.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/api/mcp/oauth/authorize`,
      token_endpoint: `${base}/api/mcp/oauth/token`,
      registration_endpoint: `${base}/api/mcp/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["mcp"],
    },
    { headers: CORS }
  )
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
