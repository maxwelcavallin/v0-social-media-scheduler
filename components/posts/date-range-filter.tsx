"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { CalendarDays, ChevronDown, X } from "lucide-react"
import { format, subDays, differenceInDays } from "date-fns"
import { ptBR } from "date-fns/locale/pt-BR"
import type { DateRange } from "react-day-picker"

const PRESETS = [
  { label: "Últimos 15 dias", days: 15 },
  { label: "Últimos 30 dias", days: 30 },
  { label: "Últimos 60 dias", days: 60 },
  { label: "Últimos 90 dias", days: 90 },
]

const MAX_RANGE_DAYS = 90

interface Props {
  currentDays?: number | null
  currentFrom?: string | null
  currentTo?: string | null
}

export function DateRangeFilter({ currentDays, currentFrom, currentTo }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [range, setRange] = useState<DateRange | undefined>(undefined)
  const [rangeError, setRangeError] = useState<string | null>(null)

  // Sincroniza o calendário local com os params da URL
  useEffect(() => {
    if (currentFrom && currentTo) {
      setRange({ from: new Date(currentFrom), to: new Date(currentTo) })
    } else {
      setRange(undefined)
    }
  }, [currentFrom, currentTo])

  const applyParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v)
      else params.delete(k)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const selectPreset = (days: number) => {
    applyParams({ days: String(days), from: null, to: null })
    setRange(undefined)
    setRangeError(null)
    setOpen(false)
  }

  const applyCustomRange = () => {
    if (!range?.from || !range?.to) return
    const diff = differenceInDays(range.to, range.from)
    if (diff > MAX_RANGE_DAYS) {
      setRangeError(`Intervalo máximo de ${MAX_RANGE_DAYS} dias.`)
      return
    }
    setRangeError(null)
    applyParams({
      days: null,
      from: format(range.from, "yyyy-MM-dd"),
      to: format(range.to, "yyyy-MM-dd"),
    })
    setOpen(false)
  }

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    applyParams({ days: null, from: null, to: null })
    setRange(undefined)
    setRangeError(null)
  }

  // Label do botão
  const activePreset = PRESETS.find((p) => p.days === (currentDays ?? 15))
  let buttonLabel: string
  if (currentFrom && currentTo) {
    buttonLabel = `${format(new Date(currentFrom), "dd/MM/yy")} – ${format(new Date(currentTo), "dd/MM/yy")}`
  } else {
    buttonLabel = activePreset?.label ?? "Últimos 15 dias"
  }

  const hasCustomFilter = currentFrom && currentTo
  const isDefault = !hasCustomFilter && (!currentDays || currentDays === 15)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 text-sm font-normal",
            !isDefault && "border-primary/60 text-primary bg-primary/5"
          )}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          {buttonLabel}
          {!isDefault ? (
            <X className="w-3 h-3 ml-0.5 text-muted-foreground hover:text-foreground" onClick={clear} />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Presets à esquerda */}
          <div className="flex flex-col gap-1 p-3 border-r min-w-[160px]">
            <p className="text-xs font-medium text-muted-foreground mb-1 px-1">Período rápido</p>
            {PRESETS.map((p) => {
              const active = !hasCustomFilter && (currentDays ?? 15) === p.days
              return (
                <button
                  key={p.days}
                  onClick={() => selectPreset(p.days)}
                  className={cn(
                    "text-sm text-left px-2 py-1.5 rounded-md transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  {p.label}
                </button>
              )
            })}
          </div>

          {/* Calendário à direita */}
          <div className="p-3 flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground px-1">
              Período personalizado
              <span className="ml-1 text-muted-foreground/70">(máx. 90 dias)</span>
            </p>
            <Calendar
              mode="range"
              selected={range}
              onSelect={(r) => {
                setRange(r)
                setRangeError(null)
              }}
              disabled={{ after: new Date() }}
              locale={ptBR}
              numberOfMonths={1}
              defaultMonth={subDays(new Date(), 14)}
            />
            {rangeError && (
              <p className="text-xs text-destructive px-1">{rangeError}</p>
            )}
            <Button
              size="sm"
              className="w-full"
              disabled={!range?.from || !range?.to}
              onClick={applyCustomRange}
            >
              Aplicar período
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
