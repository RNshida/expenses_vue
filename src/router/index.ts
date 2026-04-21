import { createRouter, createWebHistory } from 'vue-router'
import ExpensesSummary from '../views/expenses/expenses-summary/ExpensesSummary.vue'
import InputView from '../views/expenses/input/InputView.vue'
import LoginView from '../views/auth/LoginView.vue'
import GoalView from '../views/expenses/goal/GoalView.vue'
import FurusatoView from '../views/furusato/FurusatoView.vue'
import MyPageView from '../views/mypage/MyPageView.vue'
import { useAuthStore } from '../stores/authStore'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/',
      name: 'summary',
      component: ExpensesSummary,
      meta: { requiresAuth: true },
    },
    {
      path: '/input',
      name: 'input',
      component: InputView,
      meta: { requiresAuth: true },
    },
    {
      path: '/goal',
      name: 'goal',
      component: GoalView,
      meta: { requiresAuth: true },
    },
    {
      path: '/furusato',
      name: 'furusato',
      component: FurusatoView,
      meta: { requiresAuth: true },
    },
    {
      path: '/mypage',
      name: 'mypage',
      component: MyPageView,
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return '/login'
  }
  if (to.path === '/login' && authStore.isAuthenticated) {
    return '/'
  }
})

export default router
