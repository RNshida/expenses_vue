<template>
  <div class="input-view">
    <h1 class="title">残高入力</h1>

    <div class="month-selector">
      <label for="year-month">年月（月末残高）:</label>
      <select
        id="year-month"
        v-model="selectedYearMonth"
        @change="onYearMonthChange"
        class="month-select"
      >
        <option v-for="opt in yearMonthOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <!-- 残高入力フォーム -->
    <section class="balance-section">
      <h2 class="section-title">残高入力</h2>

      <div v-if="isLoadingBalances" class="loading">読み込み中...</div>

      <div v-else-if="store.categories.length === 0" class="empty-message">
        カテゴリが登録されていません。下の「カテゴリ管理」から登録してください。
      </div>

      <div v-else>
        <div
          v-for="item in store.inputBalances"
          :key="item.categoryId"
          class="balance-item"
        >
          <div class="balance-name-row">
            <span
              class="category-color-dot"
              :style="{ background: getCategoryColor(item.categoryId) }"
            ></span>
            <label class="category-label">{{ item.categoryName }}</label>
          </div>
          <div class="balance-inputs-row">
            <div class="input-wrapper">
              <span class="currency-symbol">¥</span>
              <input
                type="number"
                v-model.number="item.amount"
                min="0"
                max="9999999999999"
                step="1"
                placeholder="0"
                class="amount-input"
                :class="getGoalBorderClass(item)"
                @blur="onAmountBlur(item)"
                @input="clampAmount(item, $event)"
              />
            </div>
            <button
              class="memo-btn"
              :class="{ 'has-memo': item.memo && item.memo.trim() }"
              @click="openMemoModal(item)"
              title="備考を編集"
            >備考</button>
          </div>
        </div>

        <div class="total-row">
          <span class="total-label">合計</span>
          <span class="total-amount">¥{{ totalAmount.toLocaleString('ja-JP') }}</span>
        </div>

        <div v-if="saveSuccessMessage" class="success-message">{{ saveSuccessMessage }}</div>
        <div v-if="saveErrorMessage" class="error-message">{{ saveErrorMessage }}</div>

        <!-- 前月・次月ナビゲーション -->
        <div class="month-nav">
          <button class="month-nav-btn" @click="goToPrevMonth">← 前月へ</button>
          <button class="month-nav-btn" @click="goToNextMonth" :disabled="!canGoNext">
            次月へ →
          </button>
        </div>
      </div>
    </section>

    <!-- カテゴリ管理 -->
    <section class="category-section">
      <div class="section-title-row">
        <h2 class="section-title">カテゴリ管理</h2>
        <button class="help-btn" @click="showCategoryHelp = true" title="ヘルプ">？</button>
      </div>

      <div v-if="isLoadingCategories" class="loading">読み込み中...</div>

      <!-- カテゴリ件数表示 -->
      <div v-if="store.categories.length > 0" class="category-count">
        {{ store.categories.length }} / 10 件
        <span v-if="store.categories.length >= 10" class="count-limit">（上限に達しました）</span>
      </div>

      <ul v-else-if="!isLoadingCategories" class="category-list"></ul>
      <ul class="category-list">
        <li
          v-for="(category, index) in store.categories"
          :key="category.id"
          class="category-item"
          :class="{ 'is-dragging': dragFromIndex === index }"
          @dragover.prevent="onDragOver(index)"
          @drop.prevent
        >
          <!-- ドラッグハンドル（このspanのみdraggable） -->
          <span
            class="drag-handle"
            title="ドラッグして並び替え"
            draggable="true"
            @dragstart="onDragStart(index, $event)"
            @dragend="onDragEnd"
          >⠿</span>
          <!-- カラーピッカー -->
          <label class="color-picker-label" :title="'色を変更'">
            <span class="color-swatch" :style="{ background: category.color || '#cccccc' }"></span>
            <input
              type="color"
              class="color-input"
              :value="category.color || '#cccccc'"
              @change="onColorChange(category.id, editingCategoryId === category.id ? editingCategoryName : category.name, ($event.target as HTMLInputElement).value)"
            />
          </label>

          <!-- カテゴリ名（編集中はinput、それ以外はspan） -->
          <input
            v-if="editingCategoryId === category.id"
            v-model="editingCategoryName"
            type="text"
            class="category-name-input"
            :maxlength="CATEGORY_NAME_MAX"
            @input="clampCategoryName('editing', $event)"
            @compositionend="clampCategoryName('editing', $event)"
            @keyup.enter="saveEditingCategory(category)"
            @keyup.escape="cancelEditing"
            @blur="saveEditingCategory(category)"
          />
          <span v-else class="category-name">{{ category.name }}</span>

          <!-- 編集ボタン -->
          <button
            class="edit-name-btn"
            @click="startEditing(category)"
            title="名前を編集"
          >✎</button>

          <!-- 削除ボタン -->
          <button
            class="delete-btn"
            @click="deleteCategory(category.id)"
            title="削除"
          >✕</button>
        </li>
        <li v-if="store.categories.length === 0" class="empty-item">カテゴリがありません</li>
      </ul>

      <!-- カテゴリ追加（10件上限） -->
      <div v-if="store.categories.length < 10" class="add-category">
        <label class="color-picker-label" title="色を選択">
          <span class="color-swatch" :style="{ background: newCategoryColor }"></span>
          <input type="color" class="color-input" v-model="newCategoryColor" />
        </label>
        <input
          v-model="newCategoryName"
          type="text"
          placeholder="カテゴリ名を入力"
          :maxlength="CATEGORY_NAME_MAX"
          class="category-input"
          @input="clampCategoryName('new', $event)"
          @compositionend="clampCategoryName('new', $event)"
          @keyup.enter="addCategory"
        />
        <button
          class="add-btn"
          @click="addCategory"
          :disabled="!newCategoryName.trim() || isAddingCategory"
        >
          {{ isAddingCategory ? '追加中...' : '追加' }}
        </button>
      </div>

      <div v-if="categoryErrorMessage" class="error-message">{{ categoryErrorMessage }}</div>
    </section>

    <!-- 備考モーダル -->
    <Teleport to="body">
      <div v-if="memoModalItem" class="modal-overlay" @click.self="closeMemoModal">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">備考 — {{ memoModalItem.categoryName }}</h2>
            <button class="modal-close" @click="closeMemoModal">✕</button>
          </div>
          <div class="modal-body">
            <textarea
              v-model="memoModalValue"
              class="memo-textarea"
              placeholder="備考を入力（500文字以内）"
              maxlength="500"
              rows="5"
              autofocus
            ></textarea>
            <div class="memo-modal-actions">
              <button class="memo-modal-cancel" @click="closeMemoModal">キャンセル</button>
              <button class="memo-modal-save" @click="saveMemoModal">保存</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- カテゴリ管理ヘルプモーダル -->
    <Teleport to="body">
      <div v-if="showCategoryHelp" class="modal-overlay" @click.self="showCategoryHelp = false">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">カテゴリ管理について</h2>
            <button class="modal-close" @click="showCategoryHelp = false">✕</button>
          </div>
          <div class="modal-body">
            <section class="help-section">
              <h3>カテゴリとは</h3>
              <p>残高を管理したい対象（口座・財布など）を登録します。<br />カテゴリごとに毎月の残高を記録できます。</p>
            </section>
            <section class="help-section">
              <h3>登録例</h3>
              <ul>
                <li>○○銀行（メイン口座）</li>
                <li>△△銀行（貯蓄口座）</li>
                <li>財布（現金）</li>
                <li>□□証券（投資口座）</li>
              </ul>
            </section>
            <section class="help-section">
              <h3>並び替え</h3>
              <p>カテゴリ左端の「⠿」マークをドラッグすると順番を変えられます。</p>
            </section>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref } from 'vue'
import { useBalanceStore, type BalanceInputItem } from '@/stores/balanceStore'
import { useGoalStore } from '@/stores/goalStore'

const AMOUNT_MAX = 9999999999999

const FALLBACK_COLORS = [
  '#1e3a6e', '#4169b0', '#8fa8d8', '#6b5fa5',
  '#a08fd8', '#3b82c4', '#5b9bd5', '#2d6a9f',
]

const CATEGORY_NAME_MAX = 15
const CATEGORY_MAX_COUNT = 10

export default defineComponent({
  setup() {
    const store = useBalanceStore()
    const goalStore = useGoalStore()

    const now = new Date()
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const selectedYearMonth = ref(currentYearMonth)

    const isLoadingBalances = ref(false)
    const isLoadingCategories = ref(false)
    const isAddingCategory = ref(false)

    const saveSuccessMessage = ref<string | null>(null)
    const saveErrorMessage = ref<string | null>(null)
    const categoryErrorMessage = ref<string | null>(null)
    const newCategoryName = ref('')
    const newCategoryColor = ref(FALLBACK_COLORS[0])

    const totalAmount = computed(() =>
      store.inputBalances.reduce((sum, item) => sum + (item.amount ?? 0), 0),
    )

    // 直近5年分（60ヶ月）の年月オプションを降順で生成
    const yearMonthOptions = computed(() => {
      const [curYear, curMonth] = currentYearMonth.split('-').map(Number)
      return Array.from({ length: 60 }, (_, i) => {
        const d = new Date(curYear, curMonth - 1 - i, 1)
        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const label = `${d.getFullYear()}年${d.getMonth() + 1}月`
        return { value, label }
      })
    })

    // 前月・次月の年月文字列を計算
    const prevMonth = computed(() => {
      const [year, month] = selectedYearMonth.value.split('-').map(Number)
      const d = new Date(year, month - 2, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })

    const nextMonth = computed(() => {
      const [year, month] = selectedYearMonth.value.split('-').map(Number)
      const d = new Date(year, month, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })

    // 次月が現在月を超えない場合のみ遷移可能
    const canGoNext = computed(() => nextMonth.value <= currentYearMonth)

    const getCategoryColor = (categoryId: number): string => {
      const cat = store.categories.find((c) => c.id === categoryId)
      const idx = store.categories.findIndex((c) => c.id === categoryId)
      return cat?.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length]
    }

    const loadBalances = async () => {
      isLoadingBalances.value = true
      saveSuccessMessage.value = null
      saveErrorMessage.value = null
      try {
        await store.fetchInputBalances(selectedYearMonth.value)
      } catch {
        saveErrorMessage.value = '残高データの取得に失敗しました'
      } finally {
        isLoadingBalances.value = false
      }
    }

    const onYearMonthChange = () => {
      loadBalances()
    }

    const goToPrevMonth = () => {
      selectedYearMonth.value = prevMonth.value
      loadBalances()
    }

    const goToNextMonth = () => {
      if (!canGoNext.value) return
      selectedYearMonth.value = nextMonth.value
      loadBalances()
    }

    const clampAmount = (item: BalanceInputItem, e: Event) => {
      const val = Math.floor(Number((e.target as HTMLInputElement).value))
      if (isNaN(val) || val < 0) {
        item.amount = 0
      } else if (val > AMOUNT_MAX) {
        item.amount = AMOUNT_MAX
      } else {
        item.amount = val
      }
    }

    const onAmountBlur = async (item: BalanceInputItem) => {
      saveSuccessMessage.value = null
      saveErrorMessage.value = null
      try {
        await store.saveBalances(selectedYearMonth.value, [
          { categoryId: item.categoryId, amount: item.amount ?? null, memo: item.memo ?? null },
        ])
        saveSuccessMessage.value = '保存しました'
        setTimeout(() => (saveSuccessMessage.value = null), 3000)
      } catch {
        saveErrorMessage.value = '保存に失敗しました'
      }
    }

    const addCategory = async () => {
      const name = newCategoryName.value.trim()
      if (!name) return
      isAddingCategory.value = true
      categoryErrorMessage.value = null
      try {
        await store.addCategory(name, newCategoryColor.value)
        newCategoryName.value = ''
        // 次のカテゴリのデフォルト色をローテーション
        const nextIdx = store.categories.length % FALLBACK_COLORS.length
        newCategoryColor.value = FALLBACK_COLORS[nextIdx]
        await loadBalances()
      } catch (e) {
        categoryErrorMessage.value = e instanceof Error ? e.message : 'カテゴリの追加に失敗しました'
      } finally {
        isAddingCategory.value = false
      }
    }

    // ---- ドラッグ&ドロップによる並び替え ----
    const showCategoryHelp = ref(false)

    const dragFromIndex = ref<number | null>(null)

    const onDragStart = (index: number, event: DragEvent) => {
      dragFromIndex.value = index
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
    }

    const onDragOver = (toIndex: number) => {
      const fromIndex = dragFromIndex.value
      if (fromIndex === null || fromIndex === toIndex) return

      // カテゴリリストをその場で並び替えてライブプレビュー
      const cats = store.categories
      const movedCat = cats[fromIndex]
      cats.splice(fromIndex, 1)
      cats.splice(toIndex, 0, movedCat)

      // 残高入力リストも同期（件数が一致している場合のみ）
      const balances = store.inputBalances
      if (balances.length === cats.length) {
        const movedBalance = balances[fromIndex]
        balances.splice(fromIndex, 1)
        balances.splice(toIndex, 0, movedBalance)
      }

      dragFromIndex.value = toIndex
    }

    const onDragEnd = async () => {
      dragFromIndex.value = null
      categoryErrorMessage.value = null
      const orders = store.categories.map((cat, i) => ({ id: cat.id, displayOrder: i }))
      try {
        await store.reorderCategories(orders)
      } catch {
        categoryErrorMessage.value = '並び順の保存に失敗しました'
        // 失敗時は再取得してロールバック
        await store.fetchCategories()
        await loadBalances()
      }
    }

    const onColorChange = async (id: number, name: string, color: string) => {
      categoryErrorMessage.value = null
      try {
        await store.updateCategory(id, name, color)
      } catch {
        categoryErrorMessage.value = '色の更新に失敗しました'
      }
    }

    // ---- カテゴリ名文字数制限（IME対応） ----
    const clampCategoryName = (target: 'new' | 'editing', e: Event) => {
      const val = (e.target as HTMLInputElement).value
      if (val.length > CATEGORY_NAME_MAX) {
        const clamped = val.slice(0, CATEGORY_NAME_MAX)
        if (target === 'new') newCategoryName.value = clamped
        else editingCategoryName.value = clamped
        ;(e.target as HTMLInputElement).value = clamped
      }
    }

    // ---- カテゴリ名インライン編集 ----
    const editingCategoryId = ref<number | null>(null)
    const editingCategoryName = ref('')

    const startEditing = (category: { id: number; name: string }) => {
      editingCategoryId.value = category.id
      editingCategoryName.value = category.name
    }

    const cancelEditing = () => {
      editingCategoryId.value = null
      editingCategoryName.value = ''
    }

    const saveEditingCategory = async (category: { id: number; name: string; color: string | null }) => {
      const newName = editingCategoryName.value.trim().slice(0, CATEGORY_NAME_MAX)
      if (!newName || newName === category.name) {
        cancelEditing()
        return
      }
      categoryErrorMessage.value = null
      try {
        await store.updateCategory(category.id, newName, category.color || '#cccccc')
      } catch (e) {
        categoryErrorMessage.value = e instanceof Error ? e.message : 'カテゴリ名の更新に失敗しました'
      } finally {
        cancelEditing()
      }
    }

    // ---- 備考モーダル ----
    const memoModalItem = ref<BalanceInputItem | null>(null)
    const memoModalValue = ref('')

    const openMemoModal = (item: BalanceInputItem) => {
      memoModalItem.value = item
      memoModalValue.value = item.memo ?? ''
    }

    const closeMemoModal = () => {
      memoModalItem.value = null
      memoModalValue.value = ''
    }

    const saveMemoModal = async () => {
      const item = memoModalItem.value
      if (!item) return
      item.memo = memoModalValue.value || null
      closeMemoModal()
      await onAmountBlur(item)
    }

    const deleteCategory = async (id: number) => {
      if (!window.confirm('このカテゴリを削除しますか？')) return
      categoryErrorMessage.value = null
      try {
        await store.deleteCategory(id)
        await loadBalances()
      } catch (e) {
        categoryErrorMessage.value = e instanceof Error ? e.message : 'カテゴリの削除に失敗しました'
      }
    }

    // 目標達成ボーダークラスを返す
    const getGoalBorderClass = (item: BalanceInputItem): string => {
      const target = goalStore.getTargetAmount(item.categoryId)
      if (target === null || target <= 0) return ''
      if (item.amount === null) return 'goal-missed'
      return item.amount >= target ? 'goal-met' : 'goal-missed'
    }

    onMounted(async () => {
      isLoadingCategories.value = true
      try {
        await Promise.all([
          store.fetchCategories(),
          goalStore.fetchGoals(),
        ])
        await loadBalances()
        newCategoryColor.value = FALLBACK_COLORS[store.categories.length % FALLBACK_COLORS.length]
      } finally {
        isLoadingCategories.value = false
      }
    })

    return {
      store,
      showCategoryHelp,
      selectedYearMonth,
      currentYearMonth,
      isLoadingBalances,
      isLoadingCategories,
      isAddingCategory,
      saveSuccessMessage,
      saveErrorMessage,
      categoryErrorMessage,
      newCategoryName,
      newCategoryColor,
      totalAmount,
      yearMonthOptions,
      canGoNext,
      getCategoryColor,
      getGoalBorderClass,
      clampAmount,
      onYearMonthChange,
      goToPrevMonth,
      goToNextMonth,
      onAmountBlur,
      addCategory,
      onColorChange,
      deleteCategory,
      dragFromIndex,
      onDragStart,
      onDragOver,
      onDragEnd,
      CATEGORY_NAME_MAX,
      clampCategoryName,
      editingCategoryId,
      editingCategoryName,
      startEditing,
      cancelEditing,
      saveEditingCategory,
      memoModalItem,
      memoModalValue,
      openMemoModal,
      closeMemoModal,
      saveMemoModal,
    }
  },
})
</script>

<style lang="scss" scoped>
.input-view {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 28px;

  .title {
    font-size: 22px;
    font-weight: bold;
    color: #2c3e50;
    margin: 0;
  }

  .month-selector {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    color: #555;

    .month-select {
      padding: 8px 12px;
      font-size: 14px;
      border: 1px solid #ccc;
      border-radius: 6px;
      background-color: #fff;
      cursor: pointer;

      &:focus {
        border-color: #4169b0;
        outline: none;
      }
    }
  }

  .section-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid #e8eef3;

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #2c3e50;
      margin: 0;
      border-bottom: none;
      padding-bottom: 0;
    }

    .help-btn {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 1.5px solid #4169b0;
      background: #fff;
      color: #4169b0;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s, color 0.2s;

      &:hover {
        background: #4169b0;
        color: #fff;
      }
    }
  }

  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: #2c3e50;
    margin: 0 0 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid #e8eef3;
  }

  .balance-section,
  .category-section {
    background: #fff;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
  }

  .balance-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 6px;
    border-bottom: 1px solid #f0f0f0;

    .balance-name-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;

      .category-color-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .category-label {
        font-size: 14px;
        color: #333;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .balance-inputs-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;

      .input-wrapper {
        display: flex;
        align-items: center;
        gap: 4px;

        .currency-symbol {
          color: #888;
          font-size: 14px;
        }

        .amount-input {
          width: 160px;
          padding: 7px 10px;
          font-size: 14px;
          font-weight: 500;
          border: 1px solid #ccc;
          border-radius: 6px;
          text-align: right;
          transition: color 0.2s;

          &:focus {
            border-color: #4169b0;
            outline: none;
          }

          &.goal-met {
            color: #3b82f6;
          }

          &.goal-missed {
            color: #ef4444;
          }
        }
      }

      .memo-btn {
        padding: 6px 10px;
        font-size: 12px;
        border: 1px solid #ccc;
        border-radius: 6px;
        background: #f8f8f8;
        color: #888;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s, color 0.15s, border-color 0.15s;

        &:hover {
          background: #eef2fb;
          border-color: #4169b0;
          color: #4169b0;
        }

        &.has-memo {
          background: #eef2fb;
          border-color: #4169b0;
          color: #4169b0;
          font-weight: 600;
        }
      }
    }

    @media (max-width: 480px) {
      flex-direction: column;
      align-items: stretch;
      gap: 6px;

      .balance-inputs-row {
        padding-left: 18px; // ドット(10px) + gap(8px) 分インデント

        .input-wrapper .amount-input {
          width: 130px;
        }

        .memo-input {
          flex: 1;
          width: auto;
        }
      }
    }
  }

  .total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0 4px;

    .total-label {
      font-size: 14px;
      font-weight: 600;
      color: #2c3e50;
    }

    .total-amount {
      font-size: 16px;
      font-weight: bold;
      color: #2c3e50;
    }
  }

  // 前月・次月ナビゲーション
  .month-nav {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 12px;

    .month-nav-btn {
      flex: 1;
      padding: 8px 12px;
      font-size: 13px;
      background: none;
      color: #4169b0;
      border: 1px solid #4169b0;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s, color 0.2s;

      &:hover:not(:disabled) {
        background-color: #4169b0;
        color: #fff;
      }

      &:disabled {
        color: #bbb;
        border-color: #ddd;
        cursor: not-allowed;
      }
    }
  }

  /* カラーピッカー共通 */
  .color-picker-label {
    position: relative;
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    flex-shrink: 0;

    .color-swatch {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid rgba(0, 0, 0, 0.12);
      display: block;
      transition: transform 0.15s;

      &:hover {
        transform: scale(1.15);
      }
    }

    .color-input {
      position: absolute;
      width: 0;
      height: 0;
      opacity: 0;
      pointer-events: none;
    }
  }

  .category-list {
    list-style: none;
    padding: 0;
    margin: 0 0 16px;

    .category-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 0;
      border-bottom: 1px solid #f0f0f0;
      cursor: grab;
      transition: opacity 0.15s, background 0.15s;

      &.is-dragging {
        opacity: 0.4;
        background: #f0f4fa;
        border-radius: 6px;
      }

      .drag-handle {
        color: #bbb;
        font-size: 16px;
        cursor: grab;
        user-select: none;
        flex-shrink: 0;

        &:active {
          cursor: grabbing;
        }
      }

      .category-name {
        font-size: 14px;
        color: #333;
        flex: 1;
      }

      .category-name-input {
        flex: 1;
        font-size: 14px;
        color: #333;
        padding: 3px 6px;
        border: 1px solid #4169b0;
        border-radius: 4px;
        outline: none;
        min-width: 0;
      }

      .edit-name-btn {
        background: none;
        border: none;
        color: #aaa;
        cursor: pointer;
        font-size: 14px;
        padding: 2px 6px;
        border-radius: 4px;
        transition: color 0.2s, background 0.2s;
        flex-shrink: 0;

        &:hover {
          color: #4169b0;
          background: #eef2fb;
        }
      }

      .delete-btn {
        background: none;
        border: none;
        color: #aaa;
        cursor: pointer;
        font-size: 14px;
        padding: 2px 6px;
        border-radius: 4px;
        transition: color 0.2s, background 0.2s;

        &:hover {
          color: #e15759;
          background: #fff0f0;
        }
      }
    }

    .empty-item {
      font-size: 13px;
      color: #aaa;
      padding: 8px 0;
    }
  }

  .category-count {
    font-size: 12px;
    color: #888;
    margin-bottom: 8px;

    .count-limit {
      color: #e15759;
      font-weight: 500;
    }
  }

  .add-category {
    display: flex;
    align-items: center;
    gap: 8px;

    .category-input {
      flex: 1;
      padding: 8px 12px;
      font-size: 14px;
      border: 1px solid #ccc;
      border-radius: 6px;

      &:focus {
        border-color: #4169b0;
        outline: none;
      }
    }

    .add-btn {
      padding: 8px 16px;
      font-size: 14px;
      background-color: #59a14f;
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s;
      white-space: nowrap;

      &:hover:not(:disabled) {
        background-color: #4a8742;
      }

      &:disabled {
        background-color: #a8d0a2;
        cursor: not-allowed;
      }
    }
  }

  .success-message {
    color: #59a14f;
    background: #f0faf0;
    border: 1px solid #59a14f;
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 13px;
    margin-top: 10px;
  }

  .error-message {
    color: #e15759;
    background: #fff0f0;
    border: 1px solid #e15759;
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 13px;
    margin-top: 10px;
  }

  .loading {
    color: #888;
    font-size: 13px;
    padding: 16px 0;
  }

  .empty-message {
    color: #888;
    font-size: 13px;
    padding: 12px 0;
  }
}

/* モーダル（Teleportのためスコープ外） */
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
  max-width: 440px;
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

  &:hover {
    color: #333;
  }
}

.modal-body {
  padding: 16px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.memo-textarea {
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 6px;
  resize: vertical;
  box-sizing: border-box;
  font-family: inherit;
  color: #333;
  line-height: 1.6;

  &:focus {
    border-color: #4169b0;
    outline: none;
  }
}

.memo-modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.memo-modal-cancel {
  padding: 8px 16px;
  font-size: 14px;
  background: none;
  border: 1px solid #ccc;
  border-radius: 6px;
  color: #666;
  cursor: pointer;

  &:hover {
    background: #f5f5f5;
  }
}

.memo-modal-save {
  padding: 8px 20px;
  font-size: 14px;
  background: #4169b0;
  border: none;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-weight: 600;

  &:hover {
    background: #325090;
  }
}

.help-section {
  h3 {
    font-size: 14px;
    font-weight: 600;
    color: #2c3e50;
    margin: 0 0 8px;
  }

  p {
    font-size: 13px;
    color: #555;
    margin: 0;
    line-height: 1.6;
  }

  ul {
    margin: 0;
    padding-left: 20px;
    font-size: 13px;
    color: #555;
    line-height: 1.9;
  }
}
</style>
