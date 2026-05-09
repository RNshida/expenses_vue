<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGoalStore, type GoalPeriod } from '@/stores/goalStore'
import { useBalanceStore } from '@/stores/balanceStore'

const goalStore = useGoalStore()
const balanceStore = useBalanceStore()

const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const showHelp = ref(false)

// 目標設定モーダル
const showGoalModal = ref(false)
const modalTypeId = ref<number | null>(null)
const modalTypeName = ref('')
const modalPeriods = ref<(Omit<GoalPeriod, 'id'> & { id: number | null })[]>([])
const modalSaving = ref(false)
const modalError = ref<string | null>(null)
const modalSuccess = ref<string | null>(null)

onMounted(async () => {
  isLoading.value = true
  try {
    await Promise.all([
      balanceStore.fetchCategoryTypes(),
      goalStore.fetchTypeGoalPeriods(),
    ])
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'データの取得に失敗しました'
  } finally {
    isLoading.value = false
  }
})

function openGoalModal(categoryTypeId: number, categoryTypeName: string) {
  modalTypeId.value = categoryTypeId
  modalTypeName.value = categoryTypeName
  const item = goalStore.typeGoalPeriods.find((t) => t.categoryTypeId === categoryTypeId)
  modalPeriods.value = item
    ? item.periods.map((p) => ({ ...p }))
    : []
  modalError.value = null
  modalSuccess.value = null
  showGoalModal.value = true
}

function addPeriod() {
  modalPeriods.value.push({ id: null, startYearMonth: '', endYearMonth: '', targetAmount: 0 })
}

function removePeriod(index: number) {
  modalPeriods.value.splice(index, 1)
}

function clampAmount(period: { targetAmount: number }, e: Event) {
  const val = Math.floor(Number((e.target as HTMLInputElement).value))
  period.targetAmount = isNaN(val) || val < 0 ? 0 : Math.min(val, 9999999999999)
}

function validatePeriods(): string | null {
  for (let i = 0; i < modalPeriods.value.length; i++) {
    const p = modalPeriods.value[i]
    if (p.startYearMonth && p.endYearMonth && p.startYearMonth > p.endYearMonth) {
      return `期間${i + 1}：開始年月が終了年月より後になっています`
    }
    if (!p.targetAmount || p.targetAmount <= 0) return `期間${i + 1}：目標金額を入力してください`
  }
  // 期間の重複チェック（nullは無限として扱う）
  const start = (p: { startYearMonth: string }) => p.startYearMonth || '0000-01'
  const end = (p: { endYearMonth: string }) => p.endYearMonth || '9999-12'
  for (let i = 0; i < modalPeriods.value.length; i++) {
    for (let j = i + 1; j < modalPeriods.value.length; j++) {
      const a = modalPeriods.value[i]
      const b = modalPeriods.value[j]
      if (start(a) <= end(b) && start(b) <= end(a)) {
        return `期間${i + 1}と期間${j + 1}が重複しています`
      }
    }
  }
  return null
}

async function saveGoalModal() {
  modalError.value = null
  const err = validatePeriods()
  if (err) { modalError.value = err; return }

  modalSaving.value = true
  try {
    await goalStore.saveTypeGoalPeriods(
      modalTypeId.value!,
      modalPeriods.value.map((p) => ({
        startYearMonth: p.startYearMonth,
        endYearMonth: p.endYearMonth,
        targetAmount: p.targetAmount,
      })),
    )
    await goalStore.fetchTypeGoalPeriods()
    modalSuccess.value = '保存しました'
    setTimeout(() => {
      showGoalModal.value = false
      modalSuccess.value = null
    }, 800)
  } catch (e) {
    modalError.value = e instanceof Error ? e.message : '保存に失敗しました'
  } finally {
    modalSaving.value = false
  }
}

function periodSummary(categoryTypeId: number): string {
  const item = goalStore.typeGoalPeriods.find((t) => t.categoryTypeId === categoryTypeId)
  if (!item || item.periods.length === 0) return '未設定'
  return `${item.periods.length}件の期間目標`
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
        種別ごとに期間を指定して目標残高増加額を設定します。
      </p>

      <div v-if="isLoading" class="loading">読み込み中...</div>

      <div v-else-if="goalStore.typeGoalPeriods.length === 0" class="empty-message">
        種別が登録されていません。残高入力画面の種別管理から登録してください。
      </div>

      <div v-else class="goal-list">
        <div
          v-for="item in goalStore.typeGoalPeriods"
          :key="item.categoryTypeId"
          class="goal-item"
        >
          <span class="type-name">{{ item.categoryTypeName }}</span>
          <span class="period-summary">{{ periodSummary(item.categoryTypeId) }}</span>
          <button class="set-btn" @click="openGoalModal(item.categoryTypeId, item.categoryTypeName)">
            目標設定
          </button>
        </div>
      </div>

      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    </div>

    <!-- 目標設定モーダル -->
    <Teleport to="body">
      <div v-if="showGoalModal" class="modal-overlay" @click.self="showGoalModal = false">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">{{ modalTypeName }}の目標設定</h2>
            <button class="modal-close" @click="showGoalModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div v-if="modalPeriods.length === 0" class="no-periods">
              期間が設定されていません。「期間を追加」から設定してください。
            </div>

            <div v-for="(period, index) in modalPeriods" :key="index" class="period-row">
              <div class="period-index">{{ index + 1 }}</div>
              <div class="period-fields">
                <div class="period-range">
                  <input
                    type="month"
                    v-model="period.startYearMonth"
                    class="month-input"
                    title="空白の場合：それ以前すべての期間"
                  />
                  <span class="range-sep">〜</span>
                  <input
                    type="month"
                    v-model="period.endYearMonth"
                    class="month-input"
                    title="空白の場合：それ以降すべての期間"
                  />
                </div>
                <div class="period-hint">※ 年月を空白にすると無期限（開始：以前すべて／終了：以降すべて）</div>
                <div class="period-amount">
                  <span class="currency">¥</span>
                  <input
                    type="number"
                    v-model.number="period.targetAmount"
                    min="1"
                    max="9999999999999"
                    step="1"
                    class="amount-input"
                    placeholder="目標金額"
                    @input="clampAmount(period, $event)"
                  />
                </div>
              </div>
              <button class="remove-btn" @click="removePeriod(index)" title="削除">✕</button>
            </div>

            <button class="add-period-btn" @click="addPeriod">＋ 期間を追加</button>

            <div v-if="modalError" class="modal-error">{{ modalError }}</div>
            <div v-if="modalSuccess" class="modal-success">{{ modalSuccess }}</div>

            <div class="modal-actions">
              <button class="cancel-btn" @click="showGoalModal = false">キャンセル</button>
              <button class="save-btn" @click="saveGoalModal" :disabled="modalSaving">
                {{ modalSaving ? '保存中...' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

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
              <p>種別ごとに期間と目標残高増加額を設定できます。期間ごとに異なる目標を設定することが可能です。</p>
            </section>
            <section class="help-section">
              <h3>残高入力画面での表示</h3>
              <div class="help-item">
                <span class="badge blue">青字</span>
                <span>前月比の増加額が目標金額以上の場合</span>
              </div>
              <div class="help-item">
                <span class="badge red">赤字</span>
                <span>前月比の増加額が目標金額未満の場合</span>
              </div>
            </section>
            <section class="help-section">
              <h3>サマリー画面での表示</h3>
              <div class="help-item">
                <span class="month-label blue-label">2024-01</span>
                <span>その月のすべての種別目標が達成されている場合</span>
              </div>
              <div class="help-item">
                <span class="month-label red-label">2024-02</span>
                <span>その月のいずれかの種別目標が未達の場合</span>
              </div>
            </section>
            <section class="help-section">
              <h3>注意事項</h3>
              <ul>
                <li>目標期間外の月は判定対象外（グレー）です。</li>
                <li>期間内に一度でもデータが入力された種別が判定対象となります。</li>
                <li>データのない月は残高0として計算されます。</li>
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
.help-btn:hover { background: #4169b0; color: #fff; }

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
  gap: 2px;
}

.goal-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 6px;
  border-bottom: 1px solid #f0f0f0;
}

.type-name {
  font-size: 14px;
  color: #333;
  font-weight: 500;
  flex: 1;
}

.period-summary {
  font-size: 12px;
  color: #888;
}

.set-btn {
  padding: 6px 14px;
  background: #4169b0;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}
.set-btn:hover { background: #325090; }

.error-message {
  color: #e15759;
  background: #fff0f0;
  border: 1px solid #e15759;
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 13px;
  margin-top: 12px;
}

.loading, .empty-message {
  color: #888;
  font-size: 13px;
  padding: 16px 0;
}

/* モーダル共通 */
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
  max-width: 520px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 0;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
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
.modal-close:hover { color: #333; }

.modal-body {
  padding: 16px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.no-periods {
  font-size: 13px;
  color: #999;
  padding: 8px 0;
}

/* 期間行 */
.period-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: #f8f9fb;
  border-radius: 8px;
  border: 1px solid #e8eaf0;
}

.period-index {
  width: 20px;
  font-size: 12px;
  color: #888;
  font-weight: 600;
  padding-top: 8px;
  flex-shrink: 0;
}

.period-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.period-range {
  display: flex;
  align-items: center;
  gap: 6px;
}

.month-input {
  flex: 1;
  padding: 7px 8px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 13px;
  min-width: 0;
}
.month-input:focus { border-color: #4169b0; outline: none; }

.range-sep {
  font-size: 13px;
  color: #888;
  flex-shrink: 0;
}

.period-hint {
  font-size: 11px;
  color: #aaa;
}

.period-amount {
  display: flex;
  align-items: center;
  gap: 4px;
}

.currency {
  font-size: 13px;
  color: #888;
}

.amount-input {
  flex: 1;
  padding: 7px 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 13px;
  text-align: right;
}
.amount-input:focus { border-color: #4169b0; outline: none; }

.remove-btn {
  background: none;
  border: none;
  color: #bbb;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  flex-shrink: 0;
  margin-top: 4px;
}
.remove-btn:hover { color: #e15759; }

.add-period-btn {
  padding: 8px 14px;
  background: #f0f4ff;
  color: #4169b0;
  border: 1px dashed #4169b0;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.add-period-btn:hover { background: #dde6ff; }

.modal-error {
  color: #e15759;
  background: #fff0f0;
  border: 1px solid #e15759;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
}

.modal-success {
  color: #59a14f;
  background: #f0faf0;
  border: 1px solid #59a14f;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 4px;
}

.cancel-btn {
  padding: 9px 20px;
  background: #f0f0f0;
  color: #555;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}
.cancel-btn:hover { background: #e0e0e0; }

.save-btn {
  padding: 9px 24px;
  background: #4169b0;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.save-btn:hover:not(:disabled) { background: #325090; }
.save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* ヘルプモーダル */
.help-section h3 { font-size: 14px; font-weight: 600; color: #2c3e50; margin: 0 0 10px; }
.help-section p { font-size: 13px; color: #555; margin: 0; line-height: 1.6; }
.help-section ul { margin: 0; padding-left: 20px; font-size: 13px; color: #555; line-height: 1.8; }

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
.badge.blue { color: #3b82f6; border-color: #3b82f6; background: rgba(59,130,246,0.06); }
.badge.red  { color: #ef4444; border-color: #ef4444; background: rgba(239,68,68,0.06); }

.month-label {
  font-size: 12px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  flex-shrink: 0;
}
.month-label.blue-label { color: #3b82f6; background: rgba(59,130,246,0.08); }
.month-label.red-label  { color: #ef4444; background: rgba(239,68,68,0.08); }
</style>
