import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './authStore'

export interface FurusatoEntry {
  id: number
  fiscalYear: number
  municipality: string
  productName: string
  amount: number
  status: string
}

export interface FurusatoConfig {
  annualIncome: number | null
  limitAmount: number | null
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

function parseErrorMessage(text: string, fallback: string, status?: number): string {
  try {
    const json = JSON.parse(text)
    const msg = json.detail || json.message || null
    if (msg) return msg
  } catch {
    if (text) return text
  }
  if (status) return `${fallback}（HTTP ${status}）`
  return fallback
}

export const useFurusatoStore = defineStore('furusato', () => {
  const entries = ref<FurusatoEntry[]>([])
  const config = ref<FurusatoConfig>({ annualIncome: null, limitAmount: null })
  const isLoading = ref(false)

  function h(): Record<string, string> {
    return useAuthStore().authHeaders()
  }

  async function fetchYear(fiscalYear: number): Promise<void> {
    isLoading.value = true
    try {
      const [entriesRes, configRes] = await Promise.all([
        fetch(`${API_BASE}/api/furusato/${fiscalYear}/entries`, { headers: h() }),
        fetch(`${API_BASE}/api/furusato/${fiscalYear}/config`, { headers: h() }),
      ])
      if (!entriesRes.ok) {
        const text = await entriesRes.text().catch(() => '')
        throw new Error(parseErrorMessage(text, '寄付データの取得に失敗しました', entriesRes.status))
      }
      if (!configRes.ok) {
        const text = await configRes.text().catch(() => '')
        throw new Error(parseErrorMessage(text, '設定の取得に失敗しました', configRes.status))
      }
      entries.value = await entriesRes.json()
      config.value = await configRes.json()
    } finally {
      isLoading.value = false
    }
  }

  async function addEntry(
    fiscalYear: number,
    form: { municipality: string; productName: string; amount: number; status: string },
  ): Promise<FurusatoEntry> {
    const response = await fetch(`${API_BASE}/api/furusato/${fiscalYear}/entries`, {
      method: 'POST',
      headers: h(),
      body: JSON.stringify(form),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(parseErrorMessage(text, '追加に失敗しました', response.status))
    }
    const newEntry: FurusatoEntry = await response.json()
    entries.value.push(newEntry)
    return newEntry
  }

  async function updateEntry(
    id: number,
    form: { municipality: string; productName: string; amount: number; status: string },
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/api/furusato/entries/${id}`, {
      method: 'PUT',
      headers: h(),
      body: JSON.stringify(form),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(parseErrorMessage(text, '更新に失敗しました', response.status))
    }
    const updated: FurusatoEntry = await response.json()
    const idx = entries.value.findIndex((e) => e.id === id)
    if (idx !== -1) entries.value[idx] = updated
  }

  async function deleteEntry(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/api/furusato/entries/${id}`, {
      method: 'DELETE',
      headers: h(),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(parseErrorMessage(text, '削除に失敗しました', response.status))
    }
    entries.value = entries.value.filter((e) => e.id !== id)
  }

  async function saveConfig(
    fiscalYear: number,
    configData: FurusatoConfig,
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/api/furusato/${fiscalYear}/config`, {
      method: 'PUT',
      headers: h(),
      body: JSON.stringify(configData),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(parseErrorMessage(text, '設定の保存に失敗しました', response.status))
    }
  }

  return { entries, config, isLoading, fetchYear, addEntry, updateEntry, deleteEntry, saveConfig }
})
