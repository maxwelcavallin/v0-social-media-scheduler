import { SignJWT, jwtVerify } from "jose"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "socialdog-secret-key-change-in-production"
)

const COOKIE_NAME = "socialdog_session"

export type SessionUser = {
  id: string
  name: string
  email: string
  plan: string
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET)
}

export async function verifySessionToken(token: string): Promise<{ user: SessionUser } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as { user: SessionUser }
  } catch {
    return null
  }
}

export { COOKIE_NAME }
