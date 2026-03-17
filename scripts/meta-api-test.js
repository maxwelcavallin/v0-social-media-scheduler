const PAGE_TOKEN = "EAA6CjZBQMCGMBQ3zZBOhSx0sqJPEcYGfJZA9tZBS8ez4dzl1bMDGIQXexOcQ5ckRGcZBu19ZAytO3Rs5ZB0NE5JnQll9od5JZCNn2DjELTelK9KL8N7lHDLP0ZAoq86j7d97WcC3sMTKrSzuNDevpsM4CKaptYxdEWQSSsWdpA5zclvBRx5gF34fFXg42cnEfq3HJHfHUeRap"
const PAGE_ID = "747165455147245"
const IG_USER_ID = "17841444796886622"
const GRAPH = "https://graph.facebook.com/v22.0"

async function call(label, url, method = "GET") {
  console.log(`\n[TEST] ${label}`)
  try {
    const res = await fetch(url, { method })
    const data = await res.json()
    if (data.error) {
      console.log(`  ERRO ${data.error.code}: ${data.error.message}`)
    } else {
      console.log(`  OK — ${JSON.stringify(data).slice(0, 150)}`)
    }
    return data
  } catch (e) {
    console.log(`  FALHA: ${e.message}`)
    return null
  }
}

async function run() {
  console.log("=== Meta API Test Calls ===")

  // pages_show_list
  await call(
    "pages_show_list — /me/accounts",
    `${GRAPH}/me/accounts?access_token=${PAGE_TOKEN}`
  )

  // pages_read_engagement
  await call(
    "pages_read_engagement — fan_count, followers_count",
    `${GRAPH}/${PAGE_ID}?fields=id,name,fan_count,followers_count&access_token=${PAGE_TOKEN}`
  )

  // pages_manage_metadata
  await call(
    "pages_manage_metadata — about, description, website",
    `${GRAPH}/${PAGE_ID}?fields=id,name,about,description,website&access_token=${PAGE_TOKEN}`
  )

  // pages_manage_posts — read feed
  await call(
    "pages_manage_posts — /{page-id}/feed",
    `${GRAPH}/${PAGE_ID}/feed?access_token=${PAGE_TOKEN}&limit=3`
  )

  // instagram_basic — profile
  await call(
    "instagram_basic — perfil IG",
    `${GRAPH}/${IG_USER_ID}?fields=id,name,username,biography,followers_count&access_token=${PAGE_TOKEN}`
  )

  // instagram_basic — media list
  await call(
    "instagram_basic — /media",
    `${GRAPH}/${IG_USER_ID}/media?fields=id,caption,media_type,timestamp&limit=3&access_token=${PAGE_TOKEN}`
  )

  // instagram_content_publish — criar container (sem publicar)
  console.log("\n[TEST] instagram_content_publish — criar container de imagem")
  const TEST_IMAGE = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&h=1080&fit=crop&auto=format"
  const containerRes = await call(
    "instagram_content_publish — POST /{ig-user-id}/media",
    `${GRAPH}/${IG_USER_ID}/media?image_url=${encodeURIComponent(TEST_IMAGE)}&caption=Teste+API&access_token=${PAGE_TOKEN}`,
    "POST"
  )

  if (containerRes?.id) {
    await call(
      "instagram_content_publish — status do container",
      `${GRAPH}/${containerRes.id}?fields=id,status_code&access_token=${PAGE_TOKEN}`
    )
    console.log("  Container criado mas NAO publicado.")
  }

  // instagram_content_publish — publishing_limit
  await call(
    "instagram_content_publish — /content_publishing_limit",
    `${GRAPH}/${IG_USER_ID}/content_publishing_limit?fields=config,quota_usage&access_token=${PAGE_TOKEN}`
  )

  console.log("\n=== Testes concluidos ===")
}

run()
