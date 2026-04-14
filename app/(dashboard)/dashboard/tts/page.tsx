import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { TTSView } from "@/components/tts/tts-view"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Text to Voice | SocialDog",
  description: "Gere áudios de alta qualidade a partir de textos usando IA",
}

export default async function TTSPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const rows = await sql`
    SELECT tts_enabled FROM user_feature_flags WHERE user_id = ${session.user.id} LIMIT 1
  `
  if (!rows[0]?.tts_enabled) redirect("/dashboard")

  return <TTSView />
}
