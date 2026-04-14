import { Metadata } from "next"
import { TTSView } from "@/components/tts/tts-view"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Text to Voice | SocialDog",
  description: "Gere áudios de alta qualidade a partir de textos usando IA",
}

export default function TTSPage() {
  return <TTSView />
}
