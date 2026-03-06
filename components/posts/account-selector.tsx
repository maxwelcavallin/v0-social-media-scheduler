"use client"

import { useState, useRef, useEffect } from "react"
import { Instagram, Facebook, Search, Check, ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface Account {
  id: string
  platform: string
  account_name: string
  account_username?: string
  profile_picture_url?: string
}

interface Props {
  accounts: Account[]
  selected: string[]
  onChange: (ids: string[]) => void
  error?: string
}

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="w-3.5 h-3.5" style={{ color: "oklch(0.52 0.25 15)" }} />,
  facebook: <Facebook className="w-3.5 h-3.5" style={{ color: "oklch(0.46 0.18 242)" }} />,
}

export function AccountSelector({ accounts, selected, onChange, error }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase()
    return (
      a.account_name.toLowerCase().includes(q) ||
      (a.account_username || "").toLowerCase().includes(q) ||
      a.platform.toLowerCase().includes(q)
    )
  })

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  const removeSelected = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selected.filter((s) => s !== id))
  }

  const selectedAccounts = accounts.filter((a) => selected.includes(a.id))

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full min-h-10 px-3 py-2 flex flex-wrap items-center gap-1.5 rounded-md border text-sm text-left transition-colors",
          "bg-background border-input hover:border-ring focus:outline-none",
          open && "border-ring ring-1 ring-ring",
          error && "border-destructive"
        )}
      >
        {selectedAccounts.length === 0 ? (
          <span className="text-muted-foreground flex-1">Selecione as contas...</span>
        ) : (
          selectedAccounts.map((acc) => (
            <span
              key={acc.id}
              className="flex items-center gap-1 bg-accent text-accent-foreground px-2 py-0.5 rounded-md text-xs font-medium"
            >
              {platformIcons[acc.platform]}
              {acc.account_name}
              <button
                type="button"
                onClick={(e) => removeSelected(acc.id, e)}
                className="ml-0.5 hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground ml-auto transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Pesquisar conta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                Nenhuma conta encontrada
              </div>
            ) : (
              filtered.map((acc) => {
                const isSelected = selected.includes(acc.id)
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => toggle(acc.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent transition-colors",
                      isSelected && "bg-accent/60"
                    )}
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {acc.profile_picture_url ? (
                        <img src={acc.profile_picture_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        platformIcons[acc.platform]
                      )}
                    </div>
                    <div className="flex flex-col items-start flex-1 min-w-0">
                      <span className="font-medium text-foreground truncate">{acc.account_name}</span>
                      {acc.account_username && (
                        <span className="text-xs text-muted-foreground">@{acc.account_username}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {platformIcons[acc.platform]}
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  )
}
