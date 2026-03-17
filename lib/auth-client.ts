// Client-side helpers — thin wrappers around our custom auth API routes

export async function signUpEmail(name: string, email: string, password: string) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  })
  const data = await res.json()
  if (!res.ok) return { error: { message: data.error || "Erro ao criar conta." } }
  return { data }
}

export async function signInEmail(email: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) return { error: { message: data.error || "Credenciais inválidas." } }
  return { data }
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
}
