const BASE = import.meta.env.VITE_API_URL ?? ''

export interface AuthUser {
  id: string
  email: string
  username: string
}

export async function apiRegister(email: string, username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail ?? 'Registration failed')
  return data.access_token
}

export async function apiLogin(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail ?? 'Login failed')
  return data.access_token
}

export async function apiMe(token: string): Promise<AuthUser> {
  const res = await fetch(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail ?? 'Not authenticated')
  return data
}
