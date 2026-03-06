import { betterAuth } from "better-auth"
import { neon } from "@neondatabase/serverless"
import { Pool } from "@neondatabase/serverless"
import { organization } from "better-auth/plugins"

export const auth = betterAuth({
  database: {
    provider: "pg",
    url: process.env.DATABASE_URL!,
  },
  schema: {
    prefix: "neon_auth",
  },
  plugins: [
    organization({
      schema: {
        organization: {
          tableName: "organization",
          fields: {
            name: "name",
            slug: "slug",
            logo: "logo",
            createdAt: "createdAt",
            metadata: "metadata",
          },
        },
        member: {
          tableName: "member",
          fields: {
            organizationId: "organizationId",
            userId: "userId",
            role: "role",
            createdAt: "createdAt",
          },
        },
      },
    }),
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // update session every 24 hours
  },
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"],
})

export type Session = typeof auth.$Infer.Session
