<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase, getHueConfig } from '../services/supabase'

const router = useRouter()
const activeTab = ref('account')
const loading = ref(true)
const hueConfig = ref(null)
const user = ref(null)

// Country codes for phone
const countryCodes = [
  { code: '+31', country: 'Nederland', flag: '🇳🇱' },
  { code: '+32', country: 'België', flag: '🇧🇪' },
  { code: '+49', country: 'Duitsland', flag: '🇩🇪' },
  { code: '+33', country: 'Frankrijk', flag: '🇫🇷' },
  { code: '+44', country: 'Verenigd Koninkrijk', flag: '🇬🇧' },
  { code: '+1', country: 'VS/Canada', flag: '🇺🇸' },
]

// Profile form
const profileForm = ref({
  displayName: '',
  phoneCountryCode: '+31',
  phoneNumber: '',
  communicationPreference: 'email'
})
const profileSaving = ref(false)
const profileMessage = ref(null)

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
    // Get current user
    const { data: { user: authUser } } = await supabase.auth.getUser()
    user.value = authUser

    // Load Hue config
    hueConfig.value = await getHueConfig()

    // Load user profile
    if (authUser) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profile) {
        profileForm.value = {
          displayName: profile.display_name || '',
          phoneCountryCode: profile.phone_country_code || '+31',
          phoneNumber: profile.phone_number || '',
          communicationPreference: profile.communication_preference || 'email'
        }
      }
    }
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

async function saveProfile() {
  if (!user.value) return

  profileSaving.value = true
  profileMessage.value = null

  try {
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        id: user.value.id,
        display_name: profileForm.value.displayName || null,
        phone_country_code: profileForm.value.phoneCountryCode,
        phone_number: profileForm.value.phoneNumber || null,
        communication_preference: profileForm.value.communicationPreference
      })

    if (error) throw error

    profileMessage.value = { type: 'success', text: 'Profiel opgeslagen' }
  } catch (error) {
    console.error('Error saving profile:', error)
    profileMessage.value = { type: 'error', text: 'Kon profiel niet opslaan. Probeer het opnieuw.' }
  } finally {
    profileSaving.value = false
  }
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

        <div v-if="loading" class="text-gray-500 text-center py-8">Laden...</div>

        <form v-else @submit.prevent="saveProfile" class="space-y-4">
          <!-- Email (readonly) -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              :value="user?.email"
              type="email"
              disabled
              class="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            >
            <p class="text-xs text-gray-400 mt-1">E-mailadres kan niet worden gewijzigd</p>
          </div>

          <!-- Display Name -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Naam</label>
            <input
              v-model="profileForm.displayName"
              type="text"
              placeholder="Je naam"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
          </div>

          <!-- Phone Number with Country Code -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Mobiel nummer</label>
            <div class="flex gap-2">
              <select
                v-model="profileForm.phoneCountryCode"
                class="w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
              >
                <option v-for="cc in countryCodes" :key="cc.code" :value="cc.code">
                  {{ cc.flag }} {{ cc.code }}
                </option>
              </select>
              <input
                v-model="profileForm.phoneNumber"
                type="tel"
                placeholder="612345678"
                class="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
            </div>
            <p class="text-xs text-gray-400 mt-1">Zonder voorloop-nul, bijv. 612345678</p>
          </div>

          <!-- Communication Preference -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Communicatievoorkeur</label>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <!-- Email -->
              <label
                :class="[
                  'flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors',
                  profileForm.communicationPreference === 'email'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:bg-gray-50'
                ]"
              >
                <input
                  type="radio"
                  v-model="profileForm.communicationPreference"
                  value="email"
                  class="sr-only"
                >
                <svg class="w-5 h-5 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span class="text-sm font-medium">E-mail</span>
              </label>

              <!-- SMS -->
              <label
                :class="[
                  'flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors',
                  profileForm.communicationPreference === 'sms'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:bg-gray-50'
                ]"
              >
                <input
                  type="radio"
                  v-model="profileForm.communicationPreference"
                  value="sms"
                  class="sr-only"
                >
                <svg class="w-5 h-5 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span class="text-sm font-medium">SMS</span>
              </label>

              <!-- WhatsApp -->
              <label
                :class="[
                  'flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors',
                  profileForm.communicationPreference === 'whatsapp'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:bg-gray-50'
                ]"
              >
                <input
                  type="radio"
                  v-model="profileForm.communicationPreference"
                  value="whatsapp"
                  class="sr-only"
                >
                <svg class="w-5 h-5 text-gray-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span class="text-sm font-medium">WhatsApp</span>
              </label>
            </div>
          </div>

          <!-- Message -->
          <div v-if="profileMessage" :class="[
            'p-3 rounded-lg text-sm',
            profileMessage.type === 'success' ? 'bg-green-50 text-green-700' :
            profileMessage.type === 'error' ? 'bg-red-50 text-red-700' :
            'bg-blue-50 text-blue-700'
          ]">
            {{ profileMessage.text }}
          </div>

          <!-- Save Button -->
          <div class="pt-4">
            <button
              type="submit"
              :disabled="profileSaving"
              class="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {{ profileSaving ? 'Opslaan...' : 'Opslaan' }}
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
