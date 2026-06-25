export const GRAPH_API = "https://graph.facebook.com/v22.0"
export const GRAPH_IG = "https://graph.instagram.com"

// Re-emite um Page Access Token fresco a partir de um User Access Token de longa
// duração. Um único user token válido do dono da página consegue gerar tokens
// novos para TODAS as páginas que ele administra — é a base da auto-cura: quando o
// page token salvo morre (erro 190), geramos um novo na hora sem exigir reconexão.
// Retorna o token fresco, ou null se o próprio user token estiver inválido.
export async function refreshFacebookPageToken(
  pageId: string,
  userToken: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `${GRAPH_API}/${pageId}?fields=access_token&access_token=${encodeURIComponent(userToken)}`
    )
    const data = await res.json()
    if (data.error || !data.access_token) return null

    // Confirma que o token fresco realmente funciona como page token
    const check = await fetch(
      `${GRAPH_API}/me?fields=id&access_token=${encodeURIComponent(data.access_token)}`
    )
    const checkData = await check.json()
    if (checkData.error || checkData.id !== pageId) return null

    return data.access_token as string
  } catch {
    return null
  }
}

// Aguarda o Meta processar o vídeo após o upload (Fase 2 → Fase 3).
// Verifica o status via /{video_id}?fields=status até o vídeo estar pronto
// ou o timeout ser atingido. Equivalente ao pollContainer do Instagram.
async function pollFacebookVideo(
  videoId: string,
  accessToken: string,
  maxWaitMs = 180_000
): Promise<void> {
  const deadline = Date.now() + maxWaitMs

  // Aguarda 3s fixo antes da primeira verificação
  await new Promise((r) => setTimeout(r, 3000))

  let interval = 3000
  let lastStatusSnapshot = ""
  while (Date.now() < deadline) {
    const res = await fetch(
      `${GRAPH_API}/${videoId}?fields=status&access_token=${encodeURIComponent(accessToken)}`
    )
    const data = await res.json()
    const status = data?.status ?? {}

    const videoStatus: string | undefined = status.video_status
    const progress: number | undefined = status.processing_progress
    const uploadingPhase = status.uploading_phase?.status
    const processingPhase = status.processing_phase?.status
    const publishingPhase = status.publishing_phase?.status

    // Log diagnóstico (visível nos logs da Vercel) para entender onde o vídeo trava
    const snapshot = `${videoStatus}|up:${uploadingPhase}|proc:${processingPhase}|pub:${publishingPhase}|${progress}`
    if (snapshot !== lastStatusSnapshot) {
      console.log(`[v0][publish] FB video ${videoId} status: ${snapshot}`)
      lastStatusSnapshot = snapshot
    }

    // Pronto: vídeo processado (qualquer um dos sinais de conclusão)
    if (videoStatus === "ready" || progress === 100 || processingPhase === "complete") return

    // Falha rápida: o Meta já reportou erro em qualquer fase — não espera o timeout
    if (videoStatus === "error" || uploadingPhase === "error" || processingPhase === "error") {
      const phaseErr =
        status.uploading_phase?.error?.message ||
        status.processing_phase?.error?.message ||
        status.error?.message ||
        "erro desconhecido"
      throw new Error(`Facebook rejeitou o vídeo: ${phaseErr}`)
    }

    await new Promise((r) => setTimeout(r, interval))
    interval = Math.min(interval + 2000, 8000)
  }
  throw new Error("Tempo esgotado aguardando processamento do vídeo no Facebook")
}

export async function publishToFacebook(item: {
  access_token: string
  page_id: string
  content: string
  media_urls: string[] | null
  media_types: string[] | null
  post_type?: string
}): Promise<string> {
  const { access_token, page_id, content, media_urls, media_types, post_type } = item
  const isStory = post_type === "story"
  const isReel = post_type === "reel"

  // ── Story no Facebook ────────────────────────────────────────────────────────
  // Stories exigem endpoint dedicado e não aceitam carousel nem texto.
  if (isStory) {
    if (!media_urls || media_urls.length === 0) throw new Error("Stories no Facebook exigem mídia.")
    const isVideo = media_types?.[0] === "video"

    if (!isVideo) {
      // Foto: a Graph API exige 2 etapas.
      // Etapa 1 — faz upload da foto como NÃO publicada para obter o photo_id.
      // Passar a url direto em /photo_stories causa "An unknown error has occurred."
      const uploadParams = new URLSearchParams({
        url: media_urls[0],
        published: "false",
        access_token,
      })
      const uploadRes = await fetch(`${GRAPH_API}/${page_id}/photos?${uploadParams.toString()}`, {
        method: "POST",
      })
      const uploadData = await uploadRes.json()
      if (uploadData.error) throw new Error(`FB photo story upload: ${uploadData.error.message}`)
      const photoId: string = uploadData.id
      if (!photoId) throw new Error("FB photo story: photo_id não retornado no upload")

      // Etapa 2 — publica o story usando o photo_id obtido
      const storyParams = new URLSearchParams({
        photo_id: photoId,
        access_token,
      })
      const res = await fetch(`${GRAPH_API}/${page_id}/photo_stories?${storyParams.toString()}`, {
        method: "POST",
      })
      const data = await res.json()
      if (data.error) throw new Error(`FB photo story publish: ${data.error.message}`)
      return data.id || data.post_id || photoId
    }

    // Vídeo: a Graph API exige upload em 3 fases.
    // IMPORTANTE: os parâmetros upload_phase e video_id DEVEM ir como query
    // params na URL — enviá-los no JSON body causa "(#100) Missing parameter: video_id".

    // Fase 1 — inicia o upload e obtém video_id + upload_url
    const startRes = await fetch(
      `${GRAPH_API}/${page_id}/video_stories?upload_phase=start&access_token=${encodeURIComponent(access_token)}`,
      { method: "POST" },
    )
    const startData = await startRes.json()
    if (startData.error) throw new Error(`FB story fase start: ${startData.error.message}`)
    const videoId: string = startData.video_id
    const uploadUrl: string = startData.upload_url
    if (!videoId) throw new Error("FB story: video_id não retornado na fase start")
    if (!uploadUrl) throw new Error("FB story: upload_url não retornado na fase start")

    // Fase 2 — envia o vídeo para o upload_url usando o header file_url.
    // O Facebook baixa o vídeo diretamente da URL fornecida.
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": `OAuth ${access_token}`,
        "file_url": media_urls[0],
      },
    })
    // Proteção: alguns endpoints do Meta retornam body vazio em certas condições
    const uploadText = await uploadRes.text()
    if (uploadText) {
      const uploadData = JSON.parse(uploadText)
      if (uploadData.error) throw new Error(`FB story fase upload: ${uploadData.error.message}`)
    }

    // Aguarda o Meta processar o vídeo antes de finalizar
    await pollFacebookVideo(videoId, access_token, 180_000)

    // Fase 3 — finaliza e publica o story (video_id como query param)
    const finishRes = await fetch(
      `${GRAPH_API}/${page_id}/video_stories?upload_phase=finish&video_id=${encodeURIComponent(videoId)}&access_token=${encodeURIComponent(access_token)}`,
      { method: "POST" },
    )
    const finishData = await finishRes.json()
    if (finishData.error) throw new Error(`FB story fase finish: ${finishData.error.message}`)
    return finishData.id || finishData.post_id || videoId
  }

  // ── Reel no Facebook ─────────────────────────────────────────────────────────
  // Assim como o story de vídeo, o reel exige upload em 3 fases.
  if (isReel) {
    if (!media_urls || media_urls.length === 0) throw new Error("Reels no Facebook exigem um vídeo.")
    // Guard: reel exige vídeo — imagem causa erro obscuro na Fase 2
    if (media_types?.[0] !== "video") {
      throw new Error("Reels no Facebook exigem um arquivo de vídeo. Imagens não são suportadas neste formato.")
    }

    // Fase 1 — inicia o upload e obtém video_id + upload_url
    const startRes = await fetch(
      `${GRAPH_API}/${page_id}/video_reels?upload_phase=start&access_token=${encodeURIComponent(access_token)}`,
      { method: "POST" },
    )
    const startData = await startRes.json()
    if (startData.error) throw new Error(`FB reel fase start: ${startData.error.message}`)
    const videoId: string = startData.video_id
    const uploadUrl: string = startData.upload_url
    if (!videoId) throw new Error("FB reel: video_id não retornado na fase start")
    if (!uploadUrl) throw new Error("FB reel: upload_url não retornado na fase start")

    // Fase 2 — envia o vídeo para o upload_url usando o header file_url
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": `OAuth ${access_token}`,
        "file_url": media_urls[0],
      },
    })
    // Proteção: alguns endpoints do Meta retornam body vazio em certas condições
    const uploadText = await uploadRes.text()
    if (uploadText) {
      const uploadData = JSON.parse(uploadText)
      if (uploadData.error) throw new Error(`FB reel fase upload: ${uploadData.error.message}`)
    }

    // Aguarda o Meta processar o vídeo antes de finalizar
    await pollFacebookVideo(videoId, access_token, 180_000)

    // Fase 3 — finaliza e publica o reel.
    // IMPORTANTE: upload_phase, video_id e video_state DEVEM ir como query params.
    // description vai no body como JSON — URLSearchParams corrompe acentos e emojis.
    const reelQueryParams = new URLSearchParams({
      upload_phase: "finish",
      video_id: videoId,
      video_state: "PUBLISHED",
      access_token,
    })
    const finishRes = await fetch(
      `${GRAPH_API}/${page_id}/video_reels?${reelQueryParams.toString()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: content || "" }),
      }
    )
    const finishData = await finishRes.json()
    if (finishData.error) throw new Error(`FB reel fase finish: ${finishData.error.message}`)
    return finishData.id || finishData.post_id || videoId
  }

  // ── Feed (foto/vídeo/carrossel) ──────────────────────────────────────────────
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

  // Helper: aguarda container atingir FINISHED ou ERROR com backoff exponencial
  // Usa graph.instagram.com para tokens diretos, graph.facebook.com para page tokens
  const pollContainer = async (containerId: string, maxWaitMs: number): Promise<void> => {
    const statusBase = isDirectIg ? GRAPH_IG : GRAPH_API
    const pollUrl = `${statusBase}/${containerId}?fields=status_code,status&access_token=${access_token}`
    const deadline = Date.now() + maxWaitMs

    // Aguarda 4s fixo antes da primeira verificação (mínimo recomendado pelo Instagram)
    await new Promise((r) => setTimeout(r, 4000))

    let interval = 3000 // começa com 3s, aumenta progressivamente
    let lastCode = ""
    while (Date.now() < deadline) {
      const statusRes = await fetch(pollUrl)
      const statusData = await statusRes.json()
      const code: string = statusData.status_code ?? ""
      // Log diagnóstico (visível nos logs da Vercel) para entender onde a mídia trava
      if (code !== lastCode) {
        console.log(`[v0][publish] IG container ${containerId} status_code: ${code || "(vazio)"} ${statusData.status || ""}`)
        lastCode = code
      }
      if (code === "FINISHED") return
      if (code === "ERROR") {
        throw new Error(`Instagram rejeitou a mídia: ${statusData.status || "erro desconhecido"}`)
      }
      // IN_PROGRESS ou vazio — aguarda com backoff (máx 8s entre tentativas)
      await new Promise((r) => setTimeout(r, interval))
      interval = Math.min(interval + 2000, 8000)
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
    // A API do Instagram não aceita "VIDEO" para feed desde 2024 — todo vídeo de feed é tratado como Reel
    else if (isVideo) mediaType = "REELS"
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

    // Imagens: até 60s | Vídeos/Reels: até 180s
    await pollContainer(containerData.id, isVideo ? 180_000 : 60_000)

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

  await pollContainer(carouselData.id, 90_000)

  const publishRes = await fetch(publishEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: carouselData.id }),
  })
  const publishData = await publishRes.json()
  if (publishData.error) throw new Error(publishData.error.message)
  return publishData.id
}
