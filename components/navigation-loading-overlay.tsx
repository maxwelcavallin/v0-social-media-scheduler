"use client"

import { useEffect, useState, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Exibe um overlay semi-transparente com spinner sempre que o Next.js
 * está processando uma navegação para uma nova rota (RSC fetch).
 *
 * Funciona capturando cliques em links e em botões/elementos que disparam
 * router.push, e escondendo o overlay assim que o pathname/searchParams
 * realmente mudar (novo conteúdo pronto).
 */
export function NavigationLoadingOverlay() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const prevRouteRef = useRef(`${pathname}?${searchParams.toString()}`)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Detecta clique em links (<a> e Next.js <Link>) para iniciar o overlay
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null
      if (!target) return
      const href = target.getAttribute("href") ?? ""
      // Ignora links externos, âncoras, e links que abrem em nova aba
      if (
        target.target === "_blank" ||
        href.startsWith("http") ||
        href.startsWith("mailto") ||
        href.startsWith("#")
      ) return

      // Pequeno delay antes de mostrar (evita flash em navegações instantâneas)
      timerRef.current = setTimeout(() => setLoading(true), 120)
    }

    document.addEventListener("click", handleClick, true)
    return () => {
      document.removeEventListener("click", handleClick, true)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Esconde o overlay quando a rota termina de carregar (pathname/params mudou)
  useEffect(() => {
    const current = `${pathname}?${searchParams.toString()}`
    if (current !== prevRouteRef.current) {
      prevRouteRef.current = current
      if (timerRef.current) clearTimeout(timerRef.current)
      setLoading(false)
    }
  }, [pathname, searchParams])

  // Safety timeout: força esconder após 8 segundos para não travar o UI
  useEffect(() => {
    if (!loading) return
    const safetyTimer = setTimeout(() => setLoading(false), 8000)
    return () => clearTimeout(safetyTimer)
  }, [loading])

  if (!loading) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center",
        "bg-background/60 backdrop-blur-[2px]",
        "animate-in fade-in duration-150"
      )}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-3 px-6 py-5 rounded-xl bg-card border border-border shadow-lg">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground font-medium">Carregando...</span>
      </div>
    </div>
  )
}
