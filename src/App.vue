<script setup>
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { computed, ref, onMounted, watch } from 'vue'
import { supabase, signOut } from './services/supabase'
import Logo from './components/Logo.vue'

const route = useRoute()
const router = useRouter()
const user = ref(null)
const isMobileMenuOpen = ref(false)

const navItems = [
  { path: '/', name: 'Dashboard', icon: 'home' },
  { path: '/woning', name: 'Woning', icon: 'house' },
  { path: '/patronen', name: 'Patronen', icon: 'chart' },
  { path: '/instellingen', name: 'Instellingen', icon: 'settings' },
]

const isActive = (path) => {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

const isLoginPage = computed(() => route.path === '/login')

const userInitials = computed(() => {
  if (!user.value?.email) return 'GT'
  return user.value.email.substring(0, 2).toUpperCase()
})

// Close mobile menu when route changes
watch(() => route.path, () => {
  isMobileMenuOpen.value = false
})

function toggleMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

function closeMobileMenu() {
  isMobileMenuOpen.value = false
}

async function handleLogout() {
  isMobileMenuOpen.value = false
  await signOut()
  router.push('/login')
}

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  user.value = session?.user || null

  supabase.auth.onAuthStateChange((event, session) => {
    user.value = session?.user || null
  })
})
</script>

<template>
  <!-- Login page: no sidebar -->
  <RouterView v-if="isLoginPage" />

  <!-- App with sidebar -->
  <div v-else class="h-screen bg-gray-50 flex flex-col md:flex-row overflow-hidden">
    <!-- Mobile Header -->
    <header class="md:hidden bg-white border-b border-gray-200 flex items-center justify-between px-4 h-14 flex-shrink-0">
      <Logo size="sm" />
      <button
        @click="toggleMobileMenu"
        class="p-2 text-gray-600 hover:text-gray-900 transition-colors"
        :aria-expanded="isMobileMenuOpen"
        aria-label="Menu"
      >
        <!-- Hamburger icon -->
        <svg v-if="!isMobileMenuOpen" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <!-- Close icon -->
        <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </header>

    <!-- Mobile Menu Overlay -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isMobileMenuOpen"
        class="md:hidden fixed inset-0 bg-black/50 z-40"
        @click="closeMobileMenu"
      ></div>
    </Transition>

    <!-- Mobile Menu Drawer -->
    <Transition
      enter-active-class="transition-transform duration-200"
      enter-from-class="-translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-150"
      leave-from-class="translate-x-0"
      leave-to-class="-translate-x-full"
    >
      <aside
        v-if="isMobileMenuOpen"
        class="md:hidden fixed top-0 left-0 w-72 h-full bg-white z-50 flex flex-col shadow-xl"
      >
        <!-- Mobile Menu Header -->
        <div class="h-14 flex items-center justify-between px-4 border-b border-gray-200">
          <Logo size="sm" />
          <button
            @click="closeMobileMenu"
            class="p-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Mobile Navigation -->
        <nav class="flex-1 py-4">
          <RouterLink
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-3 px-6 py-3 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            :class="{ 'bg-emerald-50 text-emerald-700 border-r-2 border-emerald-600': isActive(item.path) }"
            @click="closeMobileMenu"
          >
            <!-- Home icon -->
            <svg v-if="item.icon === 'home'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <!-- Chart icon -->
            <svg v-else-if="item.icon === 'chart'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <!-- House icon -->
            <svg v-else-if="item.icon === 'house'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <!-- Settings icon -->
            <svg v-else-if="item.icon === 'settings'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span class="font-medium">{{ item.name }}</span>
          </RouterLink>
        </nav>

        <!-- Mobile User / Logout -->
        <div class="border-t border-gray-200 p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <span class="text-emerald-700 text-sm font-medium">{{ userInitials }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate">{{ user?.email || 'GerustThuis' }}</p>
              <button
                @click="handleLogout"
                class="text-sm text-gray-500 hover:text-red-600 transition-colors"
              >
                Uitloggen
              </button>
            </div>
          </div>
        </div>
      </aside>
    </Transition>

    <!-- Desktop Sidebar (hidden on mobile) -->
    <aside class="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col flex-shrink-0">
      <!-- Logo -->
      <div class="h-16 flex items-center px-6 border-b border-gray-200">
        <Logo size="md" />
      </div>

      <!-- Navigation -->
      <nav class="flex-1 py-4">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-6 py-3 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          :class="{ 'bg-emerald-50 text-emerald-700 border-r-2 border-emerald-600': isActive(item.path) }"
        >
          <!-- Home icon -->
          <svg v-if="item.icon === 'home'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <!-- Chart icon -->
          <svg v-else-if="item.icon === 'chart'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <!-- House icon -->
          <svg v-else-if="item.icon === 'house'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <!-- Settings icon -->
          <svg v-else-if="item.icon === 'settings'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span class="font-medium">{{ item.name }}</span>
        </RouterLink>
      </nav>

      <!-- User / Logout -->
      <div class="border-t border-gray-200 p-4">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
            <span class="text-emerald-700 text-sm font-medium">{{ userInitials }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 truncate">{{ user?.email || 'GerustThuis' }}</p>
            <button
              @click="handleLogout"
              class="text-xs text-gray-500 hover:text-red-600 transition-colors"
            >
              Uitloggen
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 p-4 md:p-6 overflow-auto">
      <RouterView />
    </main>
  </div>
</template>
