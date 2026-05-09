import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './authStore'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export interface GoalItem {
  categoryId: number
  categoryName: string
  targetAmount: number | null
}

export interface CategoryTypeGoalItem {
  categoryTypeId: number
  categoryTypeName: string
  targetAmount: number | null
}

export interface GoalPeriod {
  id: number | null
  startYearMonth: string
  endYearMonth: string
  targetAmount: number
}

export interface TypeGoalPeriodsItem {
  categoryTypeId: number
  categoryTypeName: string
  periods: GoalPeriod[]
}

export const useGoalStore = defineStore('goal', () => {
  const goals = ref<GoalItem[]>([])
  const typeGoals = ref<CategoryTypeGoalItem[]>([])
  const typeGoalPeriods = ref<TypeGoalPeriodsItem[]>([])

  function h(): Record<string, string> {
    return useAuthStore().authHeaders()
  }

  async function fetchGoals(): Promise<void> {
    const response = await fetch(`${API_BASE}/api/goals`, { headers: h() })
    if (!response.ok) throw new Error('目標の取得に失敗しました')
    goals.value = await response.json()
  }

  async function saveGoals(items: { categoryId: number; targetAmount: number | null }[]): Promise<void> {
    const response = await fetch(`${API_BASE}/api/goals`, {
      method: 'PUT',
      headers: h(),
      body: JSON.stringify({ goals: items }),
    })
    if (!response.ok) throw new Error('目標の保存に失敗しました')
  }

  function getTargetAmount(categoryId: number): number | null {
    return goals.value.find((g) => g.categoryId === categoryId)?.targetAmount ?? null
  }

  async function fetchTypeGoals(): Promise<void> {
    const response = await fetch(`${API_BASE}/api/goals/types`, { headers: h() })
    if (!response.ok) throw new Error('種別目標の取得に失敗しました')
    typeGoals.value = await response.json()
  }

  async function saveTypeGoals(items: { categoryTypeId: number; targetAmount: number | null }[]): Promise<void> {
    const response = await fetch(`${API_BASE}/api/goals/types`, {
      method: 'PUT',
      headers: h(),
      body: JSON.stringify({ goals: items }),
    })
    if (!response.ok) throw new Error('種別目標の保存に失敗しました')
  }

  async function fetchTypeGoalPeriods(): Promise<void> {
    const response = await fetch(`${API_BASE}/api/goals/type-periods`, { headers: h() })
    if (!response.ok) throw new Error('種別目標期間の取得に失敗しました')
    typeGoalPeriods.value = await response.json()
  }

  async function saveTypeGoalPeriods(categoryTypeId: number, periods: Omit<GoalPeriod, 'id'>[]): Promise<void> {
    const response = await fetch(`${API_BASE}/api/goals/type-periods/${categoryTypeId}`, {
      method: 'PUT',
      headers: h(),
      body: JSON.stringify({ periods }),
    })
    if (!response.ok) throw new Error('種別目標期間の保存に失敗しました')
  }

  function getTypeTargetForMonth(categoryTypeId: number, yearMonth: string): number | null {
    const item = typeGoalPeriods.value.find((t) => t.categoryTypeId === categoryTypeId)
    if (!item) return null
    const period = item.periods.find(
      (p) =>
        (!p.startYearMonth || p.startYearMonth <= yearMonth) &&
        (!p.endYearMonth || yearMonth <= p.endYearMonth),
    )
    return period ? period.targetAmount : null
  }

  return {
    goals,
    typeGoals,
    typeGoalPeriods,
    fetchGoals,
    saveGoals,
    getTargetAmount,
    fetchTypeGoals,
    saveTypeGoals,
    fetchTypeGoalPeriods,
    saveTypeGoalPeriods,
    getTypeTargetForMonth,
  }
})
