import { supabase } from './client'
import { userState } from './state'

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function resetPasswordForEmail(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/login',
  })
  if (error) throw error
  return data
}

export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  userState.profile = null
  userState.households = []
  userState.currentHousehold = null
  userState.currentRole = null
  userState.loaded = false
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}
