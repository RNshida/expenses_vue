<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGoalStore } from '@/stores/goalStore'
import { useBalanceStore } from '@/stores/balanceStore'

const goalStore = useGoalStore()
const balanceStore = useBalanceStore()

const AMOUNT_MAX = 9999999999999

function clampGoalAmount(goal: { targetAmount: number | null }, e: Event) {
  const val = Math.floor(Number((e.target as HTMLInputElement).value))
  if (isNaN(val) || val < 0) {
    goal.targetAmount = null
  } else if (val > AMOUNT_MAX) {
    goal.targetAmount = AMOUNT_MAX
    ;(e.target as HTMLInputElement).value = String(AMOUNT_MAX)
  } else {
    goal.targetAmount = val
  }
}

const isLoading = ref(false)
const isSaving = ref(false)
const successMessage = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const showHelp = ref(false)

// 編集用のローカルコピー
const localGoals = ref<{ categoryId: number; categoryName: string; targetAmount: number | null }[]>([])

onMounted(async () => {
  isLoading.value = true
  try {
    await Promise.all([balanceStore.fetchCategories(), goalStore.fetchGoals()])
    localGoals.value = goalStore.goals.map((g) => ({
      categoryId: g.categoryId,
      categoryName: g.categoryName,
      targetAmount: g.targetAmount,
    }))
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'データの取得に失敗しました'
  } finally {
    isLoading.value = false
  }
})

async function save() {
  isSaving.value = true
  successMessage.value = null
  errorMessage.value = null
  try {
    await goalStore.saveGoals(
      localGoals.value.map((g) => ({
        categoryId: g.categoryId,
        targetAmount: g.targetAmount && g.targetAmount > 0 ? g.targetAmount : null,
      })),
    )
    await goalStore.fetchGoals()
    successMessage.value = '目標を保存しました'
    setTimeout(() => (successMessage.value = null), 3000)
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : '保存に失敗しました'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="goal-view">
    <div class="goal-header">
      <h1 class="title">目標設定</h1>
      <button class="help-btn" @click="showHelp = true" title="ヘルプ">？</button>
    </div>

    <div class="goal-card">
      <p class="description">
        カテゴリごとに毎月の目標残高を設定します。<br />
        入力後「保存」ボタンを押してください。
      </p>

      <div v-if="isLoading" class="loading">読み込み中...</div>

      <div v-else-if="localGoals.length === 0" class="empty-message">
        カテゴリが登録されていません。残高入力画面のカテゴリ管理から登録してください。
      </div>

      <div v-else>
        <div class="goal-list">
          <div v-for="goal in localGoals" :key="goal.categoryId" class="goal-item">
            <div class="goal-name-row">
              <span class="category-dot" :style="{ background: balanceStore.categories.find(c => c.id === goal.categoryId)?.color ?? '#ccc' }"></span>
              <label class="category-name">{{ goal.categoryName }}</label>
            </div>
            <div class="goal-input-row">
              <span class="currency">¥</span>
              <input
                type="number"
                v-model.number="goal.targetAmount"
                min="0"
                max="9999999999999"
                step="1"
                placeholder="未設定"
                class="goal-input"
                @input="clampGoalAmount(goal, $event)"
              />
            </div>
          </div>
        </div>

        <div v-if="successMessage" class="success-message">{{ successMessage }}</div>
        <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

        <button class="save-btn" @click="save" :disabled="isSaving">
          {{ isSaving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>

    <!-- ヘルプモーダル -->
    <Teleport to="body">
      <div v-if="showHelp" class="modal-overlay" @click.self="showHelp = false">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">目標設定について</h2>
            <button class="modal-close" @click="showHelp = false">✕</button>
          </div>
          <div class="modal-body">
            <section class="help-section">
              <h3>目標設定とは</h3>
              <p>カテゴリごとに毎月の目標残高（貯蓄額）を設定できます。</p>
            </section>
            <section class="help-section">
              <h3>残高入力画面での表示</h3>
              <div class="help-item">
                <span class="badge blue">青枠</span>
                <span>入力した残高が目標金額に達している場合</span>
              </div>
              <div class="help-item">
                <span class="badge red">赤枠</span>
                <span>入力した残高が目標金額に未達の場合</span>
              </div>
            </section>
            <section class="help-section">
              <h3>サマリー画面での表示</h3>
              <div class="help-item">
                <span class="month-label blue-label">2024-01</span>
                <span>その月のすべての目標が達成されている場合</span>
              </div>
              <div class="help-item">
                <span class="month-label red-label">2024-02</span>
                <span>その月のいずれかの目標が未達の場合</span>
              </div>
            </section>
            <section class="help-section">
              <h3>注意事項</h3>
              <ul>
                <li>目標未設定のカテゴリは判定対象外です。</li>
                <li>残高データのない月は判定されません。</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.goal-view {
  max-width: 600px;
  margin: 0 auto;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.goal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title {
  font-size: 22px;
  font-weight: bold;
  color: #2c3e50;
  margin: 0;
}

.help-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid #4169b0;
  background: #fff;
  color: #4169b0;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s;
}

.help-btn:hover {
  background: #4169b0;
  color: #fff;
}

.goal-card {
  background: #fff;
  border-radius: 10px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
}

.description {
  font-size: 13px;
  color: #777;
  margin: 0 0 20px;
  line-height: 1.6;
}

.goal-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 20px;
}

.goal-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 6px;
  border-bottom: 1px solid #f0f0f0;
}

.goal-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.category-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.category-name {
  font-size: 14px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goal-input-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: 18px;
}

.currency {
  font-size: 14px;
  color: #888;
}

.goal-input {
  flex: 1;
  padding: 7px 10px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 6px;
  text-align: right;
}

.goal-input:focus {
  border-color: #4169b0;
  outline: none;
}

.save-btn {
  width: 100%;
  padding: 11px;
  background-color: #4169b0;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.save-btn:hover:not(:disabled) {
  background-color: #325090;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.success-message {
  color: #59a14f;
  background: #f0faf0;
  border: 1px solid #59a14f;
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 13px;
  margin-bottom: 12px;
}

.error-message {
  color: #e15759;
  background: #fff0f0;
  border: 1px solid #e15759;
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 13px;
  margin-bottom: 12px;
}

.loading,
.empty-message {
  color: #888;
  font-size: 13px;
  padding: 16px 0;
}

/* モーダル */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 0;
}

.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: #2c3e50;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #aaa;
  cursor: pointer;
  padding: 4px;
}

.modal-close:hover {
  color: #333;
}

.modal-body {
  padding: 16px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.help-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 10px;
}

.help-section p {
  font-size: 13px;
  color: #555;
  margin: 0;
  line-height: 1.6;
}

.help-section ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #555;
  line-height: 1.8;
}

.help-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #555;
}

.badge {
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  border: 2px solid;
}

.badge.blue {
  color: #3b82f6;
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.06);
}

.badge.red {
  color: #ef4444;
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.06);
}

.month-label {
  font-size: 12px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  flex-shrink: 0;
}

.month-label.blue-label {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.08);
}

.month-label.red-label {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
}
</style>
