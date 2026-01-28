<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../services/supabase'

const router = useRouter()
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref(null)
const success = ref(null)
const isRegisterMode = ref(false)

async function handleLogin() {
  loading.value = true
  error.value = null

  try {
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })

    if (authError) {
      error.value = authError.message === 'Invalid login credentials'
        ? 'Ongeldige inloggegevens'
        : authError.message
      return
    }

    if (data.user) {
      router.push('/')
    }
  } catch (e) {
    error.value = 'Er ging iets mis. Probeer het opnieuw.'
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  loading.value = true
  error.value = null
  success.value = null

  // Validatie
  if (password.value !== confirmPassword.value) {
    error.value = 'Wachtwoorden komen niet overeen'
    loading.value = false
    return
  }

  if (password.value.length < 6) {
    error.value = 'Wachtwoord moet minimaal 6 tekens zijn'
    loading.value = false
    return
  }

  try {
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
    })

    if (authError) {
      error.value = authError.message
      return
    }

    if (data.user) {
      // Check of email confirmatie nodig is
      if (data.user.identities?.length === 0) {
        error.value = 'Dit e-mailadres is al geregistreerd'
      } else if (data.session) {
        // Direct ingelogd (geen email confirmatie nodig)
        router.push('/')
      } else {
        // Email confirmatie verstuurd
        success.value = 'Account aangemaakt! Check je e-mail om je account te bevestigen.'
        email.value = ''
        password.value = ''
        confirmPassword.value = ''
      }
    }
  } catch (e) {
    error.value = 'Er ging iets mis. Probeer het opnieuw.'
  } finally {
    loading.value = false
  }
}

function toggleMode() {
  isRegisterMode.value = !isRegisterMode.value
  error.value = null
  success.value = null
  password.value = ''
  confirmPassword.value = ''
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
    <div class="max-w-md w-full">
      <!-- Logo -->
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-emerald-600">GerustThuis</h1>
        <p class="text-gray-500 mt-1">Privacy-first thuismonitoring</p>
      </div>

      <!-- Login/Register Card -->
      <div class="bg-white rounded-xl shadow-sm border p-8">
        <h2 class="text-xl font-semibold text-gray-900 mb-6">
          {{ isRegisterMode ? 'Account aanmaken' : 'Inloggen' }}
        </h2>

        <form @submit.prevent="isRegisterMode ? handleRegister() : handleLogin()" class="space-y-4">
          <!-- Email -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              v-model="email"
              type="email"
              required
              autocomplete="email"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="je@email.nl"
            >
          </div>

          <!-- Password -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Wachtwoord</label>
            <input
              v-model="password"
              type="password"
              required
              :autocomplete="isRegisterMode ? 'new-password' : 'current-password'"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="••••••••"
            >
          </div>

          <!-- Confirm Password (only in register mode) -->
          <div v-if="isRegisterMode">
            <label class="block text-sm font-medium text-gray-700 mb-1">Bevestig wachtwoord</label>
            <input
              v-model="confirmPassword"
              type="password"
              required
              autocomplete="new-password"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="••••••••"
            >
          </div>

          <!-- Success -->
          <div v-if="success" class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
            {{ success }}
          </div>

          <!-- Error -->
          <div v-if="error" class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {{ error }}
          </div>

          <!-- Submit -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {{ loading ? 'Bezig...' : (isRegisterMode ? 'Account aanmaken' : 'Inloggen') }}
          </button>
        </form>
      </div>

      <!-- Toggle Login/Register -->
      <p class="text-center text-sm text-gray-500 mt-6">
        <span v-if="isRegisterMode">
          Heb je al een account?
          <button @click="toggleMode" class="text-emerald-600 hover:text-emerald-700 font-medium">
            Inloggen
          </button>
        </span>
        <span v-else>
          Geen account?
          <button @click="toggleMode" class="text-emerald-600 hover:text-emerald-700 font-medium">
            Account aanmaken
          </button>
        </span>
      </p>
    </div>
  </div>
</template>
