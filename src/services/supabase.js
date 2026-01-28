import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}

// ============================================================
// Hue config functions
export async function getHueConfig() {
  // Get current user's email to filter config
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null

  const { data, error } = await supabase
    .from('hue_config')
    .select('*')
    .eq('user_email', user.email)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching hue config:', error)
  }
  return data
}

export async function saveHueConfig(config) {
  const { data, error } = await supabase
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
  let query = supabase
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
  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
  const { data: physicalDevices, error: physError } = await supabase
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
  const { data: standalone, error } = await supabase
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
  const { data, error } = await supabase
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
  const { data: physicalDevices, error: physError } = await supabase
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
  const { data: standalone, error } = await supabase
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
