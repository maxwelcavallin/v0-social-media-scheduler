import { cookies } from "next/headers"
import { cache } from "react"
import { verifySessionToken, COOKIE_NAME, type SessionUser } from "@/lib/auth"

export const getSession = cache(async (): Promise<{ user: SessionUser } | null> => {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    return await verifySessionToken(token)
  } catch {
    return null
  }
})
