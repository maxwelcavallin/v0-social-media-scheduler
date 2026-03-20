"use client"

import { CheckCircle2, Zap, Building2, Link2, FileText, Calendar, Headphones } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Plan } from "@/lib/plans"

interface UsageStat {
  current: number
  limit: number | typeof Infinity
}

interface Props {
  currentPlan: Plan
  usage: {
    workspaces: UsageStat
    socialAccounts: UsageStat
    postsThisMonth: UsageStat
  }
}

function UsageBar({ current, limit }: UsageStat) {
  if (limit === Infinity) return null
  const pct = Math.min(100, Math.round((current / (limit as number)) * 100))
  const isWarning = pct >= 80
  const isFull = pct >= 100
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{current} de {limit as number} usados</span>
        <span className={cn(isFull ? "text-destructive font-medium" : isWarning ? "text-amber-500 font-medium" : "")}>{pct}%</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", isFull ? "bg-destructive" : isWarning ? "bg-amber-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function PlansView({ currentPlan, usage }: Props) {
  const isFree = currentPlan === "free"

  const freePlanFeatures = [
    { icon: Building2, label: "1 workspace" },
    { icon: Link2, label: "2 contas sociais" },
    { icon: FileText, label: "30 posts/mês" },
    { icon: Calendar, label: "Calendário básico" },
  ]

  const proPlanFeatures = [
    { icon: Building2, label: "Workspaces ilimitados" },
    { icon: Link2, label: "Contas ilimitadas" },
    { icon: FileText, label: "Posts ilimitados" },
    { icon: Calendar, label: "Calendário avançado" },
    { icon: Headphones, label: "Suporte prioritário" },
  ]

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Planos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Você está no plano <span className="font-semibold capitalize">{isFree ? "Grátis" : "Pro"}</span>.
          {isFree && " Faça upgrade para desbloquear recursos ilimitados."}
        </p>
      </div>

      {/* Uso atual */}
      {isFree && (
        <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-foreground">Uso do plano gratuito</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Workspaces</p>
              <UsageBar {...usage.workspaces} />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contas sociais</p>
              <UsageBar {...usage.socialAccounts} />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Posts este mês</p>
              <UsageBar {...usage.postsThisMonth} />
            </div>
          </div>
        </div>
      )}

      {/* Cards de plano */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">

        {/* Grátis */}
        <div className={cn(
          "relative rounded-xl border bg-card p-6 flex flex-col gap-5",
          !isFree && "opacity-60"
        )}>
          {isFree && (
            <Badge variant="secondary" className="absolute top-4 right-4 text-xs">Plano atual</Badge>
          )}
          <div>
            <p className="text-base font-semibold text-foreground">Grátis</p>
            <div className="flex items-end gap-1 mt-1">
              <span className="text-3xl font-bold text-foreground">R$0</span>
              <span className="text-sm text-muted-foreground mb-0.5">/mês</span>
            </div>
          </div>
          <ul className="flex flex-col gap-2.5">
            {freePlanFeatures.map((f) => (
              <li key={f.label} className="flex items-center gap-2.5 text-sm text-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                {f.label}
              </li>
            ))}
          </ul>
          <Button variant="outline" disabled={isFree} className="mt-auto">
            {isFree ? "Plano atual" : "Fazer downgrade"}
          </Button>
        </div>

        {/* Pro */}
        <div className={cn(
          "relative rounded-xl border-2 border-primary bg-card p-6 flex flex-col gap-5",
          !isFree && "ring-2 ring-primary/20"
        )}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
              Popular
            </span>
          </div>
          {!isFree && (
            <Badge className="absolute top-4 right-4 text-xs">Plano atual</Badge>
          )}
          <div>
            <p className="text-base font-semibold text-foreground">Pro</p>
            <div className="flex items-end gap-1 mt-1">
              <span className="text-3xl font-bold text-foreground">R$97</span>
              <span className="text-sm text-muted-foreground mb-0.5">/mês</span>
            </div>
          </div>
          <ul className="flex flex-col gap-2.5">
            {proPlanFeatures.map((f) => (
              <li key={f.label} className="flex items-center gap-2.5 text-sm text-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                {f.label}
              </li>
            ))}
          </ul>
          <Button className="mt-auto gap-2" disabled={!isFree}>
            <Zap className="w-4 h-4" />
            {isFree ? "Começar agora" : "Plano atual"}
          </Button>
        </div>

      </div>
    </div>
  )
}
