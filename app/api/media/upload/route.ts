import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { put } from "@vercel/blob"

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File

  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
  }

  const maxSizeMB = file.type.startsWith("video") ? 100 : 10
  if (file.size > maxSizeMB * 1024 * 1024) {
    return NextResponse.json(
      { error: `Arquivo muito grande. Máximo ${maxSizeMB}MB.` },
      { status: 400 }
    )
  }

  const ext = file.name.split(".").pop() || "bin"
  const filename = `posts/${session.user.id}/${Date.now()}.${ext}`

  const blob = await put(filename, file, { access: "public" })

  return NextResponse.json({ url: blob.url, pathname: blob.pathname })
}
