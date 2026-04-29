import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { apiMe } from './auth'

interface AuthUser { id: string; email: string; username: string }

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  loading: boolean
  login: (token: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null, token: null, loading: true,
  login: async () => {}, logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const login = useCallback(async (t: string) => {
    localStorage.setItem('af_token', t)
    setToken(t)
    const me = await apiMe(t)
    setUser(me)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('af_token')
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('af_token')
    if (!stored) { setLoading(false); return }
    apiMe(stored)
      .then((me) => { setToken(stored); setUser(me) })
      .catch(() => localStorage.removeItem('af_token'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
