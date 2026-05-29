"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Intercepta o fetch global para detectar respostas 401 (sessão expirada).
 * Ao detectar, redireciona o usuário para /login imediatamente.
 */
export function SessionGuard() {
  const router = useRouter()

  useEffect(() => {
    const originalFetch = window.fetch

    window.fetch = async (...args) => {
      const response = await originalFetch(...args)

      if (response.status === 401) {
        // Clona para não consumir o body original
        const cloned = response.clone()
        try {
          const data = await cloned.json()
          if (data?.error === "Sessão expirada" || data?.error === "Não autenticado") {
            router.push("/login")
          }
        } catch {
          router.push("/login")
        }
      }

      return response
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [router])

  return null
}
