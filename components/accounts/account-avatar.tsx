"use client"

import { useState } from "react"

interface AccountAvatarProps {
  src: string | null
  alt: string
  fallback: React.ReactNode
  className?: string
}

export function AccountAvatar({ src, alt, fallback, className = "w-10 h-10 rounded-full object-cover" }: AccountAvatarProps) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) return <>{fallback}</>

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
