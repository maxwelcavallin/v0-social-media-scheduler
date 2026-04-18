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

    // Verificar convites pendentes para esse email e vincular automaticamente
    const pendingInvites = await sql`
      SELECT * FROM company_invitation
      WHERE email = ${email.toLowerCase()} AND accepted_at IS NULL
    `
    for (const invite of pendingInvites) {
      // Vincular à empresa
      await sql`
        INSERT INTO company_member (company_id, user_id, role)
        VALUES (${invite.company_id}, ${user.id}, ${invite.role})
        ON CONFLICT (company_id, user_id) DO NOTHING
      `
      // Vincular aos workspaces
      if (invite.workspace_ids && invite.workspace_ids.length > 0) {
        for (const workspaceId of invite.workspace_ids) {
          await sql`
            INSERT INTO "member" (organization_id, user_id, role)
            VALUES (${workspaceId}, ${user.id}, 'member')
            ON CONFLICT (organization_id, user_id) DO NOTHING
          `
        }
      }
      // Marcar como aceito
      await sql`
        UPDATE company_invitation SET accepted_at = NOW() WHERE id = ${invite.id}
      `
    }

    const token = await createSessionToken({ id: user.id, name: user.name, email: user.email, plan: user.plan })

    const response = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, plan: user.plan } })
    const host = request.headers.get("host") || ""
    const isLocalHttp = host.includes("localhost") || host.includes("127.0.0.1")
    const isPreview = host.includes("vusercontent.net") || host.includes("v0.dev")
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: !isLocalHttp,
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
