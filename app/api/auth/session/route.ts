import { NextRequest, NextResponse } from "next/server"
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth"

// GET /api/auth/session?token=...&next=/dashboard
// Seta o cookie de sessão e redireciona para o destino.
// Esta abordagem garante que o browser receba o Set-Cookie na resposta do GET
// e o envie automaticamente no próximo request — funcionando em qualquer contexto (preview, iframe, produção).
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  const next = request.nextUrl.searchParams.get("next") || "/dashboard"

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Valida o token antes de setar
  const session = await verifySessionToken(token).catch(() => null)
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const response = NextResponse.redirect(new URL(next, request.url))
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  })
  return response
}
