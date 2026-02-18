import { createClient } from '@supabase/supabase-js'
import { reactive } from 'vue'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Schema-scoped helpers voor tabellen buiten public
export const activityDb = () => supabase.schema('activity')
export const integrationsDb = () => supabase.schema('integrations')

// ============================================================
// User state (reactive, shared across components)
// ============================================================

export const userState = reactive({
  profile: null,
  households: [],
  currentHousehold: null,
  currentRole: null,
  loaded: false,
})

// ============================================================
// Auth functions
// ============================================================

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
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
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  // Reset user state
  userState.profile = null
  userState.households = []
  userState.currentHousehold = null
  userState.currentRole = null
  userState.loaded = false
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}

// ============================================================
// User profile & household functions
// ============================================================

export async function loadUserProfile() {
  const user = await getCurrentUser()
  if (!user) return null

  // Load profile (may not exist yet if migration hasn't run)
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

  // Load households — RLS handles filtering automatically
  let households = []
  try {
    const { data: allHouseholds, error } = await supabase
      .from('households')
      .select('id, name, config_id')
      .order('name')

    if (!error && allHouseholds) {
      households = allHouseholds
    }
  } catch (e) {
    console.warn('households table not available yet:', e.message)
  }

  // Load membership roles for the current user
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

  // Attach role info to households
  const membershipMap = Object.fromEntries(
    memberships.map(m => [m.household_id, m.role])
  )
  userState.households = households.map(h => ({
    ...h,
    role: membershipMap[h.id] || null
  }))

  // Determine current household
  if (profile?.active_household_id) {
    userState.currentHousehold = userState.households.find(
      h => h.id === profile.active_household_id
    ) || userState.households[0] || null
  } else {
    userState.currentHousehold = userState.households[0] || null
  }

  // Determine role
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

  // Recalculate role
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

  // Also load display names from user_profiles
  const members = data || []
  const userIds = members.map(m => m.user?.id).filter(Boolean)

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, display_name')
      .in('id', userIds)

    const profileMap = Object.fromEntries(
      (profiles || []).map(p => [p.id, p])
    )

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
    .insert({
      household_id: householdId,
      invited_email: email,
      role,
      invited_by: user.id,
    })
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

// ============================================================
// Hue config functions
export async function getHueConfig() {
  // If we have an active household with a config_id, fetch that specific config
  const householdConfigId = userState.currentHousehold?.config_id
  if (householdConfigId) {
    const { data, error } = await integrationsDb()
      .from('hue_config')
      .select('*')
      .eq('id', householdConfigId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching hue config:', error)
    }
    return data
  }

  // Fallback: get the first accessible config (for users without household setup)
  const { data, error } = await integrationsDb()
    .from('hue_config')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error fetching hue config:', error)
  }
  return data
}

export async function saveHueConfig(config) {
  const { data, error } = await integrationsDb()
    .from('hue_config')
    .upsert(config, { onConflict: 'user_email' })
    .select()
    .single()

  if (error) {
    console.error('Error saving hue config:', error)
    throw error
  }
  return data
}

// Devices functions
export async function getDevices(type = null) {
  let query = integrationsDb()
    .from('hue_devices')
    .select('*')
    .order('name')

  if (type) {
    query = query.eq('device_type', type)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching devices:', error)
  }
  return data || []
}

export async function getLights() {
  return getDevices('light')
}

export async function getSensors() {
  const { data, error } = await integrationsDb()
    .from('hue_devices')
    .select('*')
    .neq('device_type', 'light')
    .order('name')

  if (error) {
    console.error('Error fetching sensors:', error)
  }
  return data || []
}

// Physical devices (grouped sensors like Hue motion sensor)
export async function getPhysicalDevices() {
  const { data, error } = await integrationsDb()
    .from('physical_devices')
    .select(`
      *,
      capabilities:hue_devices(
        id,
        hue_unique_id,
        device_type,
        name,
        last_state,
        last_state_at
      )
    `)
    .order('name')

  if (error) {
    console.error('Error fetching physical devices:', error)
  }
  return data || []
}

// Get all sensors: physical devices (grouped) + standalone sensors
export async function getAllSensors() {
  // Get physical devices with their motion sensor data
  const { data: physicalDevices, error: physError } = await integrationsDb()
    .from('physical_devices')
    .select(`
      *,
      motion_sensor:hue_devices!physical_device_id(
        id,
        device_type,
        last_state,
        last_state_at
      )
    `)
    .order('name')

  if (physError) {
    console.error('Error fetching physical devices:', physError)
  }

  // Get standalone sensors (not linked to a physical device, excluding temperature/light sensors)
  const { data: standalone, error } = await integrationsDb()
    .from('hue_devices')
    .select('*')
    .neq('device_type', 'light')
    .is('physical_device_id', null)
    .order('name')

  if (error) {
    console.error('Error fetching standalone sensors:', error)
  }

  // Transform physical devices to unified format
  const groupedSensors = (physicalDevices || []).map(p => {
    // motion_sensor is an array due to the FK relation
    const motionSensor = p.motion_sensor?.find(s => s.device_type === 'motion_sensor')
    return {
      id: p.id,
      name: p.name,
      room_name: p.room_name,
      device_type: 'physical_device', // Marker for UI
      battery_level: p.battery_level,
      battery_updated_at: p.battery_updated_at,
      // State now comes from motion_sensor's last_state which includes temp/light
      last_state: motionSensor?.last_state || {},
      last_state_at: motionSensor?.last_state_at || null,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }
  })

  return [...groupedSensors, ...(standalone || [])]
}

export async function getRooms() {
  const { data, error } = await integrationsDb()
    .from('hue_devices')
    .select('room_name')
    .not('room_name', 'is', null)

  if (error) {
    console.error('Error fetching rooms:', error)
  }

  // Get unique room names
  const rooms = [...new Set(data?.map(d => d.room_name) || [])]
  return rooms.filter(Boolean).sort()
}

export async function getDevicesByRoom(roomName) {
  // Get physical devices for this room with their motion sensor data
  const { data: physicalDevices, error: physError } = await integrationsDb()
    .from('physical_devices')
    .select(`
      *,
      motion_sensor:hue_devices!physical_device_id(
        id,
        device_type,
        last_state,
        last_state_at
      )
    `)
    .eq('room_name', roomName)

  if (physError) {
    console.error('Error fetching physical devices by room:', physError)
  }

  // Get standalone devices (lights, contact_sensors, buttons - not linked to physical device)
  const { data: standalone, error } = await integrationsDb()
    .from('hue_devices')
    .select('*')
    .eq('room_name', roomName)
    .is('physical_device_id', null)
    .order('device_type')

  if (error) {
    console.error('Error fetching devices by room:', error)
  }

  // Transform physical devices to unified format
  const groupedDevices = (physicalDevices || []).map(p => {
    const motionSensor = p.motion_sensor?.find(s => s.device_type === 'motion_sensor')
    return {
      id: p.id,
      name: p.name,
      room_name: p.room_name,
      device_type: 'physical_device',
      battery_level: p.battery_level,
      // State now comes from motion_sensor's last_state which includes temp/light
      last_state: motionSensor?.last_state || {},
    }
  })

  return [...(standalone || []), ...groupedDevices]
}

// Raw events
export async function getRecentEvents(limit = 50) {
  const { data, error } = await supabase
    .from('raw_events')
    .select(`
      *,
      hue_devices (name, device_type, room_name)
    `)
    .order('recorded_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching events:', error)
  }
  return data || []
}
