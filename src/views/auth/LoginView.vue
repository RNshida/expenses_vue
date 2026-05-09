<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const mode = ref<'login' | 'register'>('login')
const slideDir = ref<'right' | 'left'>('right')
const email = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)

async function submit() {
  errorMessage.value = ''
  if (mode.value === 'register' && password.value.length < 8) {
    errorMessage.value = 'パスワードは8文字以上で入力してください'
    return
  }
  loading.value = true
  try {
    if (mode.value === 'login') {
      await authStore.login(email.value, password.value)
    } else {
      await authStore.register(email.value, password.value)
    }
    router.push('/')
  } catch (e: unknown) {
    errorMessage.value = e instanceof Error ? e.message : '予期しないエラーが発生しました'
  } finally {
    loading.value = false
  }
}

function switchMode() {
  slideDir.value = mode.value === 'login' ? 'right' : 'left'
  mode.value = mode.value === 'login' ? 'register' : 'login'
  errorMessage.value = ''
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="title">カケログマップ</h1>

      <div class="form-area">
        <Transition :name="slideDir === 'right' ? 'slide-right' : 'slide-left'" mode="out-in">
          <div :key="mode" class="form-inner">
            <h2 class="subtitle">{{ mode === 'login' ? 'ログイン' : 'ユーザー登録' }}</h2>

            <form @submit.prevent="submit" class="form">
              <div class="field">
                <label class="label">メールアドレス</label>
                <input
                  v-model="email"
                  type="email"
                  class="input"
                  placeholder="example@email.com"
                  required
                  autocomplete="email"
                />
              </div>

              <div class="field">
                <label class="label">パスワード</label>
                <input
                  v-model="password"
                  type="password"
                  class="input"
                  :placeholder="mode === 'register' ? '8文字以上で入力' : 'パスワードを入力'"
                  required
                  :minlength="mode === 'register' ? 8 : undefined"
                  :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
                />
              </div>

              <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

              <button type="submit" class="btn-submit" :disabled="loading">
                {{ loading ? '処理中...' : mode === 'login' ? 'ログイン' : '登録する' }}
              </button>
            </form>

            <p class="switch-text">
              {{ mode === 'login' ? 'アカウントをお持ちでない方は' : 'すでにアカウントをお持ちの方は' }}
              <button class="link-btn" @click="switchMode">
                {{ mode === 'login' ? 'ユーザー登録' : 'ログイン' }}
              </button>
            </p>

            <p v-if="mode === 'login'" class="forgot-password-text">
              <button class="link-btn" @click="router.push('/forgot-password')">
                パスワードをお忘れの方はこちら
              </button>
            </p>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
  background-color: #f4f6f9;
}

.login-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 40px 36px;
  width: 100%;
  max-width: 400px;
}

.title {
  font-size: 18px;
  font-weight: bold;
  color: #2c3e50;
  text-align: center;
  margin-bottom: 24px;
}

.form-area {
  overflow: hidden;
}

.form-inner {
  width: 100%;
}

.subtitle {
  font-size: 15px;
  color: #7f8c8d;
  text-align: center;
  margin-bottom: 24px;
  font-weight: normal;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

.input {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.input:focus {
  border-color: #4e79a7;
}

.error {
  color: #e74c3c;
  font-size: 13px;
  margin: 0;
}

.btn-submit {
  padding: 11px;
  background-color: #4e79a7;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-top: 4px;
}

.btn-submit:hover:not(:disabled) {
  background-color: #3d6491;
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.switch-text {
  text-align: center;
  margin-top: 20px;
  font-size: 13px;
  color: #7f8c8d;
}

.forgot-password-text {
  text-align: center;
  margin-top: 10px;
  font-size: 12px;
  color: #aaa;
}

.link-btn {
  background: none;
  border: none;
  color: #4e79a7;
  cursor: pointer;
  font-size: 13px;
  text-decoration: underline;
  padding: 0;
}

/* スライドアニメーション */
.slide-right-enter-active,
.slide-right-leave-active,
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.28s ease;
}

.slide-right-enter-from {
  transform: translateX(40px);
  opacity: 0;
}
.slide-right-leave-to {
  transform: translateX(-40px);
  opacity: 0;
}
.slide-left-enter-from {
  transform: translateX(-40px);
  opacity: 0;
}
.slide-left-leave-to {
  transform: translateX(40px);
  opacity: 0;
}
</style>
