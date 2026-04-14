"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[v0] Dashboard error:", error.message, error.stack)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center flex flex-col gap-4">
        <h2 className="text-xl font-bold text-foreground">Erro ao carregar</h2>
        <p className="text-sm text-muted-foreground font-mono bg-muted p-3 rounded-md text-left break-all">
          {error.message || "Erro desconhecido"}
          {error.digest && <><br /><span className="text-xs opacity-60">Digest: {error.digest}</span></>}
        </p>
        <Button onClick={reset}>Tentar novamente</Button>
      </div>
    </div>
  )
}
