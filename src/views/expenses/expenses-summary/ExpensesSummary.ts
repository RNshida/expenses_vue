import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import {
  Chart,
  BarController,
  BarElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  type Scale,
} from 'chart.js'
import { storeToRefs } from 'pinia'
import { useBalanceStore } from '@/stores/balanceStore'
import { useGoalStore } from '@/stores/goalStore'

interface AnimCtx {
  chart: Chart & { scales: Record<string, Scale> }
  dataIndex: number
}

const getBaselinePixel = (ctx: AnimCtx): number =>
  ctx.chart.scales?.y?.getPixelForValue(0) ?? 0

const getAnimDelay = (ctx: AnimCtx): number => (ctx.dataIndex ?? 0) * 60

Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip, Legend)

const FALLBACK_COLORS = [
  '#1e3a6e', '#4169b0', '#8fa8d8', '#6b5fa5',
  '#a08fd8', '#3b82c4', '#5b9bd5', '#2d6a9f',
]

function computeUnit(maxVal: number): { label: string; divisor: number } {
  if (maxVal < 100_000) return { label: '円', divisor: 1 }
  if (maxVal < 100_000_000) return { label: '万円', divisor: 10_000 }
  if (maxVal < 1_000_000_000_000) return { label: '億円', divisor: 100_000_000 }
  return { label: '兆円', divisor: 1_000_000_000_000 }
}

// y軸が非表示でもグリッド線をバーの背面に描画するプラグイン
const gridPlugin = {
  id: 'customGrid',
  beforeDatasetsDraw(chart: Chart) {
    const yScale = chart.scales['y']
    if (!yScale) return
    const { ctx, chartArea } = chart
    ctx.save()
    ctx.strokeStyle = '#f0f2f5'
    ctx.lineWidth = 1
    for (const tick of yScale.ticks) {
      const y = yScale.getPixelForValue(tick.value as number)
      ctx.beginPath()
      ctx.moveTo(chartArea.left, y)
      ctx.lineTo(chartArea.right, y)
      ctx.stroke()
    }
    ctx.restore()
  },
}

export function useExpensesSummary() {
  const store = useBalanceStore()
  const goalStore = useGoalStore()
  const { summary } = storeToRefs(store)

  const selectedPeriod = ref(12)
  const selectedTab = ref<number>(0)
  const chartInstance = ref<Chart | null>(null)
  const chartCanvas = ref<HTMLCanvasElement | null>(null)
  const canvasKey = ref(0)
  const currentUnit = ref('円')
  const axisTicks = ref<{ value: number; y: number; label: string }[]>([])
  const isLoading = ref(false)
  const errorMessage = ref<string | null>(null)

  const tabs = computed(() => {
    const categorySeries = summary.value.series.filter((s) => s.categoryId !== 0)
    return [
      { id: 0, label: '合計' },
      ...categorySeries.map((s) => ({ id: s.categoryId, label: s.categoryName })),
    ]
  })

  const legendItems = computed(() =>
    summary.value.series
      .filter((s) => s.categoryId !== 0)
      .map((s, index) => ({
        label: s.categoryName,
        color: getCategoryColor(s.categoryId, index),
      }))
  )

  // 残高カード用: 合計シリーズの最新月・前月
  const totalSeries = computed(() =>
    summary.value.series.find((s) => s.categoryId === 0),
  )

  const currentMonthTotal = computed(() => {
    const amounts = totalSeries.value?.amounts ?? []
    for (let i = amounts.length - 1; i >= 0; i--) {
      if (amounts[i] !== null) return amounts[i] as number
    }
    return null
  })

  const prevMonthTotal = computed(() => {
    const amounts = totalSeries.value?.amounts ?? []
    let found = false
    for (let i = amounts.length - 1; i >= 0; i--) {
      if (amounts[i] !== null) {
        if (found) return amounts[i] as number
        found = true
      }
    }
    return null
  })

  const monthDiff = computed(() => {
    if (currentMonthTotal.value === null || prevMonthTotal.value === null) return null
    return currentMonthTotal.value - prevMonthTotal.value
  })

  // 月ラベルの色: 目標が全達成→青, 未達あり→赤, 目標なし→デフォルト
  const getMonthLabelColor = (monthLabel: string): string => {
    const goals = goalStore.goals.filter(
      (g) => g.targetAmount !== null && g.targetAmount > 0,
    )
    if (goals.length === 0) return '#888'

    const monthIndex = summary.value.months.indexOf(monthLabel)
    if (monthIndex === -1) return '#888'

    let anyApplicable = false
    let allMet = true

    for (const goal of goals) {
      const s = summary.value.series.find((s) => s.categoryId === goal.categoryId)
      if (!s) continue
      const amount = s.amounts[monthIndex]
      if (amount === null) continue
      anyApplicable = true
      if ((amount as number) < (goal.targetAmount as number)) {
        allMet = false
        break
      }
    }

    if (!anyApplicable) return '#888'
    return allMet ? '#3b82f6' : '#ef4444'
  }

  // 横スクロール用: 月数に応じた最小幅（1月あたり45px）
  const chartMinWidth = computed(() =>
    Math.max(summary.value.months.length * 45, 260),
  )

  const getCategoryColor = (categoryId: number, fallbackIndex: number): string => {
    const cat = store.categories.find((c) => c.id === categoryId)
    return cat?.color || FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length]
  }

  // チャートのy軸tick情報をHTMLオーバーレイ用に更新するプラグイン
  const axisTickSyncPlugin = {
    id: 'axisTickSync',
    afterUpdate(chart: Chart) {
      const yScale = chart.scales['y']
      if (!yScale) return
      axisTicks.value = yScale.ticks
        .filter((t) => (t.value as number) >= yScale.min && (t.value as number) <= yScale.max)
        .map((t) => ({
          value: t.value as number,
          y: yScale.getPixelForValue(t.value as number),
          label: Math.round(t.value as number).toLocaleString('ja-JP'),
        }))
    },
  }

  const renderChart = () => {
    const canvas = chartCanvas.value
    if (!canvas) return

    chartInstance.value?.destroy()
    chartInstance.value = null
    axisTicks.value = []

    const { months, series } = summary.value
    if (months.length === 0) return

    const categorySeries = series.filter((s) => s.categoryId !== 0)
    const isStacked = selectedTab.value === 0

    // データの最大値を算出して単位を決定
    let dataMax = 0
    if (isStacked) {
      for (let i = 0; i < months.length; i++) {
        const sum = categorySeries.reduce((s, c) => s + ((c.amounts[i] as number) ?? 0), 0)
        if (sum > dataMax) dataMax = sum
      }
    } else {
      const item = series.find((s) => s.categoryId === selectedTab.value)
      if (item) dataMax = Math.max(...item.amounts.map((a) => (a as number) ?? 0))
    }

    const { label: unit, divisor } = computeUnit(dataMax)
    currentUnit.value = unit

    // データをスケーリング
    let datasets
    if (isStacked) {
      datasets = categorySeries.map((item, index) => ({
        label: item.categoryName,
        data: item.amounts.map((a) => (a !== null ? (a as number) / divisor : 0)),
        backgroundColor: getCategoryColor(item.categoryId, index),
        borderRadius: 2,
        borderSkipped: false,
        stack: 'stack',
      }))
    } else {
      const item = series.find((s) => s.categoryId === selectedTab.value)
      if (!item) return
      const colorIndex = categorySeries.findIndex((s) => s.categoryId === selectedTab.value)
      datasets = [{
        label: item.categoryName,
        data: item.amounts.map((a) => (a !== null ? (a as number) / divisor : 0)),
        backgroundColor: getCategoryColor(item.categoryId, colorIndex),
        borderRadius: 4,
        borderSkipped: false,
      }]
    }

    // メインチャート（y軸非表示、グリッド線とtick同期はプラグインで処理）
    chartInstance.value = new Chart(canvas, {
      type: 'bar',
      data: { labels: months, datasets },
      plugins: [gridPlugin, axisTickSyncPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 16 } },
        animations: {
          y: { from: getBaselinePixel, duration: 750, easing: 'easeOutQuart', delay: getAnimDelay },
          base: { from: getBaselinePixel, duration: 750, easing: 'easeOutQuart', delay: getAnimDelay },
        },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const original = Math.round((ctx.parsed.y ?? 0) * divisor)
                return `${ctx.dataset.label}: ¥${original.toLocaleString('ja-JP')}`
              },
            },
          },
        },
        scales: {
          x: {
            stacked: isStacked,
            grid: { display: false },
            ticks: {
              color: (ctx: { index: number }) =>
                getMonthLabelColor(summary.value.months[ctx.index] ?? ''),
              font: { size: 12 },
            },
            border: { display: false },
          },
          y: {
            display: false, // 非表示（スケール・tick計算は行われる）
            stacked: isStacked,
            beginAtZero: true,
            ticks: { count: 10 },
          },
        },
      },
    })
  }

  const onTabChange = async (tabId: number) => {
    selectedTab.value = tabId
    canvasKey.value++
    await nextTick()
    renderChart()
  }

  const loadData = async () => {
    isLoading.value = true
    errorMessage.value = null
    selectedTab.value = 0
    try {
      await Promise.all([
        store.fetchSummary(selectedPeriod.value),
        store.fetchCategories(),
        goalStore.fetchGoals(),
      ])
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : 'データの取得に失敗しました'
    } finally {
      isLoading.value = false
    }
    if (!errorMessage.value) {
      await nextTick()
      renderChart()
    }
  }

  const onPeriodChange = () => {
    loadData()
  }

  onMounted(() => {
    loadData()
  })

  onUnmounted(() => {
    chartInstance.value?.destroy()
  })

  return {
    selectedPeriod,
    selectedTab,
    tabs,
    legendItems,
    currentUnit,
    axisTicks,
    isLoading,
    errorMessage,
    summary,
    chartCanvas,
    canvasKey,
    chartMinWidth,
    currentMonthTotal,
    prevMonthTotal,
    monthDiff,
    onPeriodChange,
    onTabChange,
  }
}
