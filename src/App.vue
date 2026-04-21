<script setup lang="ts">
import { RouterLink, RouterView, useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { computed, ref } from 'vue'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const menuOpen = ref(false)

const isBalanceSection = computed(() =>
  ['/', '/input', '/goal'].includes(route.path),
)

const sectionTitle = computed(() => {
  if (route.path === '/furusato') return 'ふるさと納税管理'
  return '残高管理'
})

function logout() {
  authStore.logout()
  router.push('/login')
  menuOpen.value = false
}

function goTo(path: string) {
  router.push(path)
  menuOpen.value = false
}
</script>

<template>
  <div class="app-container">
    <header v-if="authStore.isAuthenticated" class="app-header">
      <div class="header-inner">
        <span class="app-title">{{ sectionTitle }}</span>

        <nav v-if="isBalanceSection" class="nav-tabs">
          <RouterLink to="/" class="nav-tab" active-class="nav-tab--active" exact>
            サマリー
          </RouterLink>
          <RouterLink to="/input" class="nav-tab" active-class="nav-tab--active">
            残高入力
          </RouterLink>
          <RouterLink to="/goal" class="nav-tab" active-class="nav-tab--active">
            目標設定
          </RouterLink>
        </nav>

        <button class="hamburger-btn" @click="menuOpen = true" aria-label="メニューを開く">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>

    <main class="main-content">
      <RouterView />
    </main>

    <!-- ハンバーガーメニュー -->
    <Teleport to="body">
      <Transition name="menu-fade">
        <div v-if="menuOpen" class="menu-overlay" @click.self="menuOpen = false">
          <Transition name="menu-slide">
            <div v-if="menuOpen" class="menu-panel">
              <div class="menu-top">
                <span class="menu-brand">カケログマップ</span>
                <button class="menu-close-btn" @click="menuOpen = false">✕</button>
              </div>

              <nav class="menu-nav">
                <button class="menu-item" :class="{ active: isBalanceSection }" @click="goTo('/')">
                  <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="20" height="20" fill="currentColor"><path d="M240-160q-66 0-113-47T80-320v-320q0-66 47-113t113-47h480q66 0 113 47t47 113v320q0 66-47 113t-113 47H240Zm0-480h480q22 0 42 5t38 16v-21q0-33-23.5-56.5T720-720H240q-33 0-56.5 23.5T160-640v21q18-11 38-16t42-5Zm-74 130 445 108q9 2 18 0t17-8l139-116q-11-15-28-24.5t-37-9.5H240q-26 0-45.5 13.5T166-510Z"/></svg>
                  残高管理
                </button>
                <button class="menu-item" :class="{ active: route.path === '/furusato' }" @click="goTo('/furusato')">
                  <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="20" height="20" fill="currentColor"><path d="M480-80 120-280v-400l360-200 360 200v400L480-80Zm0-82 280-156v-298L480-762 200-616v298l280 156Zm0-298Z"/></svg>
                  ふるさと納税管理
                </button>
                <button class="menu-item" :class="{ active: route.path === '/mypage' }" @click="goTo('/mypage')">
                  <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="20" height="20" fill="currentColor"><path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 128.5-46.5T480-440q66 0 132.5 15.5T741-378q29 15 46.5 43.5T805-272v112H160Z"/></svg>
                  マイページ
                </button>
              </nav>

              <div class="menu-footer">
                <button class="menu-logout-btn" @click="logout">ログアウト</button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #f4f6f9;
}

.app-header {
  background-color: #2c3e50;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-inner {
  width: 100%;
  padding: 0 20px;
  height: 52px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-sizing: border-box;
}

.app-title {
  font-size: 15px;
  font-weight: bold;
  color: #ecf0f1;
  letter-spacing: 0.5px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* ナビタブ */
.nav-tabs {
  display: flex;
  align-items: stretch;
  height: 100%;
  flex: 1;
}

.nav-tab {
  display: flex;
  align-items: center;
  padding: 0 16px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition: color 0.2s, border-color 0.2s;
  white-space: nowrap;
}

.nav-tab:hover {
  color: #fff;
  border-bottom-color: rgba(255, 255, 255, 0.5);
}

.nav-tab--active {
  color: #fff;
  border-bottom-color: #fff;
}

/* ハンバーガーボタン */
.hamburger-btn {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  padding: 8px;
  background: none;
  border: none;
  cursor: pointer;
  margin-left: auto;
  flex-shrink: 0;
}

.hamburger-btn span {
  display: block;
  width: 22px;
  height: 2px;
  background: #ecf0f1;
  border-radius: 2px;
  transition: background 0.2s;
}

.hamburger-btn:hover span {
  background: #fff;
}

/* メイン */
.main-content {
  flex: 1;
  padding: 24px;
  width: 100%;
  box-sizing: border-box;
}

@media (max-width: 768px) {
  .header-inner {
    padding: 0 12px;
    gap: 8px;
  }

  .nav-tab {
    padding: 0 10px;
    font-size: 12px;
  }

  .main-content {
    padding: 16px 12px;
    max-width: 600px;
    margin: 0 auto;
  }
}
</style>

<!-- ハンバーガーメニュー（Teleport）はスコープなし -->
<style>
.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.25s ease;
}
.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
}

.menu-slide-enter-active,
.menu-slide-leave-active {
  transition: transform 0.25s ease;
}
.menu-slide-enter-from,
.menu-slide-leave-to {
  transform: translateX(100%);
}

.menu-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
}

.menu-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 260px;
  height: 100%;
  background: #fff;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}

.menu-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.menu-brand {
  font-size: 15px;
  font-weight: bold;
  color: #2c3e50;
}

.menu-close-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: #aaa;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.menu-close-btn:hover {
  color: #333;
}

.menu-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 24px;
  font-size: 14px;
  color: #444;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.menu-item:hover {
  background: #f4f6f9;
  color: #2c3e50;
}

.menu-item.active {
  color: #4169b0;
  background: #eef2fb;
  font-weight: 600;
}

.menu-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.menu-item.active .menu-icon {
  opacity: 1;
}

.menu-footer {
  padding: 16px 20px;
  border-top: 1px solid #f0f0f0;
}

.menu-logout-btn {
  width: 100%;
  padding: 10px;
  font-size: 14px;
  color: #e15759;
  background: none;
  border: 1px solid #e15759;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.menu-logout-btn:hover {
  background: #fff0f0;
}
</style>
