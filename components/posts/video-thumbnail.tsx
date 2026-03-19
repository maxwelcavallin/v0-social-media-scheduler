"use client"

import { useEffect, useRef, useState } from "react"
import { Film } from "lucide-react"

interface Props {
  videoUrl: string
  className?: string
  alt?: string
}

// Captures a single frame from a video URL at t=0.5s using a hidden video + canvas.
// Renders the frame as a static image — no playback.
export function VideoThumbnail({ videoUrl, className = "", alt = "" }: Props) {
  const [frameSrc, setFrameSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!videoUrl) return
    setFrameSrc(null)
    setError(false)

    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.src = videoUrl
    video.muted = true
    video.playsInline = true
    video.preload = "metadata"

    const capture = () => {
      const canvas = document.createElement("canvas")
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 640
      const ctx = canvas.getContext("2d")
      if (!ctx) { setError(true); return }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8)
      setFrameSrc(dataUrl)
      video.src = "" // release
    }

    video.addEventListener("seeked", capture, { once: true })
    video.addEventListener("error", () => setError(true), { once: true })

    video.addEventListener("loadedmetadata", () => {
      video.currentTime = Math.min(0.5, video.duration / 2)
    }, { once: true })
  }, [videoUrl])

  if (error || (!frameSrc && !videoUrl)) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-muted ${className}`}>
        <Film className="w-10 h-10 text-muted-foreground/30" />
      </div>
    )
  }

  if (!frameSrc) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-muted animate-pulse ${className}`}>
        <Film className="w-8 h-8 text-muted-foreground/20" />
      </div>
    )
  }

  return (
    <img
      src={frameSrc}
      alt={alt}
      className={`w-full h-full object-cover ${className}`}
    />
  )
}
