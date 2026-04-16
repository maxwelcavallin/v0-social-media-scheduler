import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import sql from "@/lib/db"
import { createSessionToken } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Preencha todos os campos." }, { status: 400 })
    }

    const [user] = await sql`
      SELECT id, name, email, password, plan, is_super_admin FROM users WHERE email = ${email} LIMIT 1
    `
    if (!user) {
      return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 })
    }

    const token = await createSessionToken({
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      isSuperAdmin: user.is_super_admin ?? false,
    })

    // Retorna o token no JSON — o cliente seta o cookie via document.cookie
    // Isso funciona em qualquer contexto (iframe, preview, produção)
    return NextResponse.json({
      ok: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, plan: user.plan },
    })
  } catch (err) {
    console.error("[auth/login]", err)
    return NextResponse.json({ error: "Erro interno. Tente novamente." }, { status: 500 })
  }
}
