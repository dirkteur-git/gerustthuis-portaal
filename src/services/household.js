import { supabase } from './client'
import { getCurrentUser } from './auth'
import { userState } from './state'

export async function loadUserProfile() {
  const user = await getCurrentUser()
  if (!user) return null

  let profile = null
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    if (!error) profile = data
  } catch (e) {
    console.warn('user_profiles table not available yet:', e.message)
  }

  userState.profile = profile

  let households = []
  try {
    const { data: allHouseholds, error } = await supabase
      .from('households')
      .select('id, name, config_id')
      .order('name')
    if (!error && allHouseholds) households = allHouseholds
  } catch (e) {
    console.warn('households table not available yet:', e.message)
  }

  let memberships = []
  try {
    const { data, error } = await supabase
      .from('household_members')
      .select('household_id, role')
      .eq('user_id', user.id)
    if (!error && data) memberships = data
  } catch (e) {
    // table not available yet
  }

  const membershipMap = Object.fromEntries(memberships.map(m => [m.household_id, m.role]))
  userState.households = households.map(h => ({ ...h, role: membershipMap[h.id] || null }))

  if (profile?.active_household_id) {
    userState.currentHousehold =
      userState.households.find(h => h.id === profile.active_household_id) ||
      userState.households[0] ||
      null
  } else {
    userState.currentHousehold = userState.households[0] || null
  }

  if (userState.currentHousehold) {
    userState.currentRole = membershipMap[userState.currentHousehold.id] || 'admin'
  } else {
    userState.currentRole = 'admin'
  }

  userState.loaded = true
  return profile
}

export function isAdmin() {
  return userState.currentRole === 'admin'
}

export function getCurrentRole() {
  return userState.currentRole
}

export function getCurrentHouseholdId() {
  return userState.currentHousehold?.id || null
}

export async function switchHousehold(householdId) {
  const user = await getCurrentUser()
  if (!user) return

  await supabase
    .from('user_profiles')
    .update({ active_household_id: householdId })
    .eq('id', user.id)

  userState.currentHousehold = userState.households.find(h => h.id === householdId) || null

  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', householdId)
    .eq('user_id', user.id)
    .single()
  userState.currentRole = membership?.role || null
}

export async function getAllHouseholds() {
  const { data, error } = await supabase
    .from('households')
    .select('id, name, config_id')
    .order('name')
  if (error) console.error('Error fetching households:', error)
  return data || []
}

export async function getHouseholdMembers(householdId) {
  const { data, error } = await supabase
    .from('household_members')
    .select(`
      id, role, created_at,
      user:user_id(id, email:raw_user_meta_data)
    `)
    .eq('household_id', householdId)

  if (error) console.error('Error fetching household members:', error)

  const members = data || []
  const userIds = members.map(m => m.user?.id).filter(Boolean)

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, display_name')
      .in('id', userIds)

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    return members.map(m => ({
      id: m.id,
      user_id: m.user?.id,
      email: m.user?.email?.email || m.user?.id,
      display_name: profileMap[m.user?.id]?.display_name || null,
      role: m.role,
      created_at: m.created_at,
    }))
  }

  return members
}

export async function inviteToHousehold(householdId, email, role = 'viewer') {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('household_invitations')
    .insert({ household_id: householdId, invited_email: email, role, invited_by: user.id })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function acceptInvitation(token) {
  const { data, error } = await supabase
    .rpc('accept_household_invitation', { p_token: token })
  if (error) throw error
  return data
}

export async function removeMember(memberId) {
  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('id', memberId)
  if (error) throw error
}

export async function getHouseholdInvitations(householdId) {
  const { data, error } = await supabase
    .from('household_invitations')
    .select('*')
    .eq('household_id', householdId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) console.error('Error fetching invitations:', error)
  return data || []
}
