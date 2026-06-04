<template>
  <div class="expenses-summary">
    <div class="summary-header">
      <label for="period-select">期間:</label>
      <select id="period-select" v-model="selectedPeriod" @change="onPeriodChange" class="dropdown">
        <option :value="3">直近3か月</option>
        <option :value="6">直近6か月</option>
        <option :value="12">直近1年</option>
        <option :value="36">直近3年</option>
        <option :value="60">直近5年</option>
      </select>
    </div>

    <div class="summary-card">
      <h2 class="card-title">残高推移</h2>

      <div v-if="!isLoading && !errorMessage && summary.months.length > 0" class="toolbar">
        <div class="tab-group-wrapper">
          <div class="tab-group">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              :class="['tab-btn', { active: selectedTab === tab.id }]"
              :title="tab.label"
              @click="onTabChange(tab.id)"
            >{{ tab.label }}</button>
          </div>
        </div>

        <div class="balance-row">
          <div class="balance-mini-card">
            <div class="mini-card-label">
              <span>現在の合計残高</span>
              <svg class="wallet-icon" xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M240-160q-66 0-113-47T80-320v-320q0-66 47-113t113-47h480q66 0 113 47t47 113v320q0 66-47 113t-113 47H240Zm0-480h480q22 0 42 5t38 16v-21q0-33-23.5-56.5T720-720H240q-33 0-56.5 23.5T160-640v21q18-11 38-16t42-5Zm-74 130 445 108q9 2 18 0t17-8l139-116q-11-15-28-24.5t-37-9.5H240q-26 0-45.5 13.5T166-510Z"/></svg>
            </div>
            <div class="mini-card-amount">
              ¥ {{ currentMonthTotal !== null ? currentMonthTotal.toLocaleString('ja-JP') : '-' }}
            </div>
            <div
              v-if="monthDiff !== null"
              class="mini-card-diff"
              :class="monthDiff >= 0 ? 'positive' : 'negative'"
            >
              {{ monthDiff >= 0 ? '↗' : '↘' }}
              {{ monthDiff >= 0 ? '+' : '' }}{{ monthDiff.toLocaleString('ja-JP') }}
              <span class="diff-label">（前月比）</span>
            </div>
          </div>

          <div v-if="typePieData.length > 0" class="type-pie-card">
            <div class="pie-wrap">
              <canvas ref="pieChartCanvas" :key="'pie-' + canvasKey"></canvas>
            </div>
            <div class="pie-legend">
              <div v-for="item in typePieData" :key="item.typeId" class="pie-legend-item">
                <span class="pie-dot" :style="{ background: item.color }"></span>
                <span class="pie-label" :title="item.typeName">{{ item.typeName }}</span>
                <span class="pie-percent">{{ item.percent.toFixed(1) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="isLoading" class="loading">
        <span class="loading-spinner"></span>
        読み込み中...
      </div>

      <div v-else-if="errorMessage" class="error-message">{{ errorMessage }}</div>

      <div v-else-if="summary.months.length === 0" class="empty-message">
        データがありません。残高入力画面からデータを登録してください。
      </div>

      <div v-else class="chart-area">
        <div class="chart-scroll-wrapper">
          <div :style="{ minWidth: chartMinWidth + 'px', height: '100%' }">
            <canvas ref="chartCanvas" :key="canvasKey"></canvas>
          </div>
        </div>
        <div class="axis-wrapper">
          <span class="axis-unit">（{{ currentUnit }}）</span>
          <div class="axis-ticks">
            <span
              v-for="tick in axisTicks"
              :key="tick.value"
              class="axis-tick"
              :style="{ top: tick.y + 'px' }"
            >{{ tick.label }}</span>
          </div>
        </div>
      </div>

      <!-- 固定凡例（スクロール外） -->
      <div v-if="legendItems.length > 0 && !isLoading && !errorMessage" class="chart-legend">
        <span
          v-for="item in legendItems"
          :key="item.label"
          class="legend-item"
        >
          <span class="legend-dot" :style="{ background: item.color }"></span>
          <span class="legend-label" :title="item.label">{{ item.label }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useExpensesSummary } from './ExpensesSummary'

export default defineComponent({
  setup() {
    return useExpensesSummary()
  },
})
</script>

<style lang="scss" scoped src="./ExpensesSummary.scss"></style>
