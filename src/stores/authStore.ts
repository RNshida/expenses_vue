import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

// セッション有効期間: 30分
const SESSION_DURATION_MS = 30 * 60 * 1000

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const email = ref<string | null>(localStorage.getItem('userEmail'))
  const sessionExpiry = ref<number | null>(
    localStorage.getItem('sessionExpiry') ? Number(localStorage.getItem('sessionExpiry')) : null,
  )

  const isAuthenticated = computed(() => !!token.value)

  function setAuth(newToken: string, userEmail: string) {
    const expiry = Date.now() + SESSION_DURATION_MS
    token.value = newToken
    email.value = userEmail
    sessionExpiry.value = expiry
    localStorage.setItem('token', newToken)
    localStorage.setItem('userEmail', userEmail)
    localStorage.setItem('sessionExpiry', String(expiry))
  }

  function logout() {
    token.value = null
    email.value = null
    sessionExpiry.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('sessionExpiry')
  }

  // ログイン済みの場合、セッション期限をチェックして期限切れなら自動ログアウト
  function checkSession(): void {
    if (!token.value) return
    if (sessionExpiry.value === null) {
      // 旧セッション（有効期限未設定）は今から30分に設定
      const expiry = Date.now() + SESSION_DURATION_MS
      sessionExpiry.value = expiry
      localStorage.setItem('sessionExpiry', String(expiry))
      return
    }
    if (Date.now() > sessionExpiry.value) {
      logout()
    }
  }

  function authHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.value}`,
    }
  }

  async function register(emailInput: string, password: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput, password }),
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || 'ユーザー登録に失敗しました')
    }
    const data = await response.json()
    setAuth(data.token, data.email)
  }

  async function login(emailInput: string, password: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput, password }),
    })
    if (response.status === 401) {
      throw new Error('メールアドレスまたはパスワードが正しくありません')
    }
    if (!response.ok) {
      throw new Error('ログインに失敗しました')
    }
    const data = await response.json()
    setAuth(data.token, data.email)
  }

  async function updateEmail(newEmail: string, currentPassword: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/user/email`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ newEmail, currentPassword }),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      try {
        const json = JSON.parse(text)
        throw new Error(json.detail || json.message || 'メールアドレスの変更に失敗しました')
      } catch (e) {
        if (e instanceof Error && e.message !== 'メールアドレスの変更に失敗しました') throw e
        throw new Error(text || 'メールアドレスの変更に失敗しました')
      }
    }
    const data = await response.json()
    setAuth(data.token, data.email)
  }

  async function updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/user/password`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      try {
        const json = JSON.parse(text)
        throw new Error(json.detail || json.message || 'パスワードの変更に失敗しました')
      } catch (e) {
        if (e instanceof Error && e.message !== 'パスワードの変更に失敗しました') throw e
        throw new Error(text || 'パスワードの変更に失敗しました')
      }
    }
  }

  return { token, email, isAuthenticated, authHeaders, register, login, logout, checkSession, updateEmail, updatePassword }
})
