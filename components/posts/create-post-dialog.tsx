"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AccountSelector } from "@/components/posts/account-selector"
import {
  ImageIcon,
  Upload,
  X,
  Loader2,
  CalendarDays,
  Send,
  Film,
  GripVertical,
  BookmarkIcon,
  CheckCircle2,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react"
import { upload } from "@vercel/blob/client"
import { cn } from "@/lib/utils"

const schema = z.object({
  content: z.string().max(2200, "Legenda deve ter no máximo 2200 caracteres").optional(),
  postType: z.enum(["feed", "reel", "carousel", "story"]),
  scheduleType: z.enum(["now", "scheduled"]),
  scheduledAt: z.string().optional(),
  // Contas podem estar vazias em rascunhos — validação feita no onSubmit
  accountIds: z.array(z.string()),
})

type FormData = z.infer<typeof schema>

interface Account {
  id: string
  platform: string
  account_name: string
  account_username?: string
  profile_picture_url?: string
}

interface UploadedMedia {
  url: string
  type: string
  name: string
}

interface ExistingPost {
  id: string
  content: string
  status: string
  post_type?: string
  scheduled_at?: string
  accountIds?: string[]
  media?: { url: string; media_type: string }[]
  cover_url?: string
}

interface Props {
  workspaceId: string
  accounts: Account[]
  children?: React.ReactNode
  trigger?: React.ReactNode
  // Modo edição
  editPost?: ExistingPost
  editOpen?: boolean
  onEditClose?: () => void
}

const postTypeOptions = [
  { value: "feed", label: "Feed (Foto/Vídeo)" },
  { value: "reel", label: "Reel" },
  { value: "carousel", label: "Carrossel" },
  { value: "story", label: "Story" },
]

const MAX_SIZE_MB = 500
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

const getAccept = (postType: string) => {
  if (postType === "reel") return "video/*"
  return "image/*,video/*"
}

async function uploadFileWithProgress(
  file: File,
  onProgress: (pct: number) => void
): Promise<UploadedMedia> {
  const ext = file.name.split(".").pop() || "bin"
  const pathname = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const blob = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/media/upload",
    onUploadProgress: ({ percentage }) => onProgress(Math.round(percentage)),
  })
  return {
    url: blob.url,
    type: file.type.startsWith("video") ? "video" : "image",
    name: file.name,
  }
}

const toBrasiliaLocal = (date: Date): string => {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  })
  return fmt.format(date).replace(" ", "T")
}

export function CreatePostDialog({ workspaceId, accounts, children, trigger, editPost, editOpen, onEditClose }: Props) {
  const router = useRouter()
  const isEditMode = !!editPost

  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [publishingSuccess, setPublishingSuccess] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)

  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([])
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadingFileName, setUploadingFileName] = useState("")

  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [uploadedCover, setUploadedCover] = useState<UploadedMedia | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [coverProgress, setCoverProgress] = useState(0)

  const [charCount, setCharCount] = useState(0)
  const [scheduledDates, setScheduledDates] = useState<string[]>([""])

  const dragIndex = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const minDate = new Date()
  minDate.setMinutes(minDate.getMinutes() + 5)
  const minDateStr = toBrasiliaLocal(minDate)

  // Determinar valores iniciais baseados no modo (edição vs. criação)
  const defaultPostType = (editPost?.post_type as any) || "feed"
  const defaultScheduleType = editPost?.status === "scheduled" ? "scheduled" : "now"
  const defaultAccountIds = editPost?.accountIds || []
  const defaultContent = editPost?.content || ""
  const defaultScheduledAt = editPost?.scheduled_at
    ? toBrasiliaLocal(new Date(editPost.scheduled_at))
    : ""

  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      postType: defaultPostType,
      scheduleType: defaultScheduleType,
      accountIds: defaultAccountIds,
      content: defaultContent,
    },
  })

  const scheduleType = watch("scheduleType")
  const accountIds = watch("accountIds") || []
  const postType = watch("postType")

  // Pré-popular mídia existente no modo edição
  useEffect(() => {
    if (editPost && (editOpen || open)) {
      if (editPost.media && editPost.media.length > 0) {
        setUploadedMedia(editPost.media.map(m => ({
          url: m.url,
          type: m.media_type === "video" ? "video" : "image",
          name: m.url.split("/").pop() || "media",
        })))
        setMediaPreviews(editPost.media.map(m => m.url))
      } else {
        setUploadedMedia([])
        setMediaPreviews([])
      }
      if (editPost.cover_url) {
        setCoverPreview(editPost.cover_url)
        setUploadedCover({ url: editPost.cover_url, type: "image", name: "cover" })
      } else {
        setCoverPreview(null)
        setUploadedCover(null)
      }
      if (defaultScheduledAt) {
        setScheduledDates([defaultScheduledAt])
      }
      setCharCount(defaultContent.length)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOpen, open, editPost?.id])

  const addScheduledDate = () => setScheduledDates((prev) => [...prev, ""])
  const removeScheduledDate = (idx: number) => setScheduledDates((prev) => prev.filter((_, i) => i !== idx))
  const updateScheduledDate = (idx: number, value: string) =>
    setScheduledDates((prev) => prev.map((d, i) => (i === idx ? value : d)))

  const handleDragStart = (idx: number) => { dragIndex.current = idx }
  const handleDrop = (targetIdx: number) => {
    const from = dragIndex.current
    if (from === null || from === targetIdx) return
    dragIndex.current = null
    setUploadedMedia((prev) => {
      const arr = [...prev]
      const [item] = arr.splice(from, 1)
      arr.splice(targetIdx, 0, item)
      return arr
    })
    setMediaPreviews((prev) => {
      const arr = [...prev]
      const [item] = arr.splice(from, 1)
      arr.splice(targetIdx, 0, item)
      return arr
    })
  }
  const handleDragOver = (e: React.DragEvent) => e.preventDefault()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    e.target.value = ""
    const oversized = files.find((f) => f.size > MAX_SIZE_BYTES)
    if (oversized) {
      setError(`"${oversized.name}" excede o limite de ${MAX_SIZE_MB}MB.`)
      return
    }
    setError(null)
    const maxFiles = postType === "carousel" ? 10 : 1
    const toUpload = files.slice(0, maxFiles - uploadedMedia.length)
    for (const file of toUpload) {
      setUploading(true)
      setUploadProgress(0)
      setUploadingFileName(file.name)
      const localPreview = URL.createObjectURL(file)
      setMediaPreviews((prev) => [...prev, localPreview].slice(0, maxFiles))
      try {
        const uploaded = await uploadFileWithProgress(file, (pct) => setUploadProgress(pct))
        setUploadedMedia((prev) => [...prev, uploaded].slice(0, maxFiles))
      } catch (err: any) {
        setError(err.message || "Erro ao fazer upload da mídia")
        setMediaPreviews((prev) => prev.filter((p) => p !== localPreview))
      } finally {
        setUploading(false)
        setUploadProgress(0)
        setUploadingFileName("")
      }
    }
  }

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    if (file.size > MAX_SIZE_BYTES) {
      setError(`Capa excede o limite de ${MAX_SIZE_MB}MB.`)
      return
    }
    setError(null)
    setCoverPreview(URL.createObjectURL(file))
    setUploadingCover(true)
    setCoverProgress(0)
    try {
      const uploaded = await uploadFileWithProgress(file, (pct) => setCoverProgress(pct))
      setUploadedCover(uploaded)
    } catch (err: any) {
      setError(err.message || "Erro ao fazer upload da capa")
      setCoverPreview(null)
    } finally {
      setUploadingCover(false)
      setCoverProgress(0)
    }
  }

  const removeMedia = (idx: number) => {
    setUploadedMedia((prev) => prev.filter((_, i) => i !== idx))
    setMediaPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  const removeCover = () => {
    setCoverPreview(null)
    setUploadedCover(null)
  }

  const resetForm = () => {
    reset({
      postType: "feed",
      scheduleType: "now",
      accountIds: [],
      content: "",
    })
    setUploadedMedia([])
    setMediaPreviews([])
    setCoverPreview(null)
    setUploadedCover(null)
    setError(null)
    setCharCount(0)
    setScheduledDates([""])
  }

  const handleClose = (v: boolean) => {
    if (uploading || (submitting && scheduleType !== "now")) return
    if (isEditMode) {
      onEditClose?.()
    } else {
      setOpen(v)
      if (!v) resetForm()
    }
  }

  const isOpen = isEditMode ? (editOpen ?? false) : open

  // ── Submit (criar ou editar) ───────────────────────────────────────────────
  const onSubmit = async (data: FormData) => {
    if (uploading || uploadingCover) {
      setError("Aguarde o upload da mídia terminar antes de publicar.")
      return
    }
    // Publicar/agendar exige ao menos uma conta
    if ((!data.accountIds || data.accountIds.length === 0)) {
      setError("Selecione ao menos uma conta para publicar ou agendar.")
      return
    }

    // Reels exigem obrigatoriamente um vídeo
    if (data.postType === "reel") {
      if (uploadedMedia.length === 0) {
        setError("Reels exigem um arquivo de vídeo.")
        return
      }
      if (uploadedMedia.some((m) => m.type !== "video")) {
        setError("Reels só aceitam vídeo. Remova a imagem e envie um arquivo de vídeo.")
        return
      }
    }
    setSubmitting(true)
    setError(null)

    const basePayload = {
      workspaceId,
      content: data.content || "",
      postType: data.postType,
      accountIds: data.accountIds,
      media: uploadedMedia,
      coverMedia: uploadedCover || undefined,
    }

    // Modo edição: PATCH para salvar conteúdo/mídia/contas, depois /publish para agendar ou publicar
    if (isEditMode && editPost) {
      try {
        const validDates = scheduledDates.filter((d) => d.trim() !== "")
        const scheduledAt = data.scheduleType === "scheduled" && validDates.length > 0
          ? `${validDates[0]}-03:00`
          : null

        // 1. Salva todas as propriedades via PATCH (mantém como draft temporariamente)
        const patchRes = await fetch(`/api/posts/${editPost.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: data.content || "",
            postType: data.postType,
            accountIds: data.accountIds,
            media: uploadedMedia,
            coverMedia: uploadedCover || undefined,
            scheduleType: "draft", // salva como draft primeiro
            scheduledAt: null,
          }),
        })
        const patchJson = await patchRes.json()
        if (!patchRes.ok) {
          setError(patchJson.error || "Erro ao salvar alterações")
          return
        }

        // 2. Agora publica ou agenda via /publish
        const publishRes = await fetch(`/api/posts/${editPost.id}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduleType: data.scheduleType,
            scheduledAt,
            accountIds: data.accountIds,
          }),
        })
        const publishJson = await publishRes.json()
        if (!publishRes.ok) {
          setError(publishJson.error || "Erro ao publicar/agendar")
          return
        }

        if (data.scheduleType === "now") {
          setPublishingSuccess(true)
          setTimeout(() => {
            setPublishingSuccess(false)
            onEditClose?.()
          }, 3000)
        } else {
          onEditClose?.()
        }
        router.refresh()
      } catch (err: any) {
        setError(err.message || "Erro inesperado.")
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Modo criação: publicar agora
    if (data.scheduleType === "now") {
      setPublishingSuccess(true)
      setSubmitting(false)
      fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...basePayload, scheduleType: "now" }),
      }).then(() => router.refresh()).catch(() => router.refresh())
      setTimeout(() => {
        setPublishingSuccess(false)
        setOpen(false)
        resetForm()
      }, 3000)
      return
    }

    // Modo criação: agendar (uma ou múltiplas datas)
    const validDates = scheduledDates.filter((d) => d.trim() !== "")
    if (validDates.length === 0) {
      setError("Informe ao menos uma data de agendamento.")
      setSubmitting(false)
      return
    }
    try {
      const results = await Promise.all(
        validDates.map((date) =>
          fetch("/api/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...basePayload, scheduleType: "scheduled", scheduledAt: date }),
          }).then((r) => r.json().then((json) => ({ ok: r.ok, json })))
        )
      )
      const failed = results.filter((r) => !r.ok)
      if (failed.length > 0) {
        setError(failed.map((f) => f.json.error || "Erro ao agendar").join("; "))
        return
      }
      setOpen(false)
      resetForm()
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Erro inesperado. Tente novamente.")
    } finally {
      setSubmitting(false)
    }
  }

  const isUploading = uploading || uploadingCover
  const canSubmit = !isUploading && !submitting && accounts.length > 0

  // ── Salvar rascunho ────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (isUploading) {
      setError("Aguarde o upload da mídia terminar antes de salvar.")
      return
    }
    const content = watch("content") || ""
    setSavingDraft(true)
    setError(null)

    // No modo edição, salvar rascunho via PATCH
    if (isEditMode && editPost) {
      try {
        const res = await fetch(`/api/posts/${editPost.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            postType: watch("postType"),
            accountIds: watch("accountIds") || [],
            media: uploadedMedia,
            coverMedia: uploadedCover || undefined,
            scheduleType: "draft",
            scheduledAt: null,
          }),
        })
        const json = await res.json()
        if (!res.ok) { setError(json.error || "Erro ao salvar"); return }
        onEditClose?.()
        router.refresh()
      } catch (err: any) {
        setError(err.message || "Erro inesperado.")
      } finally {
        setSavingDraft(false)
      }
      return
    }

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          content,
          postType: watch("postType"),
          scheduleType: "draft",
          accountIds: watch("accountIds") || [],
          media: uploadedMedia,
          coverMedia: uploadedCover || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || "Erro ao salvar rascunho"); return }
      setOpen(false)
      resetForm()
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Erro inesperado.")
    } finally {
      setSavingDraft(false)
    }
  }

  const dialogTitle = isEditMode
    ? (editPost?.status === "draft" ? "Editar rascunho" : "Editar post")
    : "Criar novo post"

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      {!isEditMode && (trigger || children) && <DialogTrigger asChild>{trigger ?? children}</DialogTrigger>}

      <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-2xl max-h-[90dvh] flex flex-col p-0 overflow-hidden [&>button]:z-10">
        {publishingSuccess ? (
          <div className="flex flex-col items-center justify-center gap-6 py-16 px-8 text-center">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-semibold">Publicando em segundo plano</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Seu post está sendo publicado nas contas selecionadas. Você pode continuar usando o sistema normalmente.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Esta janela fechará automaticamente em instantes.</p>
            <Button variant="outline" onClick={() => { setPublishingSuccess(false); setOpen(false); resetForm() }}>
              Fechar agora
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
              <DialogTitle className="flex items-center gap-2">
                {isEditMode && <Pencil className="w-4 h-4 text-muted-foreground" />}
                {dialogTitle}
              </DialogTitle>
            </DialogHeader>

            <ScrollArea className="flex-1 min-h-0 overflow-x-hidden">
              <form onSubmit={handleSubmit(onSubmit)} id="post-form">
                <div className="px-6 py-4 flex flex-col gap-5 w-full min-w-0">

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {accounts.length === 0 ? (
                    <Alert>
                      <AlertDescription>
                        Conecte pelo menos uma conta social antes de criar posts.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      {/* Publicar em */}
                      <div className="flex flex-col gap-2">
                        <Label>Publicar em</Label>
                        <AccountSelector
                          accounts={accounts}
                          selected={accountIds}
                          onChange={(ids) => setValue("accountIds", ids)}
                          error={errors.accountIds?.message}
                        />
                      </div>

                      {/* Formato */}
                      <div className="flex flex-col gap-2">
                        <Label>Formato do post</Label>
                        <Select
                          value={postType}
                          onValueChange={(v) => {
                            setValue("postType", v as any)
                            if (!isEditMode) {
                              setUploadedMedia([])
                              setMediaPreviews([])
                              setCoverPreview(null)
                              setUploadedCover(null)
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {postTypeOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Mídia principal */}
                      <div className="flex flex-col gap-2">
                        <Label>
                          Mídia
                          <span className="text-xs text-muted-foreground ml-2 font-normal">
                            máx. {MAX_SIZE_MB}MB
                            {postType === "reel" && " · somente vídeo"}
                            {(postType === "feed" || postType === "story") && " · imagem ou vídeo"}
                            {postType === "carousel" && " · imagens e vídeos · até 10 itens"}
                          </span>
                        </Label>

                        {mediaPreviews.length > 0 && (
                          <div className={cn("flex gap-2", postType === "carousel" ? "flex-wrap" : "")}>
                            {mediaPreviews.map((src, idx) => {
                              const isVideo = uploadedMedia[idx]?.type === "video"
                              return (
                                <div
                                  key={idx}
                                  draggable={postType === "carousel"}
                                  onDragStart={() => handleDragStart(idx)}
                                  onDrop={() => handleDrop(idx)}
                                  onDragOver={handleDragOver}
                                  className={cn(
                                    "relative rounded-lg overflow-hidden border border-border group bg-black",
                                    postType === "carousel"
                                      ? "w-20 h-20 cursor-grab active:cursor-grabbing"
                                      : "w-20 h-20"
                                  )}
                                >
                                  {isVideo ? (
                                    <video src={src} className="w-full h-full object-cover" muted />
                                  ) : (
                                    <img src={src} alt="" className="w-full h-full object-cover" />
                                  )}
                                  {postType === "carousel" && (
                                    <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <GripVertical className="w-3 h-3 text-white drop-shadow" />
                                    </div>
                                  )}
                                  <div className="absolute bottom-1 left-1">
                                    {isVideo
                                      ? <Film className="w-3 h-3 text-white drop-shadow" />
                                      : <ImageIcon className="w-3 h-3 text-white drop-shadow" />
                                    }
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeMedia(idx)}
                                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="w-3 h-3 text-white" />
                                  </button>
                                  {postType === "carousel" && (
                                    <div className="absolute bottom-1 right-1 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center">
                                      <span className="text-white text-[9px] font-bold">{idx + 1}</span>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {uploading && (
                          <div className="flex flex-col gap-2 p-4 border-2 border-dashed border-primary/30 rounded-xl bg-primary/5">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin text-primary" />
                              <span className="truncate">Enviando <strong>{uploadingFileName}</strong>...</span>
                              <span className="ml-auto font-medium text-primary">{uploadProgress}%</span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all duration-150 rounded-full"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">Aguarde o upload terminar para continuar.</p>
                          </div>
                        )}

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={getAccept(postType)}
                          multiple={postType === "carousel"}
                          className="hidden"
                          onChange={handleFileChange}
                        />

                        {!uploading && (postType !== "carousel" ? uploadedMedia.length < 1 : uploadedMedia.length < 10) && (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-8 text-muted-foreground hover:border-primary/40 hover:text-primary transition-all"
                          >
                            <Upload className="w-6 h-6" />
                            <span className="text-sm">
                              {postType === "reel"
                                ? "Selecionar vídeo do reel"
                                : postType === "story"
                                ? "Selecionar imagem ou vídeo"
                                : postType === "carousel"
                                ? `Adicionar mídia (${uploadedMedia.length}/10)`
                                : "Selecionar mídia"}
                            </span>
                            <span className="text-xs text-muted-foreground/70">
                              {postType === "reel" ? "MP4, MOV, AVI" : "JPG, PNG, GIF, MP4, MOV"}
                            </span>
                          </button>
                        )}
                      </div>

                      {/* Capa do Reel */}
                      {postType === "reel" && (
                        <div className="flex flex-col gap-2">
                          <Label>
                            Imagem de capa
                            <span className="text-xs text-muted-foreground ml-2 font-normal">
                              opcional · JPG ou PNG · máx. {MAX_SIZE_MB}MB
                            </span>
                          </Label>
                          {coverPreview ? (
                            <div className="flex items-center gap-3">
                              <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border group">
                                <img src={coverPreview} alt="Capa do reel" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={removeCover}
                                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3 text-white" />
                                </button>
                              </div>
                              {uploadingCover ? (
                                <div className="flex-1 flex flex-col gap-1">
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Loader2 className="w-3 h-3 animate-spin" /> Enviando capa...
                                    </span>
                                    <span>{coverProgress}%</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${coverProgress}%` }} />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Capa pronta</span>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => coverInputRef.current?.click()}
                              className="flex items-center gap-2 border border-dashed border-border rounded-xl px-4 py-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-all w-fit"
                            >
                              <Film className="w-4 h-4" />
                              Escolher imagem de capa
                            </button>
                          )}
                          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
                        </div>
                      )}

                      {/* Legenda */}
                      {postType !== "story" && (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <Label>Legenda</Label>
                            <span className={cn("text-xs", charCount > 2000 ? "text-destructive" : "text-muted-foreground")}>
                              {charCount}/2200
                            </span>
                          </div>
                          <Textarea
                            placeholder="Escreva sua legenda..."
                            className="resize-none min-h-[100px]"
                            {...register("content", {
                              onChange: (e) => setCharCount(e.target.value.length),
                            })}
                          />
                          {errors.content && (
                            <span className="text-xs text-destructive">{errors.content.message}</span>
                          )}
                        </div>
                      )}

                      {/* Agendamento */}
                      <div className="flex flex-col gap-3">
                        <Label>Publicação</Label>
                        <Tabs
                          value={scheduleType}
                          onValueChange={(v) => setValue("scheduleType", v as "now" | "scheduled")}
                        >
                          <TabsList>
                            <TabsTrigger value="now" className="gap-2">
                              <Send className="w-3.5 h-3.5" />
                              Agora
                            </TabsTrigger>
                            <TabsTrigger value="scheduled" className="gap-2">
                              <CalendarDays className="w-3.5 h-3.5" />
                              Agendar
                            </TabsTrigger>
                          </TabsList>
                          <TabsContent value="now">
                            <p className="text-sm text-muted-foreground mt-2">
                              {isEditMode
                                ? "O post será publicado imediatamente após salvar."
                                : "O modal será fechado imediatamente e a publicação ocorre em segundo plano."}
                            </p>
                          </TabsContent>
                          <TabsContent value="scheduled" className="mt-3">
                            <div className="flex flex-col gap-2">
                              <Label>Data e hora (horário de Brasília)</Label>
                              <div className="flex flex-col gap-2">
                                {scheduledDates.map((date, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <Input
                                      type="datetime-local"
                                      min={minDateStr}
                                      value={date}
                                      onChange={(e) => updateScheduledDate(idx, e.target.value)}
                                      className="flex-1"
                                    />
                                    {scheduledDates.length > 1 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="shrink-0 text-muted-foreground hover:text-destructive"
                                        onClick={() => removeScheduledDate(idx)}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {!isEditMode && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-fit gap-1.5 mt-1"
                                  onClick={addScheduledDate}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Adicionar data
                                </Button>
                              )}
                              {!isEditMode && scheduledDates.length > 1 && (
                                <p className="text-xs text-muted-foreground">
                                  Serão criados {scheduledDates.filter(d => d).length} agendamentos para este post.
                                </p>
                              )}
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </>
                  )}
                </div>
              </form>
            </ScrollArea>

            <div className="flex justify-between gap-3 px-6 py-4 border-t border-border bg-muted/30 shrink-0">
              {/* Salvar rascunho — sempre disponível */}
              <Button
                type="button"
                variant="ghost"
                onClick={handleSaveDraft}
                disabled={isUploading || savingDraft || submitting || (uploadedMedia.length === 0 && !watch("content"))}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookmarkIcon className="w-4 h-4" />}
                Salvar rascunho
              </Button>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleClose(false)}
                  disabled={submitting || uploading || savingDraft}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  form="post-form"
                  disabled={isUploading || submitting || savingDraft}
                  className="gap-2 min-w-32"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando mídia...
                    </>
                  ) : submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {scheduleType === "now" ? "Publicando..." : "Agendando..."}
                    </>
                  ) : scheduleType === "now" ? (
                    <>
                      <Send className="w-4 h-4" />
                      Publicar agora
                    </>
                  ) : (
                    <>
                      <CalendarDays className="w-4 h-4" />
                      {!isEditMode && scheduledDates.filter(d => d).length > 1
                        ? `Agendar ${scheduledDates.filter(d => d).length}x`
                        : "Agendar"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
