// Landing page temporariamente desativada.
// Para reativar, remova o redirect abaixo e descomente o código original.
//
// import { LandingPage } from "@/components/landing-page"
//
// export default function HomePage() {
//   return <LandingPage />
// }

import { redirect } from "next/navigation"

export default function HomePage() {
  redirect("/login")
}
