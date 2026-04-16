import { Suspense } from "react"
import ReviewPageClient from "./review-page-client"

export const metadata = {
  title: "Revisão de Conteúdo",
  description: "Revise e aprove o conteúdo antes da publicação",
  robots: { index: false, follow: false },
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ReviewPageClient token={token} />
    </Suspense>
  )
}
