export const GRAPH_API = "https://graph.facebook.com/v22.0"
export const GRAPH_IG = "https://graph.instagram.com"

export async function publishToFacebook(item: {
  access_token: string
  page_id: string
  content: string
  media_urls: string[] | null
  media_types: string[] | null
}): Promise<string> {
  const { access_token, page_id, content, media_urls, media_types } = item

  if (!media_urls || media_urls.length === 0) {
    const res = await fetch(`${GRAPH_API}/${page_id}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: content, access_token }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    return data.id
  }

  if (media_urls.length === 1) {
    const isVideo = media_types?.[0] === "video"
    const res = await fetch(`${GRAPH_API}/${page_id}/${isVideo ? "videos" : "photos"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [isVideo ? "file_url" : "url"]: media_urls[0],
        caption: content,
        access_token,
      }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    return data.id || data.post_id
  }

  // Carousel
  const photoIds: string[] = []
  for (const url of media_urls) {
    const r = await fetch(`${GRAPH_API}/${page_id}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, published: false, access_token }),
    })
    const d = await r.json()
    if (d.error) throw new Error(d.error.message)
    photoIds.push(d.id)
  }

  const feedRes = await fetch(`${GRAPH_API}/${page_id}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: content,
      attached_media: photoIds.map((id) => ({ media_fbid: id })),
      access_token,
    }),
  })
  const feedData = await feedRes.json()
  if (feedData.error) throw new Error(feedData.error.message)
  return feedData.id
}

export async function publishToInstagram(item: {
  access_token: string
  account_id: string
  page_id: string | null
  content: string
  media_urls: string[] | null
  media_types: string[] | null
  post_type: string
  cover_url?: string | null
}): Promise<string> {
  const { access_token, account_id, page_id, content, media_urls, media_types, post_type, cover_url } = item

  if (!media_urls || media_urls.length === 0) throw new Error("Instagram requer mídia")

  // A API do Instagram não aceita imagem para Reels — exige obrigatoriamente vídeo
  if (post_type === "reel" && media_types?.[0] !== "video") {
    throw new Error("Reels no Instagram exigem um arquivo de vídeo. Imagens não são suportadas neste formato.")
  }

  const isDirectIg = !page_id
  const baseApi = isDirectIg ? GRAPH_IG : GRAPH_API
  const mediaEndpoint = isDirectIg
    ? `${baseApi}/me/media?access_token=${access_token}`
    : `${baseApi}/${account_id}/media?access_token=${access_token}`
  const publishEndpoint = isDirectIg
    ? `${baseApi}/me/media_publish?access_token=${access_token}`
    : `${baseApi}/${account_id}/media_publish?access_token=${access_token}`

  // Helper: aguarda container atingir FINISHED ou ERROR
  // Para tokens diretos do Instagram, usa graph.instagram.com; para page tokens, usa graph.facebook.com
  const pollContainer = async (containerId: string, maxWaitMs: number): Promise<void> => {
    const interval = 3000
    const maxAttempts = Math.ceil(maxWaitMs / interval)
    // Sempre usar graph.instagram.com para status de container IG
    const statusBase = isDirectIg ? GRAPH_IG : GRAPH_API
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, interval))
      const pollUrl = `${statusBase}/${containerId}?fields=status_code,status&access_token=${access_token}`
      const statusRes = await fetch(pollUrl)
      const statusData = await statusRes.json()
      const code: string = statusData.status_code ?? ""
      if (code === "FINISHED") return
      if (code === "ERROR") {
        throw new Error(`Instagram rejeitou a mídia: ${statusData.status || "erro desconhecido"}`)
      }
      // IN_PROGRESS ou vazio — continua aguardando
    }
    throw new Error(`Tempo esgotado aguardando processamento do container no Instagram`)
  }

  if (media_urls.length === 1) {
    const isStory = post_type === "story"
    const isReel = post_type === "reel"
    const isVideo = media_types?.[0] === "video" || isReel

    let mediaType: string
    if (isReel) mediaType = "REELS"
    else if (isStory) mediaType = "STORIES"
    else if (isVideo) mediaType = "VIDEO"
    else mediaType = "IMAGE"

    const containerParams: Record<string, string | boolean> = { media_type: mediaType }
    if (isVideo) containerParams.video_url = media_urls[0]
    else containerParams.image_url = media_urls[0]
    if (!isStory && content) containerParams.caption = content
    if (isReel && cover_url) containerParams.cover_url = cover_url

    const containerRes = await fetch(mediaEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerParams),
    })
    const containerData = await containerRes.json()
    if (containerData.error) {
      throw new Error(`Erro ao criar container: ${containerData.error.message} [${containerData.error.code}]`)
    }

    // Vídeos/Reels precisam de mais tempo para processar
    await pollContainer(containerData.id, isVideo ? 90_000 : 30_000)

    const publishRes = await fetch(publishEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: containerData.id }),
    })
    const publishData = await publishRes.json()
    if (publishData.error) throw new Error(`media_publish error: ${publishData.error.message} [code ${publishData.error.code}]`)
    return publishData.id
  }

  // Carousel — children deve ser array, não string separada por vírgula
  const itemIds: string[] = []
  for (const url of media_urls) {
    const r = await fetch(mediaEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: url, is_carousel_item: true }),
    })
    const d = await r.json()
    if (d.error) throw new Error(d.error.message)
    itemIds.push(d.id)
  }

  const carouselRes = await fetch(mediaEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "CAROUSEL",
      children: itemIds,
      caption: content,
    }),
  })
  const carouselData = await carouselRes.json()
  if (carouselData.error) throw new Error(carouselData.error.message)

  await pollContainer(carouselData.id, 60_000)

  const publishRes = await fetch(publishEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: carouselData.id }),
  })
  const publishData = await publishRes.json()
  if (publishData.error) throw new Error(publishData.error.message)
  return publishData.id
}
