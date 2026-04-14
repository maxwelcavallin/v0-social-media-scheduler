import { neon } from "@neondatabase/serverless"

let _sql: ReturnType<typeof neon> | null = null

function getDb() {
  if (!_sql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error("DATABASE_URL is not set")
    _sql = neon(url)
  }
  return _sql
}

// Tagged template literal wrapper — compatível com o padrão sql`...` do neon
const sql = (strings: TemplateStringsArray, ...values: any[]) => getDb()(strings, ...values)

// Expor métodos extras do neon se necessários (transaction, etc.)
export default sql as ReturnType<typeof neon>
