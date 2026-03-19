import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import sql from "@/lib/db"
import { createSessionToken, COOKIE_NAME } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Preencha todos os campos." }, { status: 400 })
    }

    const [user] = await sql`
      SELECT id, name, email, password, plan FROM users WHERE email = ${email} LIMIT 1
    `
    if (!user) {
      return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 })
    }

    const token = await createSessionToken({ id: user.id, name: user.name, email: user.email, plan: user.plan })

    const response = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, plan: user.plan } })
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    })
    return response
  } catch (err) {
    console.error("[auth/login]", err)
    return NextResponse.json({ error: "Erro interno. Tente novamente." }, { status: 500 })
  }
}
