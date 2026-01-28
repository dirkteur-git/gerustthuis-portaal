import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('./views/Dashboard.vue')
  },
  {
    path: '/status',
    name: 'Status',
    component: () => import('./views/Status.vue')
  },
  {
    path: '/patronen',
    name: 'Patronen',
    component: () => import('./views/Patronen.vue')
  },
  {
    path: '/woning',
    name: 'Woning',
    component: () => import('./views/Woning.vue')
  },
  {
    path: '/instellingen',
    name: 'Instellingen',
    component: () => import('./views/Instellingen.vue')
  },
  {
    path: '/hue',
    name: 'HueConnect',
    component: () => import('./views/HueConnect.vue')
  },
  {
    path: '/hue/callback',
    name: 'HueCallback',
    component: () => import('./views/HueCallback.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
