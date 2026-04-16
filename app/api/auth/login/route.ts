import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import sql from "@/lib/db"
import { createSessionToken, COOKIE_NAME } from "@/lib/auth"

function errorRedirect(request: NextRequest, message: string) {
  const url = new URL("/login", request.url)
  url.searchParams.set("error", encodeURIComponent(message))
  return NextResponse.redirect(url)
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
    const response = NextResponse.redirect(new URL(redirectTo, request.url))
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    })
    return response
  } catch (err) {
    console.error("[auth/login]", err)
    return errorRedirect(request, "Erro interno. Tente novamente.")
  }
}
