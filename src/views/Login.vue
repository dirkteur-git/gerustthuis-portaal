<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '../services/supabase'
import Logo from '../components/Logo.vue'

const router = useRouter()
const route = useRoute()
const redirectUrl = route.query.redirect || '/'
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const newPassword = ref('')
const confirmNewPassword = ref('')
const loading = ref(false)
const error = ref(null)
const success = ref(null)
// Modes: 'login' | 'register' | 'forgotPassword' | 'resetPassword'
const mode = ref('login')

// Listen for PASSWORD_RECOVERY event (user clicked reset link in email)
onMounted(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      mode.value = 'resetPassword'
      error.value = null
      success.value = null
    }
  })

  // Cleanup on unmount is handled by Vue's lifecycle
  return () => subscription?.unsubscribe()
})

async function handleLogin() {
  loading.value = true
  error.value = null

  try {
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })

    if (authError) {
      if (authError.message === 'Email not confirmed') {
        error.value = 'Je e-mailadres is nog niet bevestigd. Check je inbox voor de bevestigingsmail.'
      } else if (authError.message === 'Invalid login credentials') {
        error.value = 'Ongeldige inloggegevens'
      } else {
        error.value = authError.message
      }
      return
    }

    if (data.user) {
      router.push(redirectUrl)
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
      options: {
        emailRedirectTo: window.location.origin + '/login',
      },
    })

    if (authError) {
      error.value = authError.message
      return
    }

    if (data.user) {
      if (data.user.identities?.length === 0) {
        error.value = 'Dit e-mailadres is al geregistreerd'
      } else if (data.session) {
        // Direct ingelogd (email confirmatie uitgeschakeld)
        router.push(redirectUrl)
      } else {
        // Email confirmatie verstuurd
        success.value = 'We hebben een bevestigingsmail gestuurd naar ' + email.value + '. Klik op de link in de mail om je account te activeren.'
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

async function handleForgotPassword() {
  loading.value = true
  error.value = null
  success.value = null

  if (!email.value) {
    error.value = 'Vul je e-mailadres in'
    loading.value = false
    return
  }

  try {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.value, {
      redirectTo: window.location.origin + '/login',
    })

    if (resetError) {
      error.value = resetError.message
      return
    }

    success.value = 'Als dit e-mailadres bij ons bekend is, ontvang je binnen enkele minuten een link om je wachtwoord te herstellen.'
  } catch (e) {
    error.value = 'Er ging iets mis. Probeer het opnieuw.'
  } finally {
    loading.value = false
  }
}

async function handleResetPassword() {
  loading.value = true
  error.value = null
  success.value = null

  if (newPassword.value !== confirmNewPassword.value) {
    error.value = 'Wachtwoorden komen niet overeen'
    loading.value = false
    return
  }

  if (newPassword.value.length < 6) {
    error.value = 'Wachtwoord moet minimaal 6 tekens zijn'
    loading.value = false
    return
  }

  try {
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword.value,
    })

    if (updateError) {
      error.value = updateError.message
      return
    }

    success.value = 'Je wachtwoord is gewijzigd. Je wordt doorgestuurd...'
    setTimeout(() => {
      router.push('/')
    }, 2000)
  } catch (e) {
    error.value = 'Er ging iets mis. Probeer het opnieuw.'
  } finally {
    loading.value = false
  }
}

function switchMode(newMode) {
  mode.value = newMode
  error.value = null
  success.value = null
  password.value = ''
  confirmPassword.value = ''
  newPassword.value = ''
  confirmNewPassword.value = ''
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
    <div class="max-w-md w-full">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="flex justify-center mb-2">
          <Logo size="lg" />
        </div>
        <p class="text-gray-500 mt-1">Privacy-first thuismonitoring</p>
      </div>

      <!-- Card -->
      <div class="bg-white rounded-xl shadow-sm border p-8">

        <!-- ===== RESET PASSWORD MODE ===== -->
        <template v-if="mode === 'resetPassword'">
          <h2 class="text-xl font-semibold text-gray-900 mb-2">Nieuw wachtwoord instellen</h2>
          <p class="text-sm text-gray-500 mb-6">Kies een nieuw wachtwoord voor je account.</p>

          <form @submit.prevent="handleResetPassword()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Nieuw wachtwoord</label>
              <input
                v-model="newPassword"
                type="password"
                required
                autocomplete="new-password"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Minimaal 6 tekens"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Bevestig wachtwoord</label>
              <input
                v-model="confirmNewPassword"
                type="password"
                required
                autocomplete="new-password"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Herhaal wachtwoord"
              >
            </div>

            <div v-if="success" class="p-3 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-700">
              {{ success }}
            </div>
            <div v-if="error" class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {{ error }}
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {{ loading ? 'Bezig...' : 'Wachtwoord instellen' }}
            </button>
          </form>
        </template>

        <!-- ===== FORGOT PASSWORD MODE ===== -->
        <template v-else-if="mode === 'forgotPassword'">
          <h2 class="text-xl font-semibold text-gray-900 mb-2">Wachtwoord vergeten</h2>
          <p class="text-sm text-gray-500 mb-6">Vul je e-mailadres in. We sturen je een link om je wachtwoord te herstellen.</p>

          <form @submit.prevent="handleForgotPassword()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                v-model="email"
                type="email"
                required
                autocomplete="email"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="je@email.nl"
              >
            </div>

            <div v-if="success" class="p-3 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-700">
              {{ success }}
            </div>
            <div v-if="error" class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {{ error }}
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {{ loading ? 'Bezig...' : 'Verstuur reset link' }}
            </button>
          </form>

          <button @click="switchMode('login')" class="mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium">
            ← Terug naar inloggen
          </button>
        </template>

        <!-- ===== LOGIN / REGISTER MODE ===== -->
        <template v-else>
          <h2 class="text-xl font-semibold text-gray-900 mb-6">
            {{ mode === 'register' ? 'Account aanmaken' : 'Inloggen' }}
          </h2>

          <form @submit.prevent="mode === 'register' ? handleRegister() : handleLogin()" class="space-y-4">
            <!-- Email -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                v-model="email"
                type="email"
                required
                autocomplete="email"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="••••••••"
              >
              <!-- Forgot password link (only in login mode) -->
              <div v-if="mode === 'login'" class="text-right mt-1">
                <button type="button" @click="switchMode('forgotPassword')" class="text-sm text-primary-600 hover:text-primary-700">
                  Wachtwoord vergeten?
                </button>
              </div>
            </div>

            <!-- Confirm Password (register only) -->
            <div v-if="mode === 'register'">
              <label class="block text-sm font-medium text-gray-700 mb-1">Bevestig wachtwoord</label>
              <input
                v-model="confirmPassword"
                type="password"
                required
                autocomplete="new-password"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="••••••••"
              >
            </div>

            <!-- Email verification info (register mode) -->
            <div v-if="mode === 'register'" class="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              Na registratie ontvang je een bevestigingsmail. Klik op de link om je account te activeren.
            </div>

            <!-- Success -->
            <div v-if="success" class="p-3 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-700">
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
              class="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {{ loading ? 'Bezig...' : (mode === 'register' ? 'Account aanmaken' : 'Inloggen') }}
            </button>
          </form>
        </template>
      </div>

      <!-- Toggle Login/Register (not shown in forgotPassword or resetPassword) -->
      <p v-if="mode === 'login' || mode === 'register'" class="text-center text-sm text-gray-500 mt-6">
        <span v-if="mode === 'register'">
          Heb je al een account?
          <button @click="switchMode('login')" class="text-primary-600 hover:text-primary-700 font-medium">
            Inloggen
          </button>
        </span>
        <span v-else>
          Geen account?
          <button @click="switchMode('register')" class="text-primary-600 hover:text-primary-700 font-medium">
            Account aanmaken
          </button>
        </span>
      </p>
    </div>
  </div>
</template>
