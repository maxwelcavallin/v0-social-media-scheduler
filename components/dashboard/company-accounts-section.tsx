"use client"

import useSWR from "swr"
import { Card, CardContent } from "@/components/ui/card"
import { Facebook, Instagram, Users2 } from "lucide-react"
import { ConnectMetaButton } from "@/components/accounts/connect-meta-button"
import { ConnectInstagramButton } from "@/components/accounts/connect-instagram-button"

interface PoolAccount {
  id: string
  platform: "facebook" | "instagram"
  name: string | null
  username: string | null
  pictureUrl: string | null
  source: "facebook" | "instagram_direct"
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function CompanyAccountsSection() {
  const { data, isLoading } = useSWR<{ accounts: PoolAccount[]; company: { id: string; name: string | null } | null }>(
    "/api/social/accounts",
    fetcher,
  )

  const accounts = data?.accounts ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Contas conectadas</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Conecte suas contas uma vez. Todos os workspaces podem selecioná-las.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ConnectMetaButton />
          <ConnectInstagramButton />
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="flex items-center gap-3 py-4">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1">
                  <div className="h-3 w-24 bg-muted rounded mb-2" />
                  <div className="h-2.5 w-16 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center text-center gap-2 py-10">
            <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
              <Users2 className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Nenhuma conta conectada</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Use os botões acima para conectar suas páginas do Facebook e contas do Instagram. Depois selecione-as em cada workspace.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map((acc) => (
            <Card key={acc.id}>
              <CardContent className="flex items-center gap-3 py-4">
                <div className="relative shrink-0">
                  {acc.pictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={acc.pictureUrl || "/placeholder.svg"}
                      alt={acc.name ?? "Conta"}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      {acc.platform === "facebook" ? (
                        <Facebook className="w-5 h-5 text-[#1877F2]" />
                      ) : (
                        <Instagram className="w-5 h-5 text-[#E4405F]" />
                      )}
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background flex items-center justify-center">
                    {acc.platform === "facebook" ? (
                      <Facebook className="w-3 h-3 text-[#1877F2]" />
                    ) : (
                      <Instagram className="w-3 h-3 text-[#E4405F]" />
                    )}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{acc.name ?? "Conta"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {acc.username ? `@${acc.username}` : acc.platform === "facebook" ? "Página do Facebook" : "Instagram"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
