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

        <!-- 種別合計 -->
        <div v-if="typeBalanceSummary.length > 0" class="type-totals">
          <div v-for="t in typeBalanceSummary" :key="t.typeId" class="type-total-row">
            <span class="type-total-label">{{ t.typeName }}</span>
            <span class="type-total-amount" :class="t.statusClass">
              ¥{{ t.total.toLocaleString('ja-JP') }}
              <span class="type-total-diff" :class="t.diff >= 0 ? 'diff-positive' : 'diff-negative'">
                {{ t.diff >= 0 ? '+' : '' }}{{ t.diff.toLocaleString('ja-JP') }}
              </span>
            </span>
          </div>
        </div>

        <div class="total-row">
          <span class="total-label">合計</span>
          <div class="total-right">
            <span class="total-amount">¥{{ totalAmount.toLocaleString('ja-JP') }}</span>
            <span
              v-if="totalDiff !== null"
              class="total-diff"
              :class="totalDiff >= 0 ? 'total-diff-positive' : 'total-diff-negative'"
            >{{ totalDiff >= 0 ? '+' : '' }}{{ totalDiff.toLocaleString('ja-JP') }}（前月比）</span>
          </div>
        </div>

        <div v-if="saveSuccessMessage" class="success-message">{{ saveSuccessMessage }}</div>
        <div v-if="saveErrorMessage" class="error-message">{{ saveErrorMessage }}</div>

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

      <div v-if="store.categories.length > 0" class="category-count">
        {{ store.categories.length }} / 10 件
        <span v-if="store.categories.length >= 10" class="count-limit">（上限に達しました）</span>
      </div>

      <ul v-if="!isLoadingCategories" class="category-list">
        <li
          v-for="(category, index) in store.categories"
          :key="category.id"
          class="category-item"
          :class="{ 'is-dragging': dragFromIndex === index }"
          @dragover.prevent="onDragOver(index)"
          @drop.prevent
        >
          <span
            class="drag-handle"
            title="ドラッグして並び替え"
            draggable="true"
            @dragstart="onDragStart(index, $event)"
            @dragend="onDragEnd"
          >⠿</span>
          <span class="color-swatch-display" :style="{ background: category.color || '#cccccc' }"></span>
          <span class="category-name">{{ category.name }}</span>
          <span v-if="category.categoryTypeName" class="type-badge">{{ category.categoryTypeName }}</span>
          <button class="edit-name-btn" @click="openEditCategoryModal(category)" title="編集">✎</button>
        </li>
        <li v-if="store.categories.length === 0" class="empty-item">カテゴリがありません</li>
      </ul>

      <button
        v-if="store.categories.length < 10"
        class="add-category-btn"
        @click="openAddCategoryModal"
      >
        + カテゴリを追加
      </button>

      <div v-if="categoryErrorMessage" class="error-message">{{ categoryErrorMessage }}</div>
    </section>

    <!-- 種別管理 -->
    <section class="category-section">
      <div class="section-title-row">
        <h2 class="section-title">種別管理</h2>
        <button class="help-btn" @click="showTypeHelp = true" title="ヘルプ">？</button>
      </div>

      <ul v-if="!isLoadingCategories" class="category-list">
        <li
          v-for="(type, index) in store.categoryTypes"
          :key="type.id"
          class="category-item"
          :class="{ 'is-dragging': typeDragFromIndex === index }"
          @dragover.prevent="onTypeDragOver(index)"
          @drop.prevent
        >
          <span
            class="drag-handle"
            title="ドラッグして並び替え"
            draggable="true"
            @dragstart="onTypeDragStart(index, $event)"
            @dragend="onTypeDragEnd"
          >⠿</span>
          <span class="category-name">{{ type.name }}</span>
          <button class="edit-name-btn" @click="openEditTypeModal(type)" title="編集">✎</button>
        </li>
        <li v-if="store.categoryTypes.length === 0" class="empty-item">種別がありません</li>
      </ul>

      <button class="add-category-btn" @click="openAddTypeModal">+ 種別を追加</button>

      <div v-if="typeErrorMessage" class="error-message">{{ typeErrorMessage }}</div>
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

    <!-- 種別管理ヘルプモーダル -->
    <Teleport to="body">
      <div v-if="showTypeHelp" class="modal-overlay" @click.self="showTypeHelp = false">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">種別管理について</h2>
            <button class="modal-close" @click="showTypeHelp = false">✕</button>
          </div>
          <div class="modal-body">
            <section class="help-section">
              <h3>種別とは</h3>
              <p>カテゴリをグループ化するための分類です。<br />例：「現金」「銀行」「証券」などで口座をまとめられます。</p>
            </section>
            <section class="help-section">
              <h3>種別とカテゴリの関係</h3>
              <p>各カテゴリに種別を設定することで、サマリー画面では種別ごとの残高割合が円グラフで表示されます。</p>
            </section>
            <section class="help-section">
              <h3>目標設定との連携</h3>
              <p>目標設定画面で種別ごとに毎月の目標残高を設定できます。<br />種別合計が目標に達した場合は青字、未達の場合は赤字で表示されます。</p>
            </section>
            <section class="help-section">
              <h3>並び替え</h3>
              <p>種別左端の「⠿」マークをドラッグすると順番を変えられます。</p>
            </section>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- カテゴリ追加モーダル -->
    <Teleport to="body">
      <div v-if="showAddCategoryModal" class="modal-overlay" @click.self="closeAddCategoryModal">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">カテゴリを追加</h2>
            <button class="modal-close" @click="closeAddCategoryModal">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-field">
              <label class="form-label">カテゴリ名</label>
              <input
                v-model="addCategoryName"
                type="text"
                class="form-input"
                placeholder="カテゴリ名を入力"
                :maxlength="CATEGORY_NAME_MAX"
                @keyup.enter="submitAddCategory"
              />
            </div>
            <div class="form-field">
              <label class="form-label">色</label>
              <div class="color-row">
                <label class="color-picker-label" title="色を選択">
                  <span class="color-swatch" :style="{ background: addCategoryColor }"></span>
                  <input type="color" class="color-input" v-model="addCategoryColor" />
                </label>
                <span class="color-code">{{ addCategoryColor }}</span>
              </div>
            </div>
            <div class="form-field">
              <label class="form-label">種別</label>
              <select v-model="addCategoryTypeId" class="form-select">
                <option :value="null">なし</option>
                <option v-for="t in store.categoryTypes" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
            </div>
            <div v-if="addCategoryError" class="error-message">{{ addCategoryError }}</div>
            <div class="modal-actions">
              <button class="modal-cancel-btn" @click="closeAddCategoryModal">キャンセル</button>
              <button
                class="modal-save-btn"
                @click="submitAddCategory"
                :disabled="!addCategoryName.trim() || isAddingCategory"
              >
                {{ isAddingCategory ? '追加中...' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- カテゴリ編集モーダル -->
    <Teleport to="body">
      <div v-if="editCategoryTarget" class="modal-overlay" @click.self="closeEditCategoryModal">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">カテゴリを編集</h2>
            <button class="modal-close" @click="closeEditCategoryModal">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-field">
              <label class="form-label">カテゴリ名</label>
              <input
                v-model="editCategoryName"
                type="text"
                class="form-input"
                :maxlength="CATEGORY_NAME_MAX"
              />
            </div>
            <div class="form-field">
              <label class="form-label">色</label>
              <div class="color-row">
                <label class="color-picker-label" title="色を選択">
                  <span class="color-swatch" :style="{ background: editCategoryColor }"></span>
                  <input type="color" class="color-input" v-model="editCategoryColor" />
                </label>
                <span class="color-code">{{ editCategoryColor }}</span>
              </div>
            </div>
            <div class="form-field">
              <label class="form-label">種別</label>
              <select v-model="editCategoryTypeId" class="form-select">
                <option :value="null">なし</option>
                <option v-for="t in store.categoryTypes" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
            </div>
            <div v-if="editCategoryError" class="error-message">{{ editCategoryError }}</div>
            <div class="modal-actions">
              <button class="modal-cancel-btn" @click="closeEditCategoryModal">キャンセル</button>
              <button
                class="modal-save-btn"
                @click="submitEditCategory"
                :disabled="!editCategoryName.trim() || isSavingCategory"
              >
                {{ isSavingCategory ? '保存中...' : '保存' }}
              </button>
            </div>
            <div class="delete-divider"></div>
            <div v-if="!showDeleteConfirm" class="delete-action">
              <button class="modal-delete-btn" @click="showDeleteConfirm = true">このカテゴリを削除</button>
            </div>
            <div v-else class="delete-confirm">
              <p class="delete-warn">このカテゴリと関連する残高・目標データがすべて削除されます。本当に削除しますか？</p>
              <div class="delete-confirm-actions">
                <button class="modal-cancel-btn" @click="showDeleteConfirm = false">キャンセル</button>
                <button class="modal-delete-confirm-btn" @click="submitDeleteCategory" :disabled="isDeletingCategory">
                  {{ isDeletingCategory ? '削除中...' : '削除する' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 種別追加モーダル -->
    <Teleport to="body">
      <div v-if="showAddTypeModal" class="modal-overlay" @click.self="closeAddTypeModal">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">種別を追加</h2>
            <button class="modal-close" @click="closeAddTypeModal">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-field">
              <label class="form-label">種別名</label>
              <input
                v-model="addTypeName"
                type="text"
                class="form-input"
                placeholder="種別名を入力"
                :maxlength="TYPE_NAME_MAX"
                @keyup.enter="submitAddType"
              />
            </div>
            <div v-if="addTypeError" class="error-message">{{ addTypeError }}</div>
            <div class="modal-actions">
              <button class="modal-cancel-btn" @click="closeAddTypeModal">キャンセル</button>
              <button
                class="modal-save-btn"
                @click="submitAddType"
                :disabled="!addTypeName.trim() || isAddingType"
              >
                {{ isAddingType ? '追加中...' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 種別編集モーダル -->
    <Teleport to="body">
      <div v-if="editTypeTarget" class="modal-overlay" @click.self="closeEditTypeModal">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">種別を編集</h2>
            <button class="modal-close" @click="closeEditTypeModal">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-field">
              <label class="form-label">種別名</label>
              <input
                v-model="editTypeName"
                type="text"
                class="form-input"
                :maxlength="TYPE_NAME_MAX"
              />
            </div>
            <div v-if="editTypeError" class="error-message">{{ editTypeError }}</div>
            <div class="modal-actions">
              <button class="modal-cancel-btn" @click="closeEditTypeModal">キャンセル</button>
              <button
                class="modal-save-btn"
                @click="submitEditType"
                :disabled="!editTypeName.trim() || isSavingType"
              >
                {{ isSavingType ? '保存中...' : '保存' }}
              </button>
            </div>
            <div class="delete-divider"></div>
            <div v-if="!showTypeDeleteConfirm" class="delete-action">
              <button class="modal-delete-btn" @click="showTypeDeleteConfirm = true">この種別を削除</button>
            </div>
            <div v-else class="delete-confirm">
              <p class="delete-warn">この種別を削除すると、この種別が設定されているカテゴリの種別がクリアされます。本当に削除しますか？</p>
              <div class="delete-confirm-actions">
                <button class="modal-cancel-btn" @click="showTypeDeleteConfirm = false">キャンセル</button>
                <button class="modal-delete-confirm-btn" @click="submitDeleteType" :disabled="isDeletingType">
                  {{ isDeletingType ? '削除中...' : '削除する' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref } from 'vue'
import { useBalanceStore, type BalanceInputItem, type Category, type CategoryType } from '@/stores/balanceStore'
import { useGoalStore } from '@/stores/goalStore'

const AMOUNT_MAX = 9999999999999
const FALLBACK_COLORS = [
  '#1e3a6e', '#4169b0', '#8fa8d8', '#6b5fa5',
  '#a08fd8', '#3b82c4', '#5b9bd5', '#2d6a9f',
]
const CATEGORY_NAME_MAX = 15
const TYPE_NAME_MAX = 100

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
    const isSavingCategory = ref(false)
    const isDeletingCategory = ref(false)
    const isAddingType = ref(false)
    const isSavingType = ref(false)
    const isDeletingType = ref(false)

    const saveSuccessMessage = ref<string | null>(null)
    const saveErrorMessage = ref<string | null>(null)
    const categoryErrorMessage = ref<string | null>(null)
    const typeErrorMessage = ref<string | null>(null)

    // --- 種別ドラッグ ---
    const typeDragFromIndex = ref<number | null>(null)

    // --- 種別追加モーダル ---
    const showAddTypeModal = ref(false)
    const addTypeName = ref('')
    const addTypeError = ref<string | null>(null)

    // --- 種別編集モーダル ---
    const editTypeTarget = ref<CategoryType | null>(null)
    const editTypeName = ref('')
    const editTypeError = ref<string | null>(null)
    const showTypeDeleteConfirm = ref(false)

    // --- カテゴリ追加モーダル ---
    const showAddCategoryModal = ref(false)
    const addCategoryName = ref('')
    const addCategoryColor = ref(FALLBACK_COLORS[0])
    const addCategoryTypeId = ref<number | null>(null)
    const addCategoryError = ref<string | null>(null)

    // --- カテゴリ編集モーダル ---
    const editCategoryTarget = ref<Category | null>(null)
    const editCategoryName = ref('')
    const editCategoryColor = ref('#cccccc')
    const editCategoryTypeId = ref<number | null>(null)
    const editCategoryError = ref<string | null>(null)
    const showDeleteConfirm = ref(false)

    const totalAmount = computed(() =>
      store.inputBalances.reduce((sum, item) => sum + (item.amount ?? 0), 0),
    )

    const prevTotalAmount = computed(() =>
      store.prevInputBalances.reduce((sum, item) => sum + (item.amount ?? 0), 0),
    )

    const totalDiff = computed(() =>
      store.prevInputBalances.length > 0 ? totalAmount.value - prevTotalAmount.value : null,
    )

    // 種別ごとの合計と目標達成状況
    const typeBalanceSummary = computed(() => {
      const typeMap = new Map<number, { typeName: string; total: number; prevTotal: number }>()
      for (const cat of store.categories) {
        if (cat.categoryTypeId === null || cat.categoryTypeName === null) continue
        const balance = store.inputBalances.find((b) => b.categoryId === cat.id)
        const prevBalance = store.prevInputBalances.find((b) => b.categoryId === cat.id)
        const amount = balance?.amount ?? 0
        const prevAmount = prevBalance?.amount ?? 0
        if (!typeMap.has(cat.categoryTypeId)) {
          typeMap.set(cat.categoryTypeId, { typeName: cat.categoryTypeName, total: 0, prevTotal: 0 })
        }
        typeMap.get(cat.categoryTypeId)!.total += amount
        typeMap.get(cat.categoryTypeId)!.prevTotal += prevAmount
      }
      return Array.from(typeMap.entries()).map(([typeId, v]) => {
        const target = goalStore.getTypeTargetForMonth(typeId, selectedYearMonth.value)
        const diff = v.total - v.prevTotal
        let statusClass = ''
        if (target !== null && target > 0) {
          statusClass = diff >= target ? 'type-met' : 'type-unmet'
        }
        return { typeId, typeName: v.typeName, total: v.total, diff, statusClass }
      })
    })

    const yearMonthOptions = computed(() => {
      const [curYear, curMonth] = currentYearMonth.split('-').map(Number)
      return Array.from({ length: 60 }, (_, i) => {
        const d = new Date(curYear, curMonth - 1 - i, 1)
        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const label = `${d.getFullYear()}年${d.getMonth() + 1}月`
        return { value, label }
      })
    })

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
        await Promise.all([
          store.fetchInputBalances(selectedYearMonth.value),
          store.fetchPrevInputBalances(selectedYearMonth.value),
        ])
      } catch {
        saveErrorMessage.value = '残高データの取得に失敗しました'
      } finally {
        isLoadingBalances.value = false
      }
    }

    const onYearMonthChange = () => loadBalances()
    const goToPrevMonth = () => { selectedYearMonth.value = prevMonth.value; loadBalances() }
    const goToNextMonth = () => { if (!canGoNext.value) return; selectedYearMonth.value = nextMonth.value; loadBalances() }

    const clampAmount = (item: BalanceInputItem, e: Event) => {
      const val = Math.floor(Number((e.target as HTMLInputElement).value))
      if (isNaN(val) || val < 0) item.amount = 0
      else if (val > AMOUNT_MAX) item.amount = AMOUNT_MAX
      else item.amount = val
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

    // --- カテゴリ追加モーダル ---
    const openAddCategoryModal = () => {
      addCategoryName.value = ''
      addCategoryColor.value = FALLBACK_COLORS[store.categories.length % FALLBACK_COLORS.length]
      addCategoryTypeId.value = null
      addCategoryError.value = null
      showAddCategoryModal.value = true
    }

    const closeAddCategoryModal = () => {
      showAddCategoryModal.value = false
    }

    const submitAddCategory = async () => {
      const name = addCategoryName.value.trim()
      if (!name) return
      isAddingCategory.value = true
      addCategoryError.value = null
      try {
        await store.addCategory(name, addCategoryColor.value, addCategoryTypeId.value)
        closeAddCategoryModal()
        await loadBalances()
      } catch (e) {
        addCategoryError.value = e instanceof Error ? e.message : 'カテゴリの追加に失敗しました'
      } finally {
        isAddingCategory.value = false
      }
    }

    // --- カテゴリ編集モーダル ---
    const openEditCategoryModal = (category: Category) => {
      editCategoryTarget.value = category
      editCategoryName.value = category.name
      editCategoryColor.value = category.color || '#cccccc'
      editCategoryTypeId.value = category.categoryTypeId
      editCategoryError.value = null
      showDeleteConfirm.value = false
    }

    const closeEditCategoryModal = () => {
      editCategoryTarget.value = null
      showDeleteConfirm.value = false
    }

    const submitEditCategory = async () => {
      const target = editCategoryTarget.value
      if (!target) return
      const name = editCategoryName.value.trim()
      if (!name) return
      isSavingCategory.value = true
      editCategoryError.value = null
      try {
        await store.updateCategory(target.id, name, editCategoryColor.value, editCategoryTypeId.value)
        closeEditCategoryModal()
      } catch (e) {
        editCategoryError.value = e instanceof Error ? e.message : 'カテゴリの更新に失敗しました'
      } finally {
        isSavingCategory.value = false
      }
    }

    const submitDeleteCategory = async () => {
      const target = editCategoryTarget.value
      if (!target) return
      isDeletingCategory.value = true
      categoryErrorMessage.value = null
      try {
        await store.deleteCategory(target.id)
        closeEditCategoryModal()
        await loadBalances()
      } catch (e) {
        categoryErrorMessage.value = e instanceof Error ? e.message : 'カテゴリの削除に失敗しました'
        closeEditCategoryModal()
      } finally {
        isDeletingCategory.value = false
      }
    }

    // --- カテゴリドラッグ ---
    const showCategoryHelp = ref(false)
    const showTypeHelp = ref(false)
    const dragFromIndex = ref<number | null>(null)

    const onDragStart = (index: number, event: DragEvent) => {
      dragFromIndex.value = index
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
    }

    const onDragOver = (toIndex: number) => {
      const fromIndex = dragFromIndex.value
      if (fromIndex === null || fromIndex === toIndex) return
      const cats = store.categories
      const movedCat = cats[fromIndex]
      cats.splice(fromIndex, 1)
      cats.splice(toIndex, 0, movedCat)
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
        await store.fetchCategories()
        await loadBalances()
      }
    }

    // --- 種別追加モーダル ---
    const openAddTypeModal = () => {
      addTypeName.value = ''
      addTypeError.value = null
      showAddTypeModal.value = true
    }

    const closeAddTypeModal = () => {
      showAddTypeModal.value = false
    }

    const submitAddType = async () => {
      const name = addTypeName.value.trim()
      if (!name) return
      isAddingType.value = true
      addTypeError.value = null
      try {
        await store.addCategoryType(name)
        closeAddTypeModal()
      } catch (e) {
        addTypeError.value = e instanceof Error ? e.message : '種別の追加に失敗しました'
      } finally {
        isAddingType.value = false
      }
    }

    // --- 種別編集モーダル ---
    const openEditTypeModal = (type: CategoryType) => {
      editTypeTarget.value = type
      editTypeName.value = type.name
      editTypeError.value = null
      showTypeDeleteConfirm.value = false
    }

    const closeEditTypeModal = () => {
      editTypeTarget.value = null
      showTypeDeleteConfirm.value = false
    }

    const submitEditType = async () => {
      const target = editTypeTarget.value
      if (!target) return
      const name = editTypeName.value.trim()
      if (!name) return
      isSavingType.value = true
      editTypeError.value = null
      try {
        await store.updateCategoryType(target.id, name)
        closeEditTypeModal()
      } catch (e) {
        editTypeError.value = e instanceof Error ? e.message : '種別の更新に失敗しました'
      } finally {
        isSavingType.value = false
      }
    }

    const submitDeleteType = async () => {
      const target = editTypeTarget.value
      if (!target) return
      isDeletingType.value = true
      typeErrorMessage.value = null
      try {
        await store.deleteCategoryType(target.id)
        closeEditTypeModal()
      } catch (e) {
        typeErrorMessage.value = e instanceof Error ? e.message : '種別の削除に失敗しました'
        closeEditTypeModal()
      } finally {
        isDeletingType.value = false
      }
    }

    // --- 種別ドラッグ ---
    const onTypeDragStart = (index: number, event: DragEvent) => {
      typeDragFromIndex.value = index
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
    }

    const onTypeDragOver = (toIndex: number) => {
      const fromIndex = typeDragFromIndex.value
      if (fromIndex === null || fromIndex === toIndex) return
      const types = store.categoryTypes
      const movedType = types[fromIndex]
      types.splice(fromIndex, 1)
      types.splice(toIndex, 0, movedType)
      typeDragFromIndex.value = toIndex
    }

    const onTypeDragEnd = async () => {
      typeDragFromIndex.value = null
      typeErrorMessage.value = null
      const orders = store.categoryTypes.map((t, i) => ({ id: t.id, displayOrder: i }))
      try {
        await store.reorderCategoryTypes(orders)
      } catch {
        typeErrorMessage.value = '並び順の保存に失敗しました'
        await store.fetchCategoryTypes()
      }
    }

    // --- 備考モーダル ---
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
          store.fetchCategoryTypes(),
          goalStore.fetchGoals(),
          goalStore.fetchTypeGoalPeriods(),
        ])
        await loadBalances()
      } finally {
        isLoadingCategories.value = false
      }
    })

    return {
      store,
      showCategoryHelp,
      showTypeHelp,
      selectedYearMonth,
      currentYearMonth,
      isLoadingBalances,
      isLoadingCategories,
      isAddingCategory,
      isSavingCategory,
      isDeletingCategory,
      isAddingType,
      saveSuccessMessage,
      saveErrorMessage,
      categoryErrorMessage,
      typeErrorMessage,
      totalAmount,
      totalDiff,
      typeBalanceSummary,
      yearMonthOptions,
      canGoNext,
      getCategoryColor,
      getGoalBorderClass,
      clampAmount,
      onYearMonthChange,
      goToPrevMonth,
      goToNextMonth,
      onAmountBlur,
      // カテゴリ追加モーダル
      showAddCategoryModal,
      addCategoryName,
      addCategoryColor,
      addCategoryTypeId,
      addCategoryError,
      openAddCategoryModal,
      closeAddCategoryModal,
      submitAddCategory,
      // カテゴリ編集モーダル
      editCategoryTarget,
      editCategoryName,
      editCategoryColor,
      editCategoryTypeId,
      editCategoryError,
      showDeleteConfirm,
      openEditCategoryModal,
      closeEditCategoryModal,
      submitEditCategory,
      submitDeleteCategory,
      // カテゴリドラッグ
      dragFromIndex,
      onDragStart,
      onDragOver,
      onDragEnd,
      CATEGORY_NAME_MAX,
      TYPE_NAME_MAX,
      // 種別ドラッグ
      typeDragFromIndex,
      onTypeDragStart,
      onTypeDragOver,
      onTypeDragEnd,
      // 種別追加モーダル
      showAddTypeModal,
      addTypeName,
      addTypeError,
      openAddTypeModal,
      closeAddTypeModal,
      submitAddType,
      // 種別編集モーダル
      editTypeTarget,
      editTypeName,
      editTypeError,
      showTypeDeleteConfirm,
      isSavingType,
      isDeletingType,
      openEditTypeModal,
      closeEditTypeModal,
      submitEditType,
      submitDeleteType,
      // 備考モーダル
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

          &.goal-met { color: #3b82f6; }
          &.goal-missed { color: #ef4444; }
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
        padding-left: 18px;

        .input-wrapper .amount-input { width: 130px; }
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

    .total-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
    }

    .total-amount {
      font-size: 16px;
      font-weight: bold;
      color: #2c3e50;
    }

    .total-diff {
      font-size: 12px;
      font-weight: 500;

      &.total-diff-positive { color: #3b82f6; }
      &.total-diff-negative { color: #ef4444; }
    }
  }

  .type-totals {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .type-total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
  }

  .type-total-label {
    color: #666;
  }

  .type-total-amount {
    font-weight: 600;
    color: #2c3e50;
    display: flex;
    align-items: center;
    gap: 6px;

    &.type-met   { color: #3b82f6; }
    &.type-unmet { color: #ef4444; }
  }

  .type-total-diff {
    font-size: 11px;
    font-weight: normal;

    &.diff-positive { color: #3b82f6; }
    &.diff-negative { color: #ef4444; }
  }

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

  .color-picker-label {
    position: relative;
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    flex-shrink: 0;

    .color-swatch {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid rgba(0, 0, 0, 0.12);
      display: block;
      transition: transform 0.15s;

      &:hover { transform: scale(1.15); }
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

        &:active { cursor: grabbing; }
      }

      .color-swatch-display {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid rgba(0, 0, 0, 0.1);
        flex-shrink: 0;
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

      .type-badge {
        font-size: 11px;
        color: #888;
        background: #f0f2f5;
        border-radius: 10px;
        padding: 2px 8px;
        white-space: nowrap;
        flex-shrink: 0;
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
        flex-shrink: 0;

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

  .add-category-btn {
    width: 100%;
    padding: 10px;
    font-size: 14px;
    color: #4169b0;
    background: none;
    border: 1.5px dashed #4169b0;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
    margin-top: 4px;

    &:hover { background: #eef2fb; }
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

      &:hover:not(:disabled) { background-color: #4a8742; }

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

  &:hover { color: #333; }
}

.modal-body {
  padding: 16px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

.form-input {
  padding: 9px 12px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 6px;

  &:focus {
    border-color: #4169b0;
    outline: none;
  }
}

.form-select {
  padding: 9px 12px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;

  &:focus {
    border-color: #4169b0;
    outline: none;
  }
}

.color-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-code {
  font-size: 13px;
  color: #666;
  font-family: monospace;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.modal-cancel-btn {
  padding: 8px 16px;
  font-size: 14px;
  background: none;
  border: 1px solid #ccc;
  border-radius: 6px;
  color: #666;
  cursor: pointer;

  &:hover { background: #f5f5f5; }
}

.modal-save-btn {
  padding: 8px 20px;
  font-size: 14px;
  background: #4169b0;
  border: none;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-weight: 600;

  &:hover:not(:disabled) { background: #325090; }

  &:disabled {
    background: #a0b4d8;
    cursor: not-allowed;
  }
}

.delete-divider {
  height: 1px;
  background: #eee;
  margin: 4px 0;
}

.delete-action {
  display: flex;
  justify-content: flex-start;
}

.modal-delete-btn {
  background: none;
  border: none;
  color: #e15759;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 0;
  text-decoration: underline;

  &:hover { color: #c0392b; }
}

.delete-confirm {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.delete-warn {
  font-size: 13px;
  color: #e15759;
  background: #fff0f0;
  border: 1px solid #f5c6c6;
  border-radius: 6px;
  padding: 10px 14px;
  margin: 0;
  line-height: 1.6;
}

.delete-confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.modal-delete-confirm-btn {
  padding: 8px 20px;
  font-size: 14px;
  background: #e15759;
  border: none;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-weight: 600;

  &:hover:not(:disabled) { background: #c0392b; }

  &:disabled {
    background: #f0a0a0;
    cursor: not-allowed;
  }
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

  &:hover { background: #f5f5f5; }
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

  &:hover { background: #325090; }
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
