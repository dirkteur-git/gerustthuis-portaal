import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from './services/supabase'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('./views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('./views/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/analyse',
    name: 'Analyse',
    component: () => import('./views/Analyse.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/patronen',
    name: 'Patronen',
    component: () => import('./views/Patronen.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/woning',
    name: 'Woning',
    component: () => import('./views/Woning.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/instellingen',
    name: 'Instellingen',
    component: () => import('./views/Instellingen.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/hue',
    name: 'HueConnect',
    component: () => import('./views/HueConnect.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/hue/callback',
    name: 'HueCallback',
    component: () => import('./views/HueCallback.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/uitnodiging/:token',
    name: 'AcceptInvitation',
    component: () => import('./views/AcceptInvitation.vue'),
    meta: { requiresAuth: false }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Auth guard
router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.meta.requiresAuth !== false

  if (requiresAuth) {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return next('/login')
    }
  }

  // If user is logged in and tries to access login page, redirect to dashboard
  if (to.path === '/login') {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      return next('/')
    }
  }

  next()
})

export default router
