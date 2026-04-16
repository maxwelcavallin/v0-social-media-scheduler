import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { randomBytes } from "crypto"

// GET — retorna o webhook_secret e URL para a conta
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { accountId } = await params

  const [account] = await sql`
    SELECT sa.id, sa.webhook_secret, sa.platform, sa.account_username
    FROM social_accounts sa
    JOIN organization o ON o.id = sa.workspace_id
    JOIN member m ON m.organization_id = o.id
    WHERE sa.id = ${accountId} AND m.user_id = ${session.user.id}
    LIMIT 1
  `
  if (!account) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://social.list.dog"

  return NextResponse.json({
    webhook_url: `${baseUrl}/api/webhook/${accountId}`,
    webhook_secret: account.webhook_secret,
    has_secret: !!account.webhook_secret,
  })
}

// POST — gera ou regenera o webhook_secret
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { accountId } = await params

  // Verificar pertencimento
  const [account] = await sql`
    SELECT sa.id FROM social_accounts sa
    JOIN organization o ON o.id = sa.workspace_id
    JOIN member m ON m.organization_id = o.id
    WHERE sa.id = ${accountId} AND m.user_id = ${session.user.id}
    LIMIT 1
  `
  if (!account) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 })

  const newSecret = randomBytes(32).toString("hex")

  await sql`
    UPDATE social_accounts SET webhook_secret = ${newSecret}, updated_at = NOW()
    WHERE id = ${accountId}
  `

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://social.list.dog"

  return NextResponse.json({
    webhook_url: `${baseUrl}/api/webhook/${accountId}`,
    webhook_secret: newSecret,
  })
}
