import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth"

// GET /api/auth/session?token=...&next=/dashboard
// Retorna uma página HTML que seta o cookie via document.cookie (client-side)
// e navega para o destino. Isso garante que o cookie seja setado no browser
// antes da navegação para /dashboard, funcionando em qualquer contexto (iframe, preview, produção).
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  const next = request.nextUrl.searchParams.get("next") || "/dashboard"

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 302 })
  }

  const session = await verifySessionToken(token).catch(() => null)
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 302 })
  }

  // Redireciona para o destino com o token na URL (?__session=...).
  // O proxy.ts intercepta este parâmetro, seta o cookie server-side e redireciona
  // para a mesma URL sem o token — funcionando em qualquer contexto incluindo iframe/preview.
  const destination = new URL(next, request.url)
  destination.searchParams.set("__session", token)
  return NextResponse.redirect(destination, { status: 302 })
}
