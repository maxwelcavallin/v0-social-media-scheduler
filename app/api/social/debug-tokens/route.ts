import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { cookies } from "next/headers"
import { verifySessionToken } from "@/lib/auth"

// Temporary debug endpoint — REMOVE AFTER APP REVIEW
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const sql = neon(process.env.DATABASE_URL!)
  const accounts = await sql`
    SELECT platform, account_id, page_id, account_name, account_username,
           left(access_token, 60) as token_prefix,
           length(access_token) as token_length
    FROM social_accounts
    WHERE is_active = true
    ORDER BY platform, updated_at DESC
    LIMIT 10
  `

  return NextResponse.json({
    note: "Use esses valores para rodar: node scripts/meta-api-test.mjs <PAGE_TOKEN> <PAGE_ID> <IG_USER_ID>",
    instructions: {
      PAGE_ACCESS_TOKEN: "token da conta com platform=facebook (token completo no banco)",
      PAGE_ID: "page_id da conta com platform=facebook",
      IG_USER_ID: "account_id da conta com platform=instagram",
    },
    accounts,
  })
}
