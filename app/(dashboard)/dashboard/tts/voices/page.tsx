import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import sql from "@/lib/db"
import { VoicesView } from "@/components/tts/voices-view"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Minhas Vozes | SocialDog",
  description: "Gerencie suas vozes clonadas e favoritas",
}

export default async function TTSVoicesPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const rows = await sql`
    SELECT enabled FROM user_feature_flags WHERE user_id = ${session.user.id} AND flag = 'tts' LIMIT 1
  `
  if (!rows[0]?.enabled) redirect("/dashboard")

  return <VoicesView />
}
