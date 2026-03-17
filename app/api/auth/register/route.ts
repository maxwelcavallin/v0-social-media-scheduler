import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import sql from "@/lib/db"
import { createSessionToken, COOKIE_NAME } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Preencha todos os campos." }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Senha deve ter pelo menos 6 caracteres." }, { status: 400 })
    }

    const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`
    if (existing.length > 0) {
      return NextResponse.json({ error: "Este e-mail já está cadastrado." }, { status: 409 })
    }

    const hash = await bcrypt.hash(password, 10)
    const [user] = await sql`
      INSERT INTO users (name, email, password, plan)
      VALUES (${name}, ${email}, ${hash}, 'gratuito')
      RETURNING id, name, email, plan
    `

    const token = await createSessionToken({ id: user.id, name: user.name, email: user.email, plan: user.plan })

    const response = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, plan: user.plan } })
    const host = request.headers.get("host") || ""
    const proto = request.headers.get("x-forwarded-proto") || "https"
    const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1")
    const isPreview = host.includes("vusercontent.net") || host.includes("v0.dev")
    const isHttps = proto === "https" || !isLocal
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isPreview ? "none" : "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    })
    return response
  } catch (err) {
    console.error("[auth/register]", err)
    return NextResponse.json({ error: "Erro interno. Tente novamente." }, { status: 500 })
  }
}
