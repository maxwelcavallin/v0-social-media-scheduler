import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import sql from "@/lib/db"
import { getSession } from "@/lib/session"
import { createSessionToken, COOKIE_NAME } from "@/lib/auth"
import { getAppUrl } from "@/lib/app-url"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const [user] = await sql`
    SELECT id, name, email, created_at
    FROM users
    WHERE id = ${session.user.id}
    LIMIT 1
  `
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })

  return NextResponse.json({ user })
}

export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = await request.json()
  const { name, email, current_password, new_password } = body

  if (!name?.trim()) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 })
  if (!email?.trim()) return NextResponse.json({ error: "E-mail é obrigatório." }, { status: 400 })

  // Buscar usuário atual
  const [current] = await sql`SELECT id, name, email, password FROM users WHERE id = ${session.user.id}`
  if (!current) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 })

  // Verificar se email já está em uso por outro usuário
  if (email.toLowerCase() !== current.email) {
    const [emailExists] = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()} AND id != ${session.user.id}`
    if (emailExists) return NextResponse.json({ error: "Este e-mail já está em uso." }, { status: 409 })
  }

  // Se quiser trocar senha, validar senha atual
  let newHash: string | null = null
  if (new_password) {
    if (!current_password) return NextResponse.json({ error: "Informe a senha atual para alterar a senha." }, { status: 400 })
    if (new_password.length < 6) return NextResponse.json({ error: "A nova senha deve ter pelo menos 6 caracteres." }, { status: 400 })
    const valid = await bcrypt.compare(current_password, current.password)
    if (!valid) return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 })
    newHash = await bcrypt.hash(new_password, 10)
  }

  // Atualizar usuário
  const [updated] = newHash
    ? await sql`
        UPDATE users SET name = ${name.trim()}, email = ${email.toLowerCase()}, password = ${newHash}
        WHERE id = ${session.user.id}
        RETURNING id, name, email, plan
      `
    : await sql`
        UPDATE users SET name = ${name.trim()}, email = ${email.toLowerCase()}
        WHERE id = ${session.user.id}
        RETURNING id, name, email, plan
      `

  // Renovar o cookie de sessão com os dados atualizados
  const token = await createSessionToken({ id: updated.id, name: updated.name, email: updated.email, plan: updated.plan })
  const host = request.headers.get("host") || ""
  const isLocalHttp = host.includes("localhost") || host.includes("127.0.0.1")
  const isPreview = host.includes("vusercontent.net") || host.includes("v0.dev")

  const response = NextResponse.json({ ok: true, user: updated })
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: !isLocalHttp,
    sameSite: isPreview ? "none" : "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  })
  return response
}
