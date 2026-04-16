import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import sql from "@/lib/db"
import { createSessionToken, COOKIE_NAME } from "@/lib/auth"

function errorRedirect(request: NextRequest, message: string) {
  const url = new URL("/login", request.url)
  url.searchParams.set("error", encodeURIComponent(message))
  // 303 See Other: força o browser a fazer GET na URL de destino (não repete o POST)
  return NextResponse.redirect(url, { status: 303 })
}

export async function POST(request: NextRequest) {
  try {
    let email: string | null = null
    let password: string | null = null

    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData()
      email = form.get("email") as string
      password = form.get("password") as string
    } else {
      const body = await request.json()
      email = body.email
      password = body.password
    }

    if (!email || !password) {
      return errorRedirect(request, "Preencha todos os campos.")
    }

    const [user] = await sql`
      SELECT id, name, email, password, plan, is_super_admin FROM users WHERE email = ${email} LIMIT 1
    `
    if (!user) {
      return errorRedirect(request, "E-mail ou senha incorretos.")
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return errorRedirect(request, "E-mail ou senha incorretos.")
    }

    const token = await createSessionToken({ id: user.id, name: user.name, email: user.email, plan: user.plan, isSuperAdmin: user.is_super_admin ?? false })

    const redirectTo = request.nextUrl.searchParams.get("redirectTo") || "/dashboard"
    // Redireciona para o endpoint de set-session que seta o cookie via GET e redireciona para o destino.
    // Desta forma o cookie é setado na resposta do GET /api/auth/session e o browser
    // já o envia no próximo GET /dashboard — sem depender do Set-Cookie do redirect.
    const sessionUrl = new URL("/api/auth/session", request.url)
    sessionUrl.searchParams.set("token", token)
    sessionUrl.searchParams.set("next", redirectTo)
    return NextResponse.redirect(sessionUrl, { status: 303 })
  } catch (err) {
    console.error("[auth/login]", err)
    return errorRedirect(request, "Erro interno. Tente novamente.")
  }
}
