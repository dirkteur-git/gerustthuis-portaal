<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase, acceptInvitation } from '../services/supabase'
import Logo from '../components/Logo.vue'

const route = useRoute()
const router = useRouter()

const status = ref('loading') // loading, login-required, accepting, success, error
const errorMessage = ref('')
const invitation = ref(null)

onMounted(async () => {
  const token = route.params.token
  if (!token) {
    status.value = 'error'
    errorMessage.value = 'Geen uitnodigingstoken gevonden'
    return
  }

  // Check if user is logged in
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    status.value = 'login-required'
    return
  }

  // User is logged in, try to accept
  await doAccept(token)
})

async function doAccept(token) {
  status.value = 'accepting'

  try {
    const result = await acceptInvitation(token)

    if (result?.success) {
      status.value = 'success'
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } else {
      status.value = 'error'
      errorMessage.value = result?.error || 'Onbekende fout bij accepteren'
    }
  } catch (error) {
    console.error('Error accepting invitation:', error)
    status.value = 'error'
    errorMessage.value = error.message || 'Kon uitnodiging niet accepteren'
  }
}

function goToLogin() {
  // Store the current URL so we can redirect back after login
  const returnUrl = route.fullPath
  router.push(`/login?redirect=${encodeURIComponent(returnUrl)}`)
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="max-w-md w-full">
      <div class="text-center mb-8">
        <Logo size="lg" class="justify-center" />
      </div>

      <div class="bg-white rounded-xl shadow-sm border p-8 text-center">
        <!-- Loading -->
        <template v-if="status === 'loading'">
          <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p class="text-gray-500">Uitnodiging laden...</p>
        </template>

        <!-- Login required -->
        <template v-else-if="status === 'login-required'">
          <div class="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900 mb-2">Uitnodiging voor huishouden</h2>
          <p class="text-gray-500 mb-6">Log in of maak een account aan om de uitnodiging te accepteren.</p>
          <button
            @click="goToLogin"
            class="w-full px-4 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            Inloggen
          </button>
        </template>

        <!-- Accepting -->
        <template v-else-if="status === 'accepting'">
          <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p class="text-gray-500">Uitnodiging accepteren...</p>
        </template>

        <!-- Success -->
        <template v-else-if="status === 'success'">
          <div class="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900 mb-2">Welkom!</h2>
          <p class="text-gray-500">Je bent toegevoegd aan het huishouden. Je wordt doorgestuurd...</p>
        </template>

        <!-- Error -->
        <template v-else-if="status === 'error'">
          <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900 mb-2">Uitnodiging mislukt</h2>
          <p class="text-gray-500 mb-6">{{ errorMessage }}</p>
          <button
            @click="router.push('/')"
            class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Naar dashboard
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
