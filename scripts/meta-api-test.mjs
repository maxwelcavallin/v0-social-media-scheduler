/**
 * Meta API Test Calls — required for app review submission
 *
 * Usage:
 *   node scripts/meta-api-test.mjs <PAGE_ACCESS_TOKEN> <PAGE_ID> <IG_USER_ID>
 *
 * Where to get these values:
 *   - PAGE_ACCESS_TOKEN: token salvo na tabela social_accounts (platform = 'facebook')
 *   - PAGE_ID: coluna page_id da tabela social_accounts
 *   - IG_USER_ID: coluna account_id da tabela social_accounts (platform = 'instagram')
 *
 * Run once — the Meta review system tracks these calls automatically.
 */

const [, , PAGE_TOKEN, PAGE_ID, IG_USER_ID] = process.argv

if (!PAGE_TOKEN || !PAGE_ID || !IG_USER_ID) {
  console.error("Uso: node scripts/meta-api-test.mjs <PAGE_ACCESS_TOKEN> <PAGE_ID> <IG_USER_ID>")
  process.exit(1)
}

const GRAPH = "https://graph.facebook.com/v22.0"

async function call(label, url) {
  console.log(`\n[TEST] ${label}`)
  console.log(`  URL: ${url.replace(PAGE_TOKEN, "***TOKEN***")}`)
  try {
    const res = await fetch(url)
    const data = await res.json()
    if (data.error) {
      console.log(`  ERRO ${data.error.code}: ${data.error.message}`)
    } else {
      console.log(`  OK — ${JSON.stringify(data).slice(0, 120)}`)
    }
  } catch (e) {
    console.log(`  FALHA: ${e.message}`)
  }
}

async function run() {
  console.log("=== Meta API Test Calls ===")
  console.log(`Page ID: ${PAGE_ID}`)
  console.log(`IG User ID: ${IG_USER_ID}`)

  // ── pages_show_list ─────────────────────────────────────────────────────────
  await call(
    "pages_show_list — /me/accounts",
    `${GRAPH}/me/accounts?access_token=${PAGE_TOKEN}`
  )

  // ── pages_read_engagement ────────────────────────────────────────────────────
  await call(
    "pages_read_engagement — /{page-id}?fields=fan_count,followers_count",
    `${GRAPH}/${PAGE_ID}?fields=id,name,fan_count,followers_count&access_token=${PAGE_TOKEN}`
  )

  // ── pages_manage_metadata ────────────────────────────────────────────────────
  await call(
    "pages_manage_metadata — /{page-id}?fields=about,description,website",
    `${GRAPH}/${PAGE_ID}?fields=id,name,about,description,website&access_token=${PAGE_TOKEN}`
  )

  // ── pages_manage_posts ───────────────────────────────────────────────────────
  await call(
    "pages_manage_posts — /{page-id}/feed",
    `${GRAPH}/${PAGE_ID}/feed?access_token=${PAGE_TOKEN}&limit=5`
  )

  // ── instagram_basic ──────────────────────────────────────────────────────────
  await call(
    "instagram_basic — /{ig-user-id}?fields=id,name,username,biography,followers_count",
    `${GRAPH}/${IG_USER_ID}?fields=id,name,username,biography,followers_count&access_token=${PAGE_TOKEN}`
  )

  await call(
    "instagram_basic — /{ig-user-id}/media",
    `${GRAPH}/${IG_USER_ID}/media?fields=id,caption,media_type,timestamp&limit=5&access_token=${PAGE_TOKEN}`
  )

  // ── instagram_content_publish ────────────────────────────────────────────────
  // Step 1: Create image container (test image — does not actually publish)
  console.log("\n[TEST] instagram_content_publish — criar container de imagem (rascunho)")
  const TEST_IMAGE_URL = "https://placehold.co/1080x1080/png"
  const containerUrl = `${GRAPH}/${IG_USER_ID}/media?image_url=${encodeURIComponent(TEST_IMAGE_URL)}&caption=Teste+de+API&access_token=${PAGE_TOKEN}`
  console.log(`  URL: ${containerUrl.replace(PAGE_TOKEN, "***TOKEN***")}`)
  try {
    const res = await fetch(containerUrl, { method: "POST" })
    const data = await res.json()
    if (data.error) {
      console.log(`  ERRO ${data.error.code}: ${data.error.message}`)
    } else {
      const containerId = data.id
      console.log(`  Container criado: ${containerId}`)

      // Step 2: Check container status (proves publish flow — does NOT publish yet)
      await call(
        "instagram_content_publish — status do container",
        `${GRAPH}/${containerId}?fields=id,status,status_code&access_token=${PAGE_TOKEN}`
      )

      // NOTE: We do NOT call /media_publish to avoid actually posting
      console.log("  [OK] Fluxo de publicação testado. Container NÃO foi publicado.")
    }
  } catch (e) {
    console.log(`  FALHA: ${e.message}`)
  }

  console.log("\n=== Testes concluídos ===")
  console.log("Verifique no painel Meta se 'Verifique se você fez as ligações de teste' ficou marcado.")
}

run()
