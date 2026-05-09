<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
const router = useRouter()

const email = ref('')
const loading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

async function submit() {
  errorMessage.value = ''
  successMessage.value = ''
  loading.value = true
  try {
    const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value }),
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || 'エラーが発生しました')
    }
    successMessage.value = 'メールを送信しました。受信トレイをご確認ください。'
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
      <h2 class="subtitle">パスワード再設定</h2>

      <p class="description">
        登録済みのメールアドレスを入力してください。<br />
        パスワード再設定用のURLをお送りします。
      </p>

      <div v-if="successMessage" class="success">{{ successMessage }}</div>

      <form v-else @submit.prevent="submit" class="form">
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

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

        <button type="submit" class="btn-submit" :disabled="loading">
          {{ loading ? '送信中...' : '再設定メールを送信' }}
        </button>
      </form>

      <p class="back-link">
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
  margin-bottom: 16px;
  font-weight: normal;
}

.description {
  font-size: 13px;
  color: #888;
  text-align: center;
  line-height: 1.6;
  margin-bottom: 24px;
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

.success {
  color: #27ae60;
  background: #f0faf4;
  border: 1px solid #27ae60;
  border-radius: 6px;
  padding: 12px 16px;
  font-size: 13px;
  text-align: center;
  margin-bottom: 8px;
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
