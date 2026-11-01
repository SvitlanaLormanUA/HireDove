import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, setUnauthorizedHandler, tokenStorage } from '../api/client'
import { AuthContext, type RegisterData, type TokenResponse, type User } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => tokenStorage.get() !== null)

  const clearSession = useCallback(() => {
    tokenStorage.clear()
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(clearSession)
    return () => setUnauthorizedHandler(null)
  }, [clearSession])

  // Restore session on page load.
  useEffect(() => {
    if (!tokenStorage.get()) return
    api<User>('/auth/me')
      .then(setUser)
      .catch(clearSession)
      .finally(() => setLoading(false))
  }, [clearSession])

  const startSession = useCallback((res: TokenResponse) => {
    tokenStorage.set(res.access_token)
    setUser(res.user)
    return res.user
  }, [])

  const login = useCallback(
    async (email: string, password: string) =>
      startSession(
        await api<TokenResponse>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }),
      ),
    [startSession],
  )

  const register = useCallback(
    async (data: RegisterData) =>
      startSession(
        await api<TokenResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
      ),
    [startSession],
  )

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    clearSession()
  }, [clearSession])

  const logoutAll = useCallback(async () => {
    await api('/auth/logout-all', { method: 'POST' }).catch(() => {})
    clearSession()
  }, [clearSession])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, logoutAll }),
    [user, loading, login, register, logout, logoutAll],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
