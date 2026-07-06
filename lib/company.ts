import sql from "@/lib/db"

export type CompanyRole = "admin" | "member"

export interface UserCompany {
  id: string
  name: string | null
  role: CompanyRole
}

// Retorna a empresa (company) do usuário logado e o papel dele nela.
// A conexão de contas sociais e o pool global (connected_accounts) são
// escopados por empresa — todos os workspaces da empresa compartilham o pool.
export async function getUserCompany(userId: string): Promise<UserCompany | null> {
  const rows = await sql`
    SELECT c.id, c.name, cm.role
    FROM company c
    JOIN company_member cm ON cm.company_id = c.id
    WHERE cm.user_id = ${userId}
    LIMIT 1
  `
  if (rows.length === 0) return null
  return { id: rows[0].id, name: rows[0].name ?? null, role: rows[0].role as CompanyRole }
}

// Retorna a empresa dona de um workspace (organization), validando que o
// usuário é membro do workspace. Usado pelo seletor de contas do workspace.
export async function getWorkspaceCompany(
  userId: string,
  workspaceId: string
): Promise<{ companyId: string; role: CompanyRole | null } | null> {
  const rows = await sql`
    SELECT o.company_id, cm.role
    FROM "organization" o
    JOIN "member" m ON m.organization_id = o.id AND m.user_id = ${userId}
    LEFT JOIN company_member cm ON cm.company_id = o.company_id AND cm.user_id = ${userId}
    WHERE o.id = ${workspaceId}
    LIMIT 1
  `
  if (rows.length === 0 || !rows[0].company_id) return null
  return { companyId: rows[0].company_id, role: (rows[0].role as CompanyRole) ?? null }
}

// Verifica se o usuário é admin da própria empresa.
export async function isCompanyAdmin(userId: string): Promise<boolean> {
  const company = await getUserCompany(userId)
  return company?.role === "admin"
}
