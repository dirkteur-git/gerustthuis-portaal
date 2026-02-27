<script setup>
import { RouterView, useRoute, useRouter } from 'vue-router'
import { ref, computed, onMounted } from 'vue'
import { supabase, signOut, loadUserProfile, userState } from './services/supabase'
import TabBar from './components/TabBar.vue'

const route = useRoute()
const router = useRouter()
const user = ref(null)

const isLoginPage = computed(() => route.path === '/login')
const isInvitationPage = computed(() => route.path.startsWith('/uitnodiging'))
const showTabBar = computed(() => !isLoginPage.value && !isInvitationPage.value)

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  user.value = session?.user || null

  if (session?.user) {
    await loadUserProfile()
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    user.value = session?.user || null
    if (session?.user && !userState.loaded) {
      await loadUserProfile()
    }
  })
})
</script>

<template>
  <!-- Login page or invitation: no chrome -->
  <RouterView v-if="isLoginPage || isInvitationPage" />

  <!-- App with bottom TabBar -->
  <div v-else class="app-shell">
    <main class="app-main">
      <RouterView />
    </main>
    <TabBar />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100dvh;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
  /* Reserve space for fixed TabBar (60px) + safe area */
  padding-bottom: calc(60px + env(safe-area-inset-bottom));
  overflow-y: auto;
}
</style>
