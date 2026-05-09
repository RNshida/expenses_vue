<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
const router = useRouter()
const route = useRoute()

const token = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

onMounted(() => {
  token.value = (route.query.token as string) ?? ''
  if (!token.value) {
    errorMessage.value = '無効なリンクです。パスワード再設定を最初からやり直してください。'
  }
})

async function submit() {
  errorMessage.value = ''
  if (newPassword.value.length < 8) {
    errorMessage.value = 'パスワードは8文字以上で入力してください'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = 'パスワードが一致しません'
    return
  }
  loading.value = true
  try {
    const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.value, newPassword: newPassword.value }),
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(text || 'エラーが発生しました')
    }
    successMessage.value = 'パスワードを再設定しました。ログインしてください。'
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'エラーが発生しました'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="title">カケログマップ</h1>
      <h2 class="subtitle">新しいパスワードの設定</h2>

      <div v-if="successMessage" class="success">
        {{ successMessage }}
        <br />
        <button class="link-btn" @click="router.push('/login')">ログイン画面へ</button>
      </div>

      <form v-else-if="token" @submit.prevent="submit" class="form">
        <div class="field">
          <label class="label">新しいパスワード（8文字以上）</label>
          <input
            v-model="newPassword"
            type="password"
            class="input"
            placeholder="8文字以上で入力"
            required
            autocomplete="new-password"
          />
        </div>

        <div class="field">
          <label class="label">パスワード（確認）</label>
          <input
            v-model="confirmPassword"
            type="password"
            class="input"
            placeholder="もう一度入力"
            required
            autocomplete="new-password"
          />
        </div>

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

        <button type="submit" class="btn-submit" :disabled="loading">
          {{ loading ? '設定中...' : 'パスワードを設定する' }}
        </button>
      </form>

      <div v-else class="error-block">
        <p class="error">{{ errorMessage }}</p>
        <button class="link-btn" @click="router.push('/forgot-password')">再設定を申請する</button>
      </div>

      <p v-if="!successMessage" class="back-link">
        <button class="link-btn" @click="router.push('/login')">ログイン画面に戻る</button>
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
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
  margin-bottom: 8px;
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

.input:focus { border-color: #4e79a7; }

.error {
  color: #e74c3c;
  font-size: 13px;
  margin: 0;
}

.error-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.success {
  color: #27ae60;
  background: #f0faf4;
  border: 1px solid #27ae60;
  border-radius: 6px;
  padding: 16px;
  font-size: 13px;
  text-align: center;
  line-height: 1.8;
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

.btn-submit:hover:not(:disabled) { background-color: #3d6491; }
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

.back-link {
  text-align: center;
  margin-top: 20px;
  font-size: 13px;
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
</style>
