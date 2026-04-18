"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Trash2 } from "lucide-react"

interface Props {
  workspace: { id: string; name: string }
}

export function WorkspaceDeleteSection({ workspace }: Props) {
  const router = useRouter()
  const [confirmName, setConfirmName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/workspaces/${workspace.id}`, { method: "DELETE" })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || "Erro ao excluir workspace.")
      setLoading(false)
      return
    }
    router.push("/dashboard")
  }

  const canDelete = confirmName === workspace.name

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        A exclusão do workspace removerá permanentemente todos os posts, mídias e contas conectadas.
        Esta ação não pode ser desfeita.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-name">
          Digite <span className="font-semibold text-foreground">{workspace.name}</span> para confirmar:
        </Label>
        <Input
          id="confirm-name"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder={workspace.name}
          className="max-w-sm"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        variant="destructive"
        onClick={handleDelete}
        disabled={loading || !canDelete}
        className="self-start gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        Excluir workspace
      </Button>
    </div>
  )
}
