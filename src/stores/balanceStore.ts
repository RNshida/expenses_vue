import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './authStore'

export interface Category {
  id: number
  name: string
  color: string | null
  displayOrder: number | null
}

export interface BalanceSummarySeriesItem {
  categoryId: number
  categoryName: string
  amounts: (number | null)[]
}

export interface BalanceSummaryResponse {
  months: string[]
  series: BalanceSummarySeriesItem[]
}

export interface BalanceInputItem {
  categoryId: number
  categoryName: string
  amount: number | null
  memo: string | null
}

// 本番時は .env.production の VITE_API_BASE_URL が付く（開発時は空＝Viteプロキシ経由）
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

function parseErrorMessage(text: string, fallback: string, status?: number): string {
  try {
    const json = JSON.parse(text)
    // Spring Boot 3.x は RFC 7807 形式（detail フィールド）で返す
    const msg = json.detail || json.message || null
    if (msg) return msg
  } catch {
    if (text) return text
  }
  if (status) return `${fallback}（HTTP ${status}）`
  return fallback
}

export const useBalanceStore = defineStore('balance', () => {
  const categories = ref<Category[]>([])
  const summary = ref<BalanceSummaryResponse>({ months: [], series: [] })
  const inputBalances = ref<BalanceInputItem[]>([])

  function h(): Record<string, string> {
    return useAuthStore().authHeaders()
  }

  async function fetchCategories(): Promise<void> {
    const response = await fetch(`${API_BASE}/api/categories`, { headers: h() })
    if (!response.ok) throw new Error('カテゴリの取得に失敗しました')
    categories.value = await response.json()
  }

  async function addCategory(name: string, color: string): Promise<Category> {
    const response = await fetch(`${API_BASE}/api/categories`, {
      method: 'POST',
      headers: h(),
      body: JSON.stringify({ name, color }),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(parseErrorMessage(text, 'カテゴリの追加に失敗しました', response.status))
    }
    const newCategory: Category = await response.json()
    categories.value.push(newCategory)
    return newCategory
  }

  async function updateCategory(id: number, name: string, color: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/categories/${id}`, {
      method: 'PUT',
      headers: h(),
      body: JSON.stringify({ name, color }),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(parseErrorMessage(text, 'カテゴリの更新に失敗しました', response.status))
    }
    const updated: Category = await response.json()
    const index = categories.value.findIndex((c) => c.id === id)
    if (index !== -1) categories.value[index] = updated
  }

  async function deleteCategory(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/api/categories/${id}`, {
      method: 'DELETE',
      headers: h(),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(text || 'カテゴリの削除に失敗しました')
    }
    categories.value = categories.value.filter((c) => c.id !== id)
    inputBalances.value = inputBalances.value.filter((b) => b.categoryId !== id)
  }

  async function fetchSummary(months: number): Promise<void> {
    const response = await fetch(`${API_BASE}/api/balances/summary?months=${months}`, {
      headers: h(),
    })
    if (!response.ok) throw new Error('サマリーの取得に失敗しました')
    summary.value = await response.json()
  }

  async function fetchInputBalances(yearMonth: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/balances/input?yearMonth=${yearMonth}`, {
      headers: h(),
    })
    if (!response.ok) throw new Error('残高データの取得に失敗しました')
    inputBalances.value = await response.json()
  }

  async function reorderCategories(orders: { id: number; displayOrder: number }[]): Promise<void> {
    const response = await fetch(`${API_BASE}/api/categories/reorder`, {
      method: 'PUT',
      headers: h(),
      body: JSON.stringify({ orders }),
    })
    if (!response.ok) throw new Error('カテゴリの並び替えに失敗しました')
    // ローカルの displayOrder を更新
    orders.forEach(({ id, displayOrder }) => {
      const cat = categories.value.find((c) => c.id === id)
      if (cat) cat.displayOrder = displayOrder
    })
  }

  async function saveBalances(
    yearMonth: string,
    balances: { categoryId: number; amount: number | null; memo?: string | null }[],
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/api/balances/input`, {
      method: 'POST',
      headers: h(),
      body: JSON.stringify({ yearMonth, balances }),
    })
    if (!response.ok) throw new Error('残高の保存に失敗しました')
  }

  return {
    categories,
    summary,
    inputBalances,
    fetchCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    fetchSummary,
    fetchInputBalances,
    reorderCategories,
    saveBalances,
  }
})
