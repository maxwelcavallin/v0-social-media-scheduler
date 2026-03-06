import { betterAuth } from "better-auth"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const origins: string[] = ["http://localhost:3000", "https://localhost:3000"]
if (process.env.NEXT_PUBLIC_APP_URL) origins.push(process.env.NEXT_PUBLIC_APP_URL)
if (process.env.BETTER_AUTH_URL) origins.push(process.env.BETTER_AUTH_URL)

export const auth = betterAuth({
  database: pool,
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  trustedOrigins: origins,
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
