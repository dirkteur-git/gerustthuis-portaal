<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../services/supabase'

const router = useRouter()
const status = ref('processing')
const error = ref(null)
const message = ref('Verbinding wordt opgezet...')

onMounted(async () => {
  try {
    // Get code from URL
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const errorParam = params.get('error')

    if (errorParam) {
      throw new Error(`Hue error: ${errorParam}`)
    }

    if (!code) {
      throw new Error('Geen authorization code ontvangen')
    }

    // Verify state
    const savedState = localStorage.getItem('hue_oauth_state')
    if (state !== savedState) {
      throw new Error('State mismatch - mogelijk CSRF aanval')
    }
    localStorage.removeItem('hue_oauth_state')

    message.value = 'Code ontvangen, tokens ophalen...'

    // Call Edge Function to exchange code for tokens
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const response = await fetch(`${supabaseUrl}/functions/v1/hue-token-exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        user_email: 'dirk.bakker@gmx.net' // Hardcoded voor nu, geen RLS
      })
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Token exchange failed')
    }

    message.value = result.message || 'Verbinding geslaagd!'
    status.value = 'success'

    // Redirect to dashboard after 2 seconds
    setTimeout(() => {
      router.push('/')
    }, 2000)

  } catch (e) {
    console.error('Callback error:', e)
    error.value = e.message
    status.value = 'error'
  }
})
</script>

<template>
  <div class="min-h-[60vh] flex items-center justify-center">
    <div class="bg-white rounded-lg shadow p-8 max-w-md w-full text-center">
      <!-- Processing -->
      <template v-if="status === 'processing'">
        <div class="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 class="text-lg font-medium mb-2">Even geduld...</h2>
        <p class="text-gray-600">{{ message }}</p>
      </template>

      <!-- Success -->
      <template v-else-if="status === 'success'">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-lg font-medium text-green-800 mb-2">Gelukt!</h2>
        <p class="text-gray-600">{{ message }}</p>
        <p class="text-sm text-gray-500 mt-4">Je wordt doorgestuurd naar het dashboard...</p>
      </template>

      <!-- Error -->
      <template v-else-if="status === 'error'">
        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 class="text-lg font-medium text-red-800 mb-2">Er ging iets mis</h2>
        <p class="text-gray-600 mb-4">{{ error }}</p>
        <router-link to="/hue" class="text-indigo-600 hover:text-indigo-500">
          Probeer opnieuw →
        </router-link>
      </template>
    </div>
  </div>
</template>
