<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getHueConfig } from '../services/supabase'

const router = useRouter()
const activeTab = ref('account')
const loading = ref(true)
const hueConfig = ref(null)

// Account form
const accountForm = ref({
  name: '',
  email: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})
const accountSaving = ref(false)
const accountMessage = ref(null)

// Computed
const isHueConnected = computed(() => hueConfig.value?.status === 'active')

const hueConnectionAge = computed(() => {
  if (!hueConfig.value?.created_at) return null
  const created = new Date(hueConfig.value.created_at)
  const now = new Date()
  const days = Math.floor((now - created) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Vandaag'
  if (days === 1) return '1 dag'
  return `${days} dagen`
})

onMounted(async () => {
  try {
    hueConfig.value = await getHueConfig()
  } finally {
    loading.value = false
  }
})

function formatDateTime(timestamp) {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function saveAccount() {
  accountSaving.value = true
  accountMessage.value = null

  // TODO: Implement account save via Supabase Auth
  setTimeout(() => {
    accountSaving.value = false
    accountMessage.value = { type: 'info', text: 'Account instellingen worden binnenkort ondersteund.' }
  }, 500)
}

function connectHue() {
  router.push('/hue')
}
</script>

<template>
  <div class="max-w-3xl space-y-4">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Instellingen</h1>
      <p class="text-gray-500">Beheer je account en integraties</p>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200">
      <nav class="flex gap-6">
        <button
          @click="activeTab = 'account'"
          :class="[
            'py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'account'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          ]"
        >
          Account
        </button>
        <button
          @click="activeTab = 'integraties'"
          :class="[
            'py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'integraties'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          ]"
        >
          Integraties
        </button>
      </nav>
    </div>

    <!-- Account Tab -->
    <div v-if="activeTab === 'account'" class="space-y-4">
      <div class="bg-white rounded-xl shadow-sm border p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Profiel</h2>

        <form @submit.prevent="saveAccount" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Naam</label>
            <input
              v-model="accountForm.name"
              type="text"
              placeholder="Je naam"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              v-model="accountForm.email"
              type="email"
              placeholder="je@email.nl"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
          </div>

          <div class="pt-4 border-t">
            <h3 class="text-sm font-medium text-gray-900 mb-3">Wachtwoord wijzigen</h3>

            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Huidig wachtwoord</label>
                <input
                  v-model="accountForm.currentPassword"
                  type="password"
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Nieuw wachtwoord</label>
                <input
                  v-model="accountForm.newPassword"
                  type="password"
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Bevestig nieuw wachtwoord</label>
                <input
                  v-model="accountForm.confirmPassword"
                  type="password"
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
              </div>
            </div>
          </div>

          <div v-if="accountMessage" :class="[
            'p-3 rounded-lg text-sm',
            accountMessage.type === 'success' ? 'bg-green-50 text-green-700' :
            accountMessage.type === 'error' ? 'bg-red-50 text-red-700' :
            'bg-blue-50 text-blue-700'
          ]">
            {{ accountMessage.text }}
          </div>

          <div class="pt-4">
            <button
              type="submit"
              :disabled="accountSaving"
              class="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {{ accountSaving ? 'Opslaan...' : 'Opslaan' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Integraties Tab -->
    <div v-if="activeTab === 'integraties'" class="space-y-4">
      <div class="bg-white rounded-xl shadow-sm border p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Beschikbare integraties</h2>

        <div v-if="loading" class="text-gray-500 text-center py-8">Laden...</div>

        <div v-else class="space-y-4">
          <!-- Philips Hue -->
          <div
            @click="connectHue"
            class="flex items-center gap-4 p-4 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
            :class="isHueConnected ? 'border-emerald-200 bg-emerald-50/50' : ''"
          >
            <!-- Hue Logo -->
            <div class="w-14 h-14 bg-white rounded-xl flex items-center justify-center shrink-0 border">
              <img src="/hue-logo.png" alt="Philips Hue" class="w-12 h-12 object-contain">
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-medium text-gray-900">Philips Hue</h3>
                <span
                  v-if="isHueConnected"
                  class="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full"
                >
                  Verbonden
                </span>
              </div>
              <p class="text-sm text-gray-500">
                {{ isHueConnected ? 'Sensoren en lampen worden uitgelezen' : 'Verbind je Hue Bridge voor sensor data' }}
              </p>
            </div>

            <div class="text-gray-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          <!-- Hue Details (when connected) -->
          <div v-if="isHueConnected" class="ml-4 pl-4 border-l-2 border-emerald-200 space-y-3">
            <div class="text-sm">
              <span class="text-gray-500">Verbonden sinds:</span>
              <span class="ml-2 font-medium text-gray-900">{{ hueConnectionAge }}</span>
            </div>
            <div class="text-sm">
              <span class="text-gray-500">Account:</span>
              <span class="ml-2 font-medium text-gray-900">{{ hueConfig.user_email || '-' }}</span>
            </div>
            <div class="text-sm">
              <span class="text-gray-500">Laatste sync:</span>
              <span class="ml-2 font-medium text-gray-900">{{ formatDateTime(hueConfig.last_sync_at) }}</span>
            </div>
            <div class="text-sm">
              <span class="text-gray-500">Token verloopt:</span>
              <span class="ml-2 font-medium text-gray-900">{{ formatDateTime(hueConfig.token_expires_at) }}</span>
            </div>
          </div>

          <!-- Placeholder for future integrations -->
          <div class="flex items-center gap-4 p-4 border border-dashed rounded-xl opacity-50">
            <div class="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
              <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div class="flex-1">
              <h3 class="font-medium text-gray-500">Meer integraties</h3>
              <p class="text-sm text-gray-400">Binnenkort beschikbaar</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
