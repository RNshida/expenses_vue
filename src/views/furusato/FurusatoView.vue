<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useFurusatoStore } from '@/stores/furusatoStore'

type FurusatoStatus = '未申請' | 'ワンストップ申請済み' | '確定申告予定' | '確定申告済み'

interface FurusatoEntry {
  id: number
  municipality: string
  productName: string
  amount: number
  status: FurusatoStatus
}

const STATUS_OPTIONS: FurusatoStatus[] = [
  '未申請',
  'ワンストップ申請済み',
  '確定申告予定',
  '確定申告済み',
]

const STATUS_STYLE: Record<FurusatoStatus, string> = {
  '未申請': 'status-pending',
  'ワンストップ申請済み': 'status-onestop',
  '確定申告予定': 'status-tax-plan',
  '確定申告済み': 'status-done',
}

// 簡易計算（独身・扶養なし）
function calcFurusatoLimit(annualIncome: number): number {
  const income = annualIncome * 10000 // 万円 → 円

  let kyuyoKojo: number
  if (income <= 1625000) kyuyoKojo = 550000
  else if (income <= 1800000) kyuyoKojo = Math.floor(income * 0.4) - 100000
  else if (income <= 3600000) kyuyoKojo = Math.floor(income * 0.3) + 80000
  else if (income <= 6600000) kyuyoKojo = Math.floor(income * 0.2) + 440000
  else if (income <= 8500000) kyuyoKojo = Math.floor(income * 0.1) + 1100000
  else kyuyoKojo = 1950000

  const kyuyoShotoku = income - kyuyoKojo
  const shakaihoken = Math.floor(income * 0.15)
  const kisokojo = 480000
  const kazeiShotoku = Math.max(0, kyuyoShotoku - shakaihoken - kisokojo)
  const juminzei = Math.floor(kazeiShotoku * 0.1)

  let zeiritsu: number
  if (kazeiShotoku <= 1950000) zeiritsu = 0.05
  else if (kazeiShotoku <= 3300000) zeiritsu = 0.10
  else if (kazeiShotoku <= 6950000) zeiritsu = 0.20
  else if (kazeiShotoku <= 9000000) zeiritsu = 0.23
  else if (kazeiShotoku <= 18000000) zeiritsu = 0.33
  else if (kazeiShotoku <= 40000000) zeiritsu = 0.40
  else zeiritsu = 0.45

  const denominator = 0.9 - zeiritsu * 1.021
  if (denominator <= 0) return 0
  return Math.floor(juminzei * 0.2 / denominator) + 2000
}

const furusatoStore = useFurusatoStore()

const now = new Date()
const currentYear = now.getFullYear()
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i)

const selectedYear = ref(currentYear)
const isLoading = ref(false)
const isSaving = ref(false)
const pageError = ref('')

const annualIncome = ref<number | null>(null)
const limitAmount = ref<number | null>(null)

const entries = computed(() => furusatoStore.entries as FurusatoEntry[])

const totalAmount = computed(() => entries.value.reduce((s, e) => s + e.amount, 0))

// ユニーク自治体数（ワンストップ申請の5自治体制限チェック用）
const uniqueMunicipalityCount = computed(() =>
  new Set(entries.value.map((e) => e.municipality.trim().toLowerCase())).size,
)

const showHelp = ref(false)

const remaining = computed(() => {
  if (limitAmount.value === null) return null
  return limitAmount.value - totalAmount.value
})

function syncConfigFromStore() {
  annualIncome.value = furusatoStore.config.annualIncome
  limitAmount.value = furusatoStore.config.limitAmount
}

async function fetchYear(year: number) {
  isLoading.value = true
  pageError.value = ''
  try {
    await furusatoStore.fetchYear(year)
    syncConfigFromStore()
  } catch (e: unknown) {
    pageError.value = e instanceof Error ? e.message : 'データの取得に失敗しました'
  } finally {
    isLoading.value = false
  }
}

async function saveConfig() {
  try {
    await furusatoStore.saveConfig(selectedYear.value, {
      annualIncome: annualIncome.value,
      limitAmount: limitAmount.value,
    })
  } catch {
    // 設定保存の失敗はサイレントに無視（UIへの影響なし）
  }
}

watch(selectedYear, (year) => fetchYear(year))

const INCOME_MAX = 10000   // 万円（1億円）
const LIMIT_MAX = 10000000 // 円（1000万円）
const AMOUNT_MAX = 10000000 // 円（1000万円）
const incomeError = ref('')
const limitError = ref('')

// 数値inputの共通クランプ処理
function clampNumberInput(e: Event, min: number, max: number): number | null {
  const raw = (e.target as HTMLInputElement).value
  if (raw === '' || raw === null) {
    ;(e.target as HTMLInputElement).value = ''
    return null
  }
  let val = Math.floor(Number(raw))
  if (isNaN(val)) val = min
  if (val < min) val = min
  if (val > max) val = max
  ;(e.target as HTMLInputElement).value = String(val)
  return val
}

// 年収入力の整数・範囲チェック
function onIncomeInput(e: Event) {
  const val = clampNumberInput(e, 1, INCOME_MAX)
  annualIncome.value = val
  incomeError.value = ''
}

// 上限額入力の整数・範囲チェック
function onLimitInput(e: Event) {
  const val = clampNumberInput(e, 1, LIMIT_MAX)
  limitAmount.value = val
  limitError.value = ''
}

// 寄付金額入力の整数・範囲チェック
function onAmountInput(target: 'add' | 'edit', e: Event) {
  const val = clampNumberInput(e, 1, AMOUNT_MAX)
  if (target === 'add') addForm.value.amount = val
  else editForm.value.amount = val
}

// 年収から上限を計算してセット
function applyCalc() {
  const income = annualIncome.value
  incomeError.value = ''
  if (!income || income <= 0) {
    incomeError.value = '年収を入力してください'
    return
  }
  if (!Number.isInteger(income) || income > INCOME_MAX) {
    incomeError.value = `年収は1〜${INCOME_MAX.toLocaleString('ja-JP')}万円で入力してください`
    return
  }
  limitAmount.value = calcFurusatoLimit(income)
  saveConfig()
}

function onIncomeChange() {
  saveConfig()
}

function onLimitChange() {
  saveConfig()
}

// 文字数制限（IME対応）
const MUNICIPALITY_MAX = 50
const PRODUCT_MAX = 20

function clampMunicipality(target: 'add' | 'edit', e: Event) {
  const val = (e.target as HTMLInputElement).value
  if (val.length > MUNICIPALITY_MAX) {
    const clamped = val.slice(0, MUNICIPALITY_MAX)
    if (target === 'add') addForm.value.municipality = clamped
    else editForm.value.municipality = clamped
    ;(e.target as HTMLInputElement).value = clamped
  }
}

function clampProduct(target: 'add' | 'edit', e: Event) {
  const val = (e.target as HTMLInputElement).value
  if (val.length > PRODUCT_MAX) {
    const clamped = val.slice(0, PRODUCT_MAX)
    if (target === 'add') addForm.value.productName = clamped
    else editForm.value.productName = clamped
    ;(e.target as HTMLInputElement).value = clamped
  }
}

// ─── 追加フォーム ─────────────────────────────────
const showAddForm = ref(false)
const addForm = ref({ municipality: '', productName: '', amount: null as number | null, status: '未申請' as FurusatoStatus })
const addError = ref('')

function openAdd() {
  addForm.value = { municipality: '', productName: '', amount: null, status: '未申請' }
  addError.value = ''
  showAddForm.value = true
}

function cancelAdd() {
  showAddForm.value = false
}

async function submitAdd() {
  addError.value = ''
  if (!addForm.value.municipality.trim()) { addError.value = '自治体名を入力してください'; return }
  if (!addForm.value.amount || addForm.value.amount <= 0) { addError.value = '金額を入力してください'; return }

  isSaving.value = true
  try {
    await furusatoStore.addEntry(selectedYear.value, {
      municipality: addForm.value.municipality.trim(),
      productName: addForm.value.productName.trim(),
      amount: addForm.value.amount,
      status: addForm.value.status,
    })
    showAddForm.value = false
  } catch (e: unknown) {
    addError.value = e instanceof Error ? e.message : '追加に失敗しました'
  } finally {
    isSaving.value = false
  }
}

// ─── 編集モーダル ──────────────────────────────────
const editTarget = ref<FurusatoEntry | null>(null)
const editForm = ref({ municipality: '', productName: '', amount: null as number | null, status: '未申請' as FurusatoStatus })
const editError = ref('')

function openEdit(entry: FurusatoEntry) {
  editTarget.value = entry
  editForm.value = { municipality: entry.municipality, productName: entry.productName, amount: entry.amount, status: entry.status }
  editError.value = ''
}

function closeEdit() {
  editTarget.value = null
}

async function submitEdit() {
  editError.value = ''
  if (!editForm.value.municipality.trim()) { editError.value = '自治体名を入力してください'; return }
  if (!editForm.value.amount || editForm.value.amount <= 0) { editError.value = '金額を入力してください'; return }

  isSaving.value = true
  try {
    await furusatoStore.updateEntry(editTarget.value!.id, {
      municipality: editForm.value.municipality.trim(),
      productName: editForm.value.productName.trim(),
      amount: editForm.value.amount!,
      status: editForm.value.status,
    })
    editTarget.value = null
  } catch (e: unknown) {
    editError.value = e instanceof Error ? e.message : '更新に失敗しました'
  } finally {
    isSaving.value = false
  }
}

async function deleteEntry(id: number) {
  try {
    await furusatoStore.deleteEntry(id)
  } catch (e: unknown) {
    pageError.value = e instanceof Error ? e.message : '削除に失敗しました'
  }
}

onMounted(() => fetchYear(selectedYear.value))
</script>

<template>
  <div class="furusato-view">
    <p v-if="pageError" class="page-error">{{ pageError }}</p>
    <p v-if="isLoading" class="loading-msg">読み込み中...</p>

    <!-- ページヘッダー -->
    <div class="page-header">
      <div class="page-title-row">
        <h1 class="title">ふるさと納税管理</h1>
        <button class="help-btn" @click="showHelp = true" title="申請方法ヘルプ">？</button>
      </div>
      <div class="year-selector">
        <label for="year-select">年度:</label>
        <select id="year-select" v-model="selectedYear" class="year-select">
          <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}年</option>
        </select>
      </div>
    </div>

    <!-- 上限・残り確認カード -->
    <div class="limit-card">
      <h2 class="card-title">寄付上限の確認</h2>

      <div class="income-row">
        <label class="field-label">年収（概算）</label>
        <div class="income-input-group">
          <input
            type="number"
            v-model.number="annualIncome"
            class="income-input"
            placeholder="500"
            min="1"
            max="10000"
            step="1"
            @input="onIncomeInput"
            @change="onIncomeChange"
          />
          <span class="unit">万円</span>
          <button class="calc-btn" @click="applyCalc">計算する</button>
        </div>
        <p v-if="incomeError" class="income-error">{{ incomeError }}</p>
        <p class="calc-note">※1〜10,000万円（整数）で入力してください。独身・扶養家族なしの場合の目安です（簡易計算）</p>
      </div>

      <div class="limit-row">
        <label class="field-label">ふるさと納税の上限額（自己負担2,000円含む）</label>
        <div class="limit-input-group">
          <span class="currency">¥</span>
          <input
            type="number"
            v-model.number="limitAmount"
            class="limit-input"
            placeholder="手動でも入力できます"
            min="1"
            :max="LIMIT_MAX"
            step="1"
            @input="onLimitInput"
            @change="onLimitChange"
          />
        </div>
      </div>

      <div class="gauge-section" v-if="limitAmount">
        <div class="gauge-bar-wrap">
          <div
            class="gauge-bar"
            :class="remaining !== null && remaining < 0 ? 'over' : 'ok'"
            :style="{ width: Math.min(100, (totalAmount / limitAmount) * 100) + '%' }"
          ></div>
        </div>
        <div class="gauge-labels">
          <span>¥0</span>
          <span>¥{{ limitAmount!.toLocaleString('ja-JP') }}</span>
        </div>
      </div>

      <div class="summary-row-group">
        <div class="summary-row">
          <span class="summary-label">今年の納税合計</span>
          <span class="summary-value">¥{{ totalAmount.toLocaleString('ja-JP') }}</span>
        </div>
        <div v-if="remaining !== null" class="summary-row remaining-row" :class="remaining >= 0 ? 'positive' : 'negative'">
          <span class="summary-label">{{ remaining >= 0 ? '残り寄付可能額' : '上限超過' }}</span>
          <span class="summary-value">
            {{ remaining >= 0 ? '' : '-' }}¥{{ Math.abs(remaining).toLocaleString('ja-JP') }}
          </span>
        </div>
      </div>
    </div>

    <!-- 納税一覧カード -->
    <div class="main-card">
      <div class="card-header">
        <h2 class="card-title">{{ selectedYear }}年の納税一覧</h2>
        <button class="add-btn" @click="openAdd">＋ 追加</button>
      </div>

      <!-- ワンストップ申請 自治体カウンター -->
      <div v-if="entries.length > 0" class="onestop-counter" :class="uniqueMunicipalityCount > 5 ? 'over' : uniqueMunicipalityCount === 5 ? 'limit' : 'ok'">
        <span class="onestop-label">ワンストップ申請 自治体数</span>
        <span class="onestop-count">{{ uniqueMunicipalityCount }} <span class="onestop-max">/ 5</span></span>
        <span v-if="uniqueMunicipalityCount > 5" class="onestop-warn">5自治体を超えています。確定申告が必要です。</span>
        <span v-else-if="uniqueMunicipalityCount === 5" class="onestop-warn warn-limit">上限に達しています。</span>
      </div>

      <!-- 追加フォーム -->
      <div v-if="showAddForm" class="entry-form">
        <div class="form-grid">
          <div class="form-field">
            <label class="form-label">自治体名 <span class="required">*</span></label>
            <input v-model="addForm.municipality" type="text" class="form-input" placeholder="北海道○○市" :maxlength="MUNICIPALITY_MAX" @input="clampMunicipality('add', $event)" @compositionend="clampMunicipality('add', $event)" />
          </div>
          <div class="form-field">
            <label class="form-label">商品名</label>
            <input v-model="addForm.productName" type="text" class="form-input" placeholder="いくらセット 500g" :maxlength="PRODUCT_MAX" @input="clampProduct('add', $event)" @compositionend="clampProduct('add', $event)" />
          </div>
          <div class="form-field">
            <label class="form-label">金額（円）<span class="required">*</span></label>
            <div class="amount-wrap">
              <span class="currency">¥</span>
              <input v-model.number="addForm.amount" type="number" class="form-input" placeholder="10000" min="1" :max="AMOUNT_MAX" step="1" @input="onAmountInput('add', $event)" />
            </div>
          </div>
          <div class="form-field">
            <label class="form-label">申請状況</label>
            <select v-model="addForm.status" class="form-select">
              <option v-for="s in STATUS_OPTIONS" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
        </div>
        <p v-if="addError" class="form-error">{{ addError }}</p>
        <div class="form-actions">
          <button class="btn-cancel" @click="cancelAdd">キャンセル</button>
          <button class="btn-save" @click="submitAdd">追加する</button>
        </div>
      </div>

      <!-- 空メッセージ -->
      <div v-if="entries.length === 0 && !showAddForm" class="empty-message">
        {{ selectedYear }}年の納税記録はありません。「＋ 追加」から登録してください。
      </div>

      <!-- 一覧 -->
      <ul class="entry-list">
        <li v-for="entry in entries" :key="entry.id" class="entry-item">
          <div class="entry-main">
            <div class="entry-meta">
              <span class="entry-municipality">{{ entry.municipality }}</span>
              <span v-if="entry.productName" class="entry-product">{{ entry.productName }}</span>
            </div>
            <div class="entry-right">
              <span class="entry-amount">¥{{ entry.amount.toLocaleString('ja-JP') }}</span>
              <span class="status-badge" :class="STATUS_STYLE[entry.status]">{{ entry.status }}</span>
              <button class="icon-btn edit-btn" @click="openEdit(entry)" title="編集">✎</button>
              <button class="icon-btn del-btn" @click="deleteEntry(entry.id)" title="削除">✕</button>
            </div>
          </div>
        </li>
      </ul>

      <div v-if="entries.length > 0" class="total-row">
        <span class="total-label">合計</span>
        <span class="total-amount">¥{{ totalAmount.toLocaleString('ja-JP') }}</span>
      </div>
    </div>

    <!-- 申請方法ヘルプモーダル -->
    <Teleport to="body">
      <div v-if="showHelp" class="modal-overlay" @click.self="showHelp = false">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">ふるさと納税の申請方法</h2>
            <button class="modal-close" @click="showHelp = false">✕</button>
          </div>
          <div class="modal-body help-body">
            <section class="help-section">
              <div class="help-section-title onestop-color">ワンストップ特例申請</div>
              <ul class="help-list">
                <li>確定申告が不要な給与所得者が対象</li>
                <li><strong>寄付先が5自治体以内</strong>の場合のみ利用可能</li>
                <li>各自治体に申請書を<strong>翌年1月10日必着</strong>で郵送</li>
                <li>自治体によってはオンライン申請（マイナポータル）も可能</li>
                <li>6自治体以上に寄付した場合は確定申告が必要</li>
              </ul>
            </section>
            <section class="help-section">
              <div class="help-section-title taxreturn-color">確定申告</div>
              <ul class="help-list">
                <li>個人事業主・フリーランスは確定申告が必要</li>
                <li>寄付先が6自治体以上の場合も確定申告で手続き</li>
                <li>医療費控除など他の控除と合わせて申告できる</li>
                <li>翌年2月16日〜3月15日に申告（e-Taxも可能）</li>
                <li>寄付金受領証明書を保管しておくこと</li>
              </ul>
            </section>
            <section class="help-section">
              <div class="help-section-title">注意事項</div>
              <ul class="help-list">
                <li>自己負担額は<strong>2,000円</strong>（控除上限内であれば）</li>
                <li>上限額は年収・家族構成・控除状況によって異なります</li>
                <li>年収入力の計算はあくまで目安です。正確な上限はシミュレーターでご確認ください</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 編集モーダル -->
    <Teleport to="body">
      <div v-if="editTarget" class="modal-overlay" @click.self="closeEdit">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">納税情報を編集</h2>
            <button class="modal-close" @click="closeEdit">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-field">
                <label class="form-label">自治体名 <span class="required">*</span></label>
                <input v-model="editForm.municipality" type="text" class="form-input" placeholder="北海道○○市" :maxlength="MUNICIPALITY_MAX" @input="clampMunicipality('edit', $event)" @compositionend="clampMunicipality('edit', $event)" />
              </div>
              <div class="form-field">
                <label class="form-label">商品名</label>
                <input v-model="editForm.productName" type="text" class="form-input" placeholder="いくらセット 500g" :maxlength="PRODUCT_MAX" @input="clampProduct('edit', $event)" @compositionend="clampProduct('edit', $event)" />
              </div>
              <div class="form-field">
                <label class="form-label">金額（円）<span class="required">*</span></label>
                <div class="amount-wrap">
                  <span class="currency">¥</span>
                  <input v-model.number="editForm.amount" type="number" class="form-input" placeholder="10000" min="1" :max="AMOUNT_MAX" step="1" @input="onAmountInput('edit', $event)" />
                </div>
              </div>
              <div class="form-field">
                <label class="form-label">申請状況</label>
                <select v-model="editForm.status" class="form-select">
                  <option v-for="s in STATUS_OPTIONS" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>
            </div>
            <p v-if="editError" class="form-error">{{ editError }}</p>
            <div class="form-actions">
              <button class="btn-cancel" @click="closeEdit">キャンセル</button>
              <button class="btn-save" @click="submitEdit">保存する</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.furusato-view {
  width: 100%;
  max-width: 660px;
  margin: 0 auto;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-error {
  font-size: 13px;
  color: #ef4444;
  background: #fff5f5;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  padding: 10px 14px;
  margin: 0;
}

.loading-msg {
  font-size: 13px;
  color: #aaa;
  text-align: center;
  padding: 12px 0;
  margin: 0;
}

/* ページヘッダー */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.page-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title {
  font-size: 22px;
  font-weight: bold;
  color: #2c3e50;
  margin: 0;
}

.help-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1.5px solid #4169b0;
  background: #fff;
  color: #4169b0;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s, color 0.2s;
}

.help-btn:hover {
  background: #4169b0;
  color: #fff;
}

.year-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #555;
}

.year-select {
  padding: 7px 10px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
}

.year-select:focus { border-color: #4169b0; outline: none; }

/* 上限カード */
.limit-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  display: block;
  margin-bottom: 6px;
}

.income-row { display: flex; flex-direction: column; }

.income-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.income-input {
  width: 100px;
  padding: 8px 10px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 6px;
  text-align: right;
}

.income-input:focus { border-color: #4169b0; outline: none; }

.unit { font-size: 14px; color: #555; }

.calc-btn {
  padding: 8px 14px;
  font-size: 13px;
  background: #4169b0;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.calc-btn:hover { background: #325090; }

.income-error {
  font-size: 12px;
  color: #ef4444;
  margin: 4px 0 0;
}

.calc-note {
  font-size: 11px;
  color: #aaa;
  margin: 4px 0 0;
}

.limit-row { display: flex; flex-direction: column; }

.limit-input-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.currency { font-size: 14px; color: #888; }

.limit-input {
  flex: 1;
  max-width: 220px;
  padding: 8px 10px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 6px;
  text-align: right;
}

.limit-input:focus { border-color: #4169b0; outline: none; }

/* ゲージ */
.gauge-section { display: flex; flex-direction: column; gap: 4px; }

.gauge-bar-wrap {
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.gauge-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}

.gauge-bar.ok { background: linear-gradient(90deg, #4169b0, #59a14f); }
.gauge-bar.over { background: #ef4444; }

.gauge-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #aaa;
}

/* サマリー行 */
.summary-row-group {
  border-top: 1px solid #f0f0f0;
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-label { font-size: 13px; color: #666; }

.summary-value { font-size: 15px; font-weight: 600; color: #2c3e50; }

.remaining-row.positive .summary-value { color: #59a14f; }
.remaining-row.negative .summary-value { color: #ef4444; }

/* メインカード */
.main-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.add-btn {
  padding: 7px 16px;
  font-size: 13px;
  background: #4169b0;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.add-btn:hover { background: #325090; }

/* フォーム共通 */
.entry-form {
  background: #f8f9fc;
  border: 1px solid #e0e4ea;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 520px) {
  .form-grid { grid-template-columns: 1fr; }
}

.form-field { display: flex; flex-direction: column; gap: 4px; }

.form-label { font-size: 12px; font-weight: 600; color: #666; }

.required { color: #ef4444; margin-left: 2px; }

.form-input {
  padding: 8px 10px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 6px;
  width: 100%;
  box-sizing: border-box;
}

.form-input:focus { border-color: #4169b0; outline: none; }

.amount-wrap { display: flex; align-items: center; gap: 4px; }
.amount-wrap .form-input { text-align: right; }

.form-select {
  padding: 8px 10px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  width: 100%;
  box-sizing: border-box;
}

.form-select:focus { border-color: #4169b0; outline: none; }

.form-error { font-size: 12px; color: #ef4444; margin: 8px 0 0; }

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}

.btn-cancel {
  padding: 8px 16px;
  font-size: 13px;
  background: none;
  border: 1px solid #ccc;
  border-radius: 6px;
  color: #666;
  cursor: pointer;
}

.btn-cancel:hover { background: #f0f0f0; }

.btn-save {
  padding: 8px 18px;
  font-size: 13px;
  background: #4169b0;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-save:hover { background: #325090; }

/* エントリー一覧 */
.entry-list { list-style: none; padding: 0; margin: 0; }

.entry-item {
  border-bottom: 1px solid #f0f0f0;
  padding: 12px 4px;
}

.entry-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.entry-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.entry-municipality { font-size: 14px; font-weight: 600; color: #2c3e50; }

.entry-product { font-size: 12px; color: #888; }

.entry-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.entry-amount { font-size: 15px; font-weight: 600; color: #2c3e50; }

/* ステータスバッジ */
.status-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.status-pending { background: #f0f0f0; color: #888; }
.status-onestop { background: #dbeafe; color: #1d4ed8; }
.status-tax-plan { background: #fef3c7; color: #b45309; }
.status-done { background: #dcfce7; color: #15803d; }

/* アイコンボタン */
.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 14px;
  transition: background 0.2s, color 0.2s;
}

.edit-btn { color: #4169b0; }
.edit-btn:hover { background: #eef2fb; }

.del-btn { color: #bbb; }
.del-btn:hover { color: #ef4444; background: #fff0f0; }

/* 合計行 */
.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 4px 2px;
}

.total-label { font-size: 14px; font-weight: 600; color: #2c3e50; }
.total-amount { font-size: 17px; font-weight: bold; color: #2c3e50; }

.empty-message { font-size: 13px; color: #aaa; padding: 24px 0; text-align: center; }

/* ワンストップカウンター */
.onestop-counter {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 13px;
}

.onestop-counter.ok { background: #f0f7ff; border: 1px solid #bfd6f6; }
.onestop-counter.limit { background: #fffbeb; border: 1px solid #fcd34d; }
.onestop-counter.over { background: #fff5f5; border: 1px solid #fca5a5; }

.onestop-label { color: #555; }

.onestop-count {
  font-size: 16px;
  font-weight: bold;
  color: #2c3e50;
}

.onestop-max { font-size: 13px; font-weight: normal; color: #aaa; }

.onestop-counter.ok .onestop-count { color: #4169b0; }
.onestop-counter.limit .onestop-count { color: #b45309; }
.onestop-counter.over .onestop-count { color: #ef4444; }

.onestop-warn {
  font-size: 12px;
  color: #ef4444;
  font-weight: 500;
}

.onestop-warn.warn-limit { color: #b45309; }

/* ヘルプモーダル本文 */
.help-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.help-section { display: flex; flex-direction: column; gap: 8px; }

.help-section-title {
  font-size: 14px;
  font-weight: 700;
  color: #2c3e50;
  padding-left: 10px;
  border-left: 3px solid #ccc;
}

.help-section-title.onestop-color { border-color: #1d4ed8; color: #1d4ed8; }
.help-section-title.taxreturn-color { border-color: #b45309; color: #b45309; }

.help-list {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #555;
  line-height: 1.9;
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
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 0;
}

.modal-title { font-size: 16px; font-weight: 700; color: #2c3e50; margin: 0; }

.modal-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #aaa;
  cursor: pointer;
  padding: 4px;
}

.modal-close:hover { color: #333; }

.modal-body { padding: 16px 24px 24px; }
</style>
