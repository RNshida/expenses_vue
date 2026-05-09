import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import {
  Chart,
  BarController,
  BarElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  PieController,
  ArcElement,
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

Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip, Legend, PieController, ArcElement)

const FALLBACK_COLORS = [
  '#1e3a6e', '#4169b0', '#8fa8d8', '#6b5fa5',
  '#a08fd8', '#3b82c4', '#5b9bd5', '#2d6a9f',
]

const PIE_COLORS = [
  '#4169b0', '#59a14f', '#e15759', '#f28e2b',
  '#76b7b2', '#edc948', '#b07aa1', '#ff9da7',
]

function computeUnit(maxVal: number): { label: string; divisor: number } {
  if (maxVal < 100_000) return { label: '円', divisor: 1 }
  if (maxVal < 100_000_000) return { label: '万円', divisor: 10_000 }
  if (maxVal < 1_000_000_000_000) return { label: '億円', divisor: 100_000_000 }
  return { label: '兆円', divisor: 1_000_000_000_000 }
}

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
  const pieChartInstance = ref<Chart | null>(null)
  const pieChartCanvas = ref<HTMLCanvasElement | null>(null)
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

  const totalSeries = computed(() =>
    summary.value.series.find((s) => s.categoryId === 0),
  )

  const effectiveLatestIndex = computed(() => {
    const amounts = totalSeries.value?.amounts ?? []
    for (let i = amounts.length - 1; i >= 0; i--) {
      if (amounts[i] !== null && (amounts[i] as number) !== 0) return i
    }
    return -1
  })

  const currentMonthTotal = computed(() => {
    const idx = effectiveLatestIndex.value
    if (idx === -1) return null
    return totalSeries.value!.amounts[idx] as number
  })

  const prevMonthTotal = computed(() => {
    const idx = effectiveLatestIndex.value
    if (idx === -1) return null
    const amounts = totalSeries.value?.amounts ?? []
    for (let i = idx - 1; i >= 0; i--) {
      if (amounts[i] !== null) return amounts[i] as number
    }
    return null
  })

  const monthDiff = computed(() => {
    if (currentMonthTotal.value === null || prevMonthTotal.value === null) return null
    return currentMonthTotal.value - prevMonthTotal.value
  })

  // 最新月の種別別残高（円グラフ用）
  const typePieData = computed(() => {
    const amounts = totalSeries.value?.amounts ?? []
    let latestIdx = -1
    for (let i = amounts.length - 1; i >= 0; i--) {
      if (amounts[i] !== null) { latestIdx = i; break }
    }
    if (latestIdx === -1) return []

    const typeMap = new Map<number, { typeName: string; amount: number; colorIndex: number }>()
    let colorIdx = 0
    for (const cat of store.categories) {
      if (cat.categoryTypeId === null || cat.categoryTypeName === null) continue
      const s = summary.value.series.find((ser) => ser.categoryId === cat.id)
      const amount = s ? ((s.amounts[latestIdx] as number) ?? 0) : 0
      if (!typeMap.has(cat.categoryTypeId)) {
        typeMap.set(cat.categoryTypeId, { typeName: cat.categoryTypeName, amount: 0, colorIndex: colorIdx++ })
      }
      typeMap.get(cat.categoryTypeId)!.amount += amount
    }

    return Array.from(typeMap.entries())
      .filter(([, v]) => v.amount > 0)
      .map(([typeId, v]) => ({
        typeId,
        typeName: v.typeName,
        amount: v.amount,
        color: PIE_COLORS[v.colorIndex % PIE_COLORS.length],
      }))
  })

  // 種別目標の達成状況を月インデックスで返す（期間ベース）
  const getTypeGoalStatus = (monthIndex: number): 'met' | 'unmet' | 'none' => {
    const monthLabel = summary.value.months[monthIndex]
    if (!monthLabel) return 'none'

    let anyApplicable = false
    for (const item of goalStore.typeGoalPeriods) {
      const period = item.periods.find(
        (p) =>
          (!p.startYearMonth || p.startYearMonth <= monthLabel) &&
          (!p.endYearMonth || monthLabel <= p.endYearMonth),
      )
      if (!period || period.targetAmount <= 0) continue

      const typeCategories = store.categories.filter((c) => c.categoryTypeId === item.categoryTypeId)
      const typeHasDataInPeriod = typeCategories.some((c) =>
        summary.value.series.some((s) => s.categoryId === c.id),
      )
      if (!typeHasDataInPeriod) continue
      anyApplicable = true

      const typeSeries = summary.value.series.filter((s) =>
        typeCategories.some((c) => c.id === s.categoryId),
      )
      const currentTotal = typeSeries.reduce((sum, s) => {
        const a = s.amounts[monthIndex]
        return sum + (a !== null && a !== undefined ? (a as number) : 0)
      }, 0)
      const prevTotal = monthIndex > 0
        ? typeSeries.reduce((sum, s) => {
            const a = s.amounts[monthIndex - 1]
            return sum + (a !== null && a !== undefined ? (a as number) : 0)
          }, 0)
        : 0
      const diff = currentTotal - prevTotal
      if (diff < period.targetAmount) return 'unmet'
    }

    return anyApplicable ? 'met' : 'none'
  }

  const getMonthLabelColor = (monthLabel: string): string => {
    const monthIndex = summary.value.months.indexOf(monthLabel)
    if (monthIndex === -1) return '#888'
    const status = getTypeGoalStatus(monthIndex)
    if (status === 'met') return '#3b82f6'
    if (status === 'unmet') return '#ef4444'
    return '#888'
  }

  const chartMinWidth = computed(() =>
    Math.max(summary.value.months.length * 45, 260),
  )

  const getCategoryColor = (categoryId: number, fallbackIndex: number): string => {
    const cat = store.categories.find((c) => c.id === categoryId)
    return cat?.color || FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length]
  }

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

  const getPieTooltipEl = (): HTMLDivElement => {
    let el = document.getElementById('pie-tooltip') as HTMLDivElement | null
    if (!el) {
      el = document.createElement('div')
      el.id = 'pie-tooltip'
      el.style.cssText = [
        'position:fixed',
        'pointer-events:none',
        'background:rgba(0,0,0,0.75)',
        'color:#fff',
        'border-radius:6px',
        'padding:6px 10px',
        'font-size:13px',
        'white-space:nowrap',
        'z-index:9999',
        'transition:opacity 0.1s',
        'opacity:0',
      ].join(';')
      document.body.appendChild(el)
    }
    return el
  }

  const pieExternalTooltip = (context: { chart: Chart; tooltip: { opacity: number; caretX: number; caretY: number; body: { lines: string[] }[] } }) => {
    const { chart, tooltip } = context
    const el = getPieTooltipEl()
    if (tooltip.opacity === 0) {
      el.style.opacity = '0'
      return
    }
    const lines = tooltip.body?.flatMap((b) => b.lines) ?? []
    el.innerHTML = lines.map((l) => `<div>${l}</div>`).join('')

    const rect = chart.canvas.getBoundingClientRect()
    const x = rect.left + tooltip.caretX
    const y = rect.top + tooltip.caretY

    el.style.opacity = '1'
    el.style.left = `${x + 12}px`
    el.style.top = `${y - 12}px`

    const elRect = el.getBoundingClientRect()
    if (elRect.right > window.innerWidth) {
      el.style.left = `${x - elRect.width - 12}px`
    }
    if (elRect.bottom > window.innerHeight) {
      el.style.top = `${y - elRect.height + 12}px`
    }
  }

  const renderPieChart = () => {
    pieChartInstance.value?.destroy()
    pieChartInstance.value = null
    const canvas = pieChartCanvas.value
    if (!canvas) return
    const data = typePieData.value
    if (data.length === 0) return

    pieChartInstance.value = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: data.map((d) => d.typeName),
        datasets: [{
          data: data.map((d) => d.amount),
          backgroundColor: data.map((d) => d.color),
          borderWidth: 2,
          borderColor: '#fff',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false,
            external: pieExternalTooltip as never,
          },
        },
      },
    })
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
              footer: (items) => {
                if (items.length <= 1) return ''
                const total = items.reduce(
                  (sum, item) => sum + Math.round((item.parsed.y ?? 0) * divisor),
                  0,
                )
                return `合計: ¥${total.toLocaleString('ja-JP')}`
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
            display: false,
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
    renderPieChart()
  }

  const loadData = async () => {
    isLoading.value = true
    errorMessage.value = null
    selectedTab.value = 0
    try {
      await Promise.all([
        store.fetchSummary(selectedPeriod.value),
        store.fetchCategories(),
        goalStore.fetchTypeGoalPeriods(),
      ])
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : 'データの取得に失敗しました'
    } finally {
      isLoading.value = false
    }
    if (!errorMessage.value) {
      await nextTick()
      renderChart()
      renderPieChart()
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
    pieChartInstance.value?.destroy()
    document.getElementById('pie-tooltip')?.remove()
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
    pieChartCanvas,
    canvasKey,
    chartMinWidth,
    currentMonthTotal,
    prevMonthTotal,
    monthDiff,
    typePieData,
    onPeriodChange,
    onTabChange,
  }
}
