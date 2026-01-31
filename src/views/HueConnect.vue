<script setup>
import { ref, onMounted, computed } from 'vue'
import { getHueConfig } from '../services/supabase'

const config = ref(null)
const loading = ref(true)
const error = ref(null)

// Hue OAuth settings - deze moet je invullen
const HUE_CLIENT_ID = import.meta.env.VITE_HUE_CLIENT_ID || 'VULT_JE_HUE_CLIENT_ID_IN'
const REDIRECT_URI = window.location.origin + '/hue/callback'

const isConnected = computed(() => config.value?.status === 'active')

onMounted(async () => {
  try {
    config.value = await getHueConfig()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

function connectHue() {
  // Generate random state for CSRF protection
  const state = crypto.randomUUID()
  localStorage.setItem('hue_oauth_state', state)

  // Redirect to Hue OAuth
  const authUrl = new URL('https://api.meethue.com/v2/oauth2/authorize')
  authUrl.searchParams.set('client_id', HUE_CLIENT_ID)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('state', state)

  window.location.href = authUrl.toString()
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString('nl-NL')
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Hue Verbinding</h1>

    <div v-if="loading" class="text-gray-500">Laden...</div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
      {{ error }}
    </div>

    <template v-else>
      <!-- Connected state -->
      <div v-if="isConnected" class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center mb-4">
          <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div class="ml-4">
            <h2 class="text-lg font-medium text-green-800">Hue is verbonden</h2>
            <p class="text-sm text-gray-600">{{ config.user_email }}</p>
          </div>
        </div>

        <div class="border-t pt-4 mt-4 space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-500">Status:</span>
            <span class="font-medium text-green-600">{{ config.status }}</span>
          </div>
          <div v-if="config.bridge_username" class="flex justify-between">
            <span class="text-gray-500">Bridge username:</span>
            <span class="font-mono text-xs">{{ config.bridge_username }}</span>
          </div>
          <div v-if="config.last_sync_at" class="flex justify-between">
            <span class="text-gray-500">Laatste sync:</span>
            <span>{{ formatTime(config.last_sync_at) }}</span>
          </div>
          <div v-if="config.token_expires_at" class="flex justify-between">
            <span class="text-gray-500">Token verloopt:</span>
            <span>{{ formatTime(config.token_expires_at) }}</span>
          </div>
        </div>

        <div class="mt-6">
          <button
            @click="connectHue"
            class="text-sm text-emerald-600 hover:text-emerald-500"
          >
            Opnieuw verbinden
          </button>
        </div>
      </div>

      <!-- Not connected state -->
      <div v-else class="bg-white rounded-lg shadow p-6">
        <div class="text-center">
          <div class="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h2 class="text-lg font-medium mb-2">Verbind met Philips Hue</h2>
          <p class="text-gray-600 mb-6">
            Koppel je Hue account om lampen en sensoren uit te lezen.
          </p>

          <button
            @click="connectHue"
            class="bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition"
          >
            Verbinden met Hue
          </button>

          <p class="text-xs text-gray-500 mt-4">
            Je wordt doorgestuurd naar Philips om in te loggen.
          </p>
        </div>
      </div>

      <!-- Instructions -->
      <div class="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 class="font-medium mb-3">Hoe werkt het?</h3>
        <ol class="list-decimal list-inside space-y-2 text-sm text-gray-600">
          <li>Klik op "Verbinden met Hue"</li>
          <li>Log in met je Philips Hue account</li>
          <li>Geef GerustThuis toegang tot je bridge</li>
          <li>Je wordt teruggestuurd naar deze pagina</li>
          <li>De polling start automatisch elke 5 minuten</li>
        </ol>
      </div>
    </template>
  </div>
</template>
