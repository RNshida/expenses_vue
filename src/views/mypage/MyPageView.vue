<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/authStore'

const authStore = useAuthStore()

// メールアドレス変更
const emailForm = ref({ newEmail: '', currentPassword: '' })
const emailSaving = ref(false)
const emailSuccess = ref<string | null>(null)
const emailError = ref<string | null>(null)

async function saveEmail() {
  const { newEmail, currentPassword } = emailForm.value
  if (!newEmail || !currentPassword) return
  emailSaving.value = true
  emailSuccess.value = null
  emailError.value = null
  try {
    await authStore.updateEmail(newEmail, currentPassword)
    emailSuccess.value = 'メールアドレスを変更しました'
    emailForm.value = { newEmail: '', currentPassword: '' }
    setTimeout(() => (emailSuccess.value = null), 4000)
  } catch (e) {
    emailError.value = e instanceof Error ? e.message : 'メールアドレスの変更に失敗しました'
  } finally {
    emailSaving.value = false
  }
}

// パスワード変更
const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' })
const passwordSaving = ref(false)
const passwordSuccess = ref<string | null>(null)
const passwordError = ref<string | null>(null)

async function savePassword() {
  const { currentPassword, newPassword, confirmPassword } = passwordForm.value
  if (!currentPassword || !newPassword || !confirmPassword) return
  if (newPassword !== confirmPassword) {
    passwordError.value = '新しいパスワードが一致しません'
    return
  }
  if (newPassword.length < 8) {
    passwordError.value = 'パスワードは8文字以上で入力してください'
    return
  }
  passwordSaving.value = true
  passwordSuccess.value = null
  passwordError.value = null
  try {
    await authStore.updatePassword(currentPassword, newPassword)
    passwordSuccess.value = 'パスワードを変更しました'
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
    setTimeout(() => (passwordSuccess.value = null), 4000)
  } catch (e) {
    passwordError.value = e instanceof Error ? e.message : 'パスワードの変更に失敗しました'
  } finally {
    passwordSaving.value = false
  }
}
</script>

<template>
  <div class="mypage">
    <h1 class="title">マイページ</h1>

    <!-- 現在のメールアドレス -->
    <div class="info-card">
      <p class="info-label">現在のメールアドレス</p>
      <p class="info-value">{{ authStore.email }}</p>
    </div>

    <!-- メールアドレス変更 -->
    <div class="form-card">
      <h2 class="form-title">メールアドレスの変更</h2>
      <div class="form-group">
        <label class="form-label">新しいメールアドレス</label>
        <input
          v-model="emailForm.newEmail"
          type="email"
          class="form-input"
          placeholder="new@example.com"
          autocomplete="email"
        />
      </div>
      <div class="form-group">
        <label class="form-label">現在のパスワード（確認用）</label>
        <input
          v-model="emailForm.currentPassword"
          type="password"
          class="form-input"
          placeholder="••••••••"
          autocomplete="current-password"
        />
      </div>
      <div v-if="emailSuccess" class="success-message">{{ emailSuccess }}</div>
      <div v-if="emailError" class="error-message">{{ emailError }}</div>
      <button
        class="save-btn"
        :disabled="!emailForm.newEmail || !emailForm.currentPassword || emailSaving"
        @click="saveEmail"
      >{{ emailSaving ? '変更中...' : '変更する' }}</button>
    </div>

    <!-- パスワード変更 -->
    <div class="form-card">
      <h2 class="form-title">パスワードの変更</h2>
      <div class="form-group">
        <label class="form-label">現在のパスワード</label>
        <input
          v-model="passwordForm.currentPassword"
          type="password"
          class="form-input"
          placeholder="••••••••"
          autocomplete="current-password"
        />
      </div>
      <div class="form-group">
        <label class="form-label">新しいパスワード（8文字以上）</label>
        <input
          v-model="passwordForm.newPassword"
          type="password"
          class="form-input"
          placeholder="••••••••"
          autocomplete="new-password"
        />
      </div>
      <div class="form-group">
        <label class="form-label">新しいパスワード（確認）</label>
        <input
          v-model="passwordForm.confirmPassword"
          type="password"
          class="form-input"
          placeholder="••••••••"
          autocomplete="new-password"
        />
      </div>
      <div v-if="passwordSuccess" class="success-message">{{ passwordSuccess }}</div>
      <div v-if="passwordError" class="error-message">{{ passwordError }}</div>
      <button
        class="save-btn"
        :disabled="!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword || passwordSaving"
        @click="savePassword"
      >{{ passwordSaving ? '変更中...' : '変更する' }}</button>
    </div>
  </div>
</template>

<style scoped>
.mypage {
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.title {
  font-size: 22px;
  font-weight: bold;
  color: #2c3e50;
  margin: 0;
}

.info-card {
  background: #fff;
  border-radius: 10px;
  padding: 16px 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
}

.info-label {
  font-size: 12px;
  color: #888;
  margin: 0 0 4px;
}

.info-value {
  font-size: 15px;
  color: #2c3e50;
  font-weight: 500;
  margin: 0;
}

.form-card {
  background: #fff;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-title {
  font-size: 15px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 4px;
  padding-bottom: 10px;
  border-bottom: 1px solid #f0f0f0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-label {
  font-size: 13px;
  color: #555;
}

.form-input {
  padding: 9px 12px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 6px;
  outline: none;
  transition: border-color 0.2s;
}

.form-input:focus {
  border-color: #4169b0;
}

.save-btn {
  width: 100%;
  padding: 10px;
  background: #4169b0;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 4px;
}

.save-btn:hover:not(:disabled) {
  background: #325090;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.success-message {
  color: #59a14f;
  background: #f0faf0;
  border: 1px solid #59a14f;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
}

.error-message {
  color: #e15759;
  background: #fff0f0;
  border: 1px solid #e15759;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
}
</style>
