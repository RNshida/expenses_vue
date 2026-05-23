<template>
  <div class="analysis-view">
    <!-- 期間選択 -->
    <div class="period-card">
      <div class="period-row">
        <!-- 開始年月 -->
        <div class="period-group">
          <span class="period-group-label">開始年月</span>
          <div class="period-selects">
            <select v-model="startYear" class="year-select">
              <option v-for="y in availableYears" :key="y" :value="y">{{ y }}年</option>
            </select>
            <select v-model="startMonth" class="month-select">
              <option v-for="m in availableStartMonths" :key="m" :value="m">{{ m }}月</option>
            </select>
          </div>
        </div>

        <span class="period-sep">〜</span>

        <!-- 終了年月 -->
        <div class="period-group">
          <span class="period-group-label">終了年月</span>
          <div class="period-selects">
            <select v-model="endYear" class="year-select">
              <option v-for="y in availableYears" :key="y" :value="y">{{ y }}年</option>
            </select>
            <select v-model="endMonth" class="month-select">
              <option v-for="m in availableEndMonths" :key="m" :value="m">{{ m }}月</option>
            </select>
          </div>
        </div>

        <button class="analyze-btn" :disabled="isLoading || !isRangeValid" @click="analyze">
          <span v-if="isLoading" class="spinner"></span>
          <span v-else>分析</span>
        </button>
      </div>
      <p class="period-hint">※ 開始年月末残高と終了年月末残高の差を集計します（未入力月は直前の最新残高を使用）</p>
    </div>

    <!-- バリデーションエラー -->
    <div v-if="!isRangeValid" class="warn-message">開始年月は終了年月以前にしてください。</div>

    <!-- エラー -->
    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

    <!-- 結果 -->
    <template v-if="result">
      <!-- 合計サマリー -->
      <div class="result-section">
        <h2 class="section-title">合計増減</h2>
        <div class="total-card" :class="result.totalChange >= 0 ? 'positive' : 'negative'">
          <div class="total-label">
            {{ result.displayStartYearMonth }} 〜 {{ result.endYearMonth }}
          </div>
          <div class="total-amount">
            {{ result.totalChange >= 0 ? '+' : '' }}{{ result.totalChange.toLocaleString('ja-JP') }} 円
          </div>
          <div class="total-detail">
            開始時: ¥{{ result.totalStart.toLocaleString('ja-JP') }}
            &nbsp;→&nbsp;
            終了時: ¥{{ result.totalEnd.toLocaleString('ja-JP') }}
          </div>
        </div>
      </div>

      <!-- 種別ごとの増減 -->
      <div class="result-section">
        <h2 class="section-title">種別ごとの増減</h2>
        <div v-if="result.types.length === 0" class="empty-hint">
          対象期間にデータがありません。
        </div>
        <div v-else class="type-grid">
          <div
            v-for="t in result.types"
            :key="t.typeId ?? -1"
            class="type-card"
            :class="t.change >= 0 ? 'positive' : 'negative'"
          >
            <div class="type-name">{{ t.typeName }}</div>
            <div class="type-change">
              {{ t.change >= 0 ? '+' : '' }}{{ t.change.toLocaleString('ja-JP') }} 円
            </div>
            <div class="type-detail">
              ¥{{ t.startAmount.toLocaleString('ja-JP') }}
              &nbsp;→&nbsp;
              ¥{{ t.endAmount.toLocaleString('ja-JP') }}
            </div>
          </div>
        </div>
      </div>

      <!-- 棒グラフ -->
      <div v-if="result.types.length > 0" class="result-section">
        <h2 class="section-title">種別ごとの残高推移</h2>
        <div class="chart-card">
          <div class="chart-wrapper">
            <canvas ref="barChartCanvas" :key="chartKey"></canvas>
          </div>
        </div>
      </div>
    </template>

    <!-- 初期メッセージ -->
    <div v-else-if="!isLoading && !errorMessage" class="empty-hint">
      期間を選択して「分析」ボタンを押してください。
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'
import { storeToRefs } from 'pinia'
import { useBalanceStore } from '@/stores/balanceStore'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const balanceStore = useBalanceStore()
const { summary } = storeToRefs(balanceStore)

// ===== 現在日時 =====
const nowDate = new Date()
const todayYear = nowDate.getFullYear()
const todayMonth = nowDate.getMonth() + 1 // 1-12

// ===== 年月プルダウン選択 =====
const startYear = ref(todayYear - 1)
const startMonth = ref(todayMonth)
const endYear = ref(todayYear)
const endMonth = ref(todayMonth)

// 選択可能な年（直近10年）
const availableYears = computed(() => {
  const years: number[] = []
  for (let y = todayYear - 10; y <= todayYear; y++) years.push(y)
  return years
})

// 開始月：選択年が現在年なら現在月以前のみ
const availableStartMonths = computed(() => {
  const maxM = startYear.value === todayYear ? todayMonth : 12
  return Array.from({ length: maxM }, (_, i) => i + 1)
})

// 終了月：選択年が現在年なら現在月以前のみ
const availableEndMonths = computed(() => {
  const maxM = endYear.value === todayYear ? todayMonth : 12
  return Array.from({ length: maxM }, (_, i) => i + 1)
})

// YYYY-MM 文字列
const startYearMonth = computed(
  () => `${startYear.value}-${String(startMonth.value).padStart(2, '0')}`,
)
const endYearMonth = computed(
  () => `${endYear.value}-${String(endMonth.value).padStart(2, '0')}`,
)

const isRangeValid = computed(() => startYearMonth.value <= endYearMonth.value)

// 年が変わったとき、選択中の月が上限を超えていればクランプする
watch(startYear, newY => {
  const maxM = newY === todayYear ? todayMonth : 12
  if (startMonth.value > maxM) startMonth.value = maxM
})
watch(endYear, newY => {
  const maxM = newY === todayYear ? todayMonth : 12
  if (endMonth.value > maxM) endMonth.value = maxM
})

// ===== 分析ロジック =====
const isLoading = ref(false)
const errorMessage = ref('')
const chartKey = ref(0)
const barChartCanvas = ref<HTMLCanvasElement | null>(null)
let barChart: Chart | null = null

interface TypeAnalysis {
  typeId: number | null
  typeName: string
  startAmount: number
  endAmount: number
  change: number
}

interface AnalysisResult {
  displayStartYearMonth: string
  endYearMonth: string
  totalStart: number
  totalEnd: number
  totalChange: number
  types: TypeAnalysis[]
}

const result = ref<AnalysisResult | null>(null)

// null の場合は targetIdx 以前の最新入力値を返す（carry-forward）
function getLastKnownAmount(amounts: (number | null)[], targetIdx: number): number {
  if (targetIdx < 0) return 0
  for (let i = Math.min(targetIdx, amounts.length - 1); i >= 0; i--) {
    if (amounts[i] !== null) return amounts[i]!
  }
  return 0
}

async function analyze() {
  if (!isRangeValid.value) return

  isLoading.value = true
  errorMessage.value = ''
  result.value = null

  try {
    // opening月 = startYearMonth そのもの（carry-forwardで最新入力値を使用）
    // スパースなデータ（数ヶ月おき入力）に対応するため +12 のバッファを追加
    const openingMonth = startYearMonth.value
    const [oy, om] = openingMonth.split('-').map(Number)
    const monthsNeeded = (todayYear - oy) * 12 + (todayMonth - om) + 2
    const fetchMonths = Math.min(Math.max(monthsNeeded + 12, 13), 120)

    await Promise.all([
      balanceStore.fetchSummary(fetchMonths),
      balanceStore.fetchCategories(),
      balanceStore.fetchCategoryTypes(),
    ])

    const months = summary.value.months
    const series = summary.value.series

    const openingIdx = months.indexOf(openingMonth)
    const closingIdx = months.indexOf(endYearMonth.value)

    if (closingIdx === -1) {
      errorMessage.value = `終了年月（${endYearMonth.value}）のデータが見つかりません。残高入力済みの期間を選択してください。`
      return
    }

    // 種別マップ初期化
    const typeMap = new Map<number | null, TypeAnalysis>()
    balanceStore.categoryTypes.forEach(ct => {
      typeMap.set(ct.id, {
        typeId: ct.id,
        typeName: ct.name,
        startAmount: 0,
        endAmount: 0,
        change: 0,
      })
    })
    typeMap.set(null, {
      typeId: null,
      typeName: '未分類',
      startAmount: 0,
      endAmount: 0,
      change: 0,
    })

    // カテゴリごとに集計（categoryId=0 の合計エントリは除外）
    // null月は直前の最新入力値を使用（carry-forward）
    series
      .filter(s => s.categoryId !== 0)
      .forEach(s => {
        const cat = balanceStore.categories.find(c => c.id === s.categoryId)
        const typeId = cat?.categoryTypeId ?? null
        const entry = typeMap.get(typeId)
        if (!entry) return

        entry.startAmount += getLastKnownAmount(s.amounts, openingIdx)
        entry.endAmount += getLastKnownAmount(s.amounts, closingIdx)
      })

    // change 計算
    // - 設定済み種別（categoryTypes）は期間内データが0でも必ず表示
    // - 未分類は、種別未設定のカテゴリにデータがある場合のみ表示
    const types: TypeAnalysis[] = []
    const configuredTypeIds = new Set(balanceStore.categoryTypes.map(ct => ct.id))
    typeMap.forEach((t, key) => {
      t.change = t.endAmount - t.startAmount
      if (key === null) {
        if (t.startAmount !== 0 || t.endAmount !== 0) types.push(t)
      } else if (configuredTypeIds.has(key)) {
        types.push(t)
      }
    })

    // categoryTypes の表示順に並べ替え
    types.sort((a, b) => {
      if (a.typeId === null) return 1
      if (b.typeId === null) return -1
      return (
        balanceStore.categoryTypes.findIndex(ct => ct.id === a.typeId) -
        balanceStore.categoryTypes.findIndex(ct => ct.id === b.typeId)
      )
    })

    const totalStart = types.reduce((s, t) => s + t.startAmount, 0)
    const totalEnd = types.reduce((s, t) => s + t.endAmount, 0)

    result.value = {
      displayStartYearMonth: startYearMonth.value,
      endYearMonth: endYearMonth.value,
      totalStart,
      totalEnd,
      totalChange: totalEnd - totalStart,
      types,
    }

    // グラフ用：期間内の月インデックス列
    const periodStartMIdx = openingIdx >= 0 ? openingIdx : 0
    const periodMonths = months.slice(periodStartMIdx, closingIdx + 1)
    const periodMonthIndices = periodMonths.map((_, i) => periodStartMIdx + i)

    chartKey.value++
    await nextTick()
    renderChart(periodMonths, periodMonthIndices, types, series)
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : '分析中にエラーが発生しました。'
  } finally {
    isLoading.value = false
  }
}

const TYPE_COLORS = [
  '#4169b0', '#59a14f', '#e15759', '#f28e2b',
  '#76b7b2', '#edc948', '#b07aa1', '#ff9da7',
]

function renderChart(
  periodMonths: string[],
  periodMonthIndices: number[],
  types: TypeAnalysis[],
  allSeries: { categoryId: number; amounts: (number | null)[] }[],
) {
  if (!barChartCanvas.value) return
  if (barChart) {
    barChart.destroy()
    barChart = null
  }

  const datasets = types.map((t, i) => {
    const data = periodMonthIndices.map(monthIdx => {
      let total = 0
      allSeries.filter(s => s.categoryId !== 0).forEach(s => {
        const cat = balanceStore.categories.find(c => c.id === s.categoryId)
        const typeId = cat?.categoryTypeId ?? null
        const matches = t.typeId === null ? typeId === null : typeId === t.typeId
        if (matches) total += getLastKnownAmount(s.amounts, monthIdx)
      })
      return total
    })
    return {
      label: t.typeName,
      data,
      backgroundColor: TYPE_COLORS[i % TYPE_COLORS.length],
      stack: 'stack',
      borderRadius: 2,
    }
  })

  barChart = new Chart(barChartCanvas.value, {
    type: 'bar',
    data: { labels: periodMonths, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'bottom' as const },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ¥${Math.round(ctx.parsed.y ?? 0).toLocaleString('ja-JP')}`,
            footer: items => {
              if (items.length <= 1) return ''
              const total = items.reduce((s, item) => s + (item.parsed.y ?? 0), 0)
              return `合計: ¥${Math.round(total).toLocaleString('ja-JP')}`
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { font: { size: 12 } },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            callback: (value: number | string) => {
              const n = Number(value)
              if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}億`
              if (Math.abs(n) >= 10_000) return `${(n / 10_000).toFixed(0)}万`
              return n.toLocaleString('ja-JP')
            },
          },
        },
      },
    },
  })
}
</script>

<style lang="scss" scoped src="./AnalysisView.scss"></style>
