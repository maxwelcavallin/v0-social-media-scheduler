import { NextRequest, NextResponse } from "next/server"
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth"

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

  // Seta o cookie via Set-Cookie header E via JS para garantir em todos os contextos
  const maxAge = 60 * 60 * 24 * 7
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script>
  document.cookie = "${COOKIE_NAME}=${token}; path=/; max-age=${maxAge}; SameSite=Lax";
  window.location.replace(${JSON.stringify(next)});
</script>
</body>
</html>`

  const response = new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  })
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: false, // false para que o JS também consiga ler se necessário
    secure: false,
    sameSite: "lax",
    maxAge,
    path: "/",
  })
  return response
}
