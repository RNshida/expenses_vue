import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './authStore'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export interface GoalItem {
  categoryId: number
  categoryName: string
  targetAmount: number | null
}

export const useGoalStore = defineStore('goal', () => {
  const goals = ref<GoalItem[]>([])

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

  return { goals, fetchGoals, saveGoals, getTargetAmount }
})
