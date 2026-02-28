import { integrationsDb } from './client'
import { userState } from './state'

export async function getHueConfig() {
  const householdConfigId = userState.currentHousehold?.config_id
  if (householdConfigId) {
    const { data, error } = await integrationsDb()
      .from('hue_config')
      .select('*')
      .eq('id', householdConfigId)
      .maybeSingle()
    if (error) console.error('Error fetching hue config:', error)
    return data
  }

  // Fallback: eerste toegankelijke config (gebruiker zonder household setup)
  const { data, error } = await integrationsDb()
    .from('hue_config')
    .select('*')
    .limit(1)
    .maybeSingle()
  if (error) console.error('Error fetching hue config:', error)
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

export async function getDevices(type = null) {
  let query = integrationsDb().from('hue_devices').select('*').order('name')
  if (type) query = query.eq('device_type', type)

  const { data, error } = await query
  if (error) console.error('Error fetching devices:', error)
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
  if (error) console.error('Error fetching sensors:', error)
  return data || []
}

export async function getPhysicalDevices() {
  const { data, error } = await integrationsDb()
    .from('physical_devices')
    .select(`
      *,
      capabilities:hue_devices(
        id, hue_unique_id, device_type, name, last_state, last_state_at
      )
    `)
    .order('name')
  if (error) console.error('Error fetching physical devices:', error)
  return data || []
}

export async function getAllSensors() {
  const { data: physicalDevices, error: physError } = await integrationsDb()
    .from('physical_devices')
    .select(`
      *,
      motion_sensor:hue_devices!physical_device_id(
        id, device_type, last_state, last_state_at
      )
    `)
    .order('name')
  if (physError) console.error('Error fetching physical devices:', physError)

  const { data: standalone, error } = await integrationsDb()
    .from('hue_devices')
    .select('*')
    .neq('device_type', 'light')
    .is('physical_device_id', null)
    .order('name')
  if (error) console.error('Error fetching standalone sensors:', error)

  const groupedSensors = (physicalDevices || []).map(p => {
    const motionSensor = p.motion_sensor?.find(s => s.device_type === 'motion_sensor')
    return {
      id: p.id,
      name: p.name,
      room_name: p.room_name,
      device_type: 'physical_device',
      battery_level: p.battery_level,
      battery_updated_at: p.battery_updated_at,
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
  if (error) console.error('Error fetching rooms:', error)
  return [...new Set(data?.map(d => d.room_name) || [])].filter(Boolean).sort()
}

export async function getDevicesByRoom(roomName) {
  const { data: physicalDevices, error: physError } = await integrationsDb()
    .from('physical_devices')
    .select(`
      *,
      motion_sensor:hue_devices!physical_device_id(
        id, device_type, last_state, last_state_at
      )
    `)
    .eq('room_name', roomName)
  if (physError) console.error('Error fetching physical devices by room:', physError)

  const { data: standalone, error } = await integrationsDb()
    .from('hue_devices')
    .select('*')
    .eq('room_name', roomName)
    .is('physical_device_id', null)
    .order('device_type')
  if (error) console.error('Error fetching devices by room:', error)

  const groupedDevices = (physicalDevices || []).map(p => {
    const motionSensor = p.motion_sensor?.find(s => s.device_type === 'motion_sensor')
    return {
      id: p.id,
      name: p.name,
      room_name: p.room_name,
      device_type: 'physical_device',
      battery_level: p.battery_level,
      last_state: motionSensor?.last_state || {},
    }
  })

  return [...(standalone || []), ...groupedDevices]
}
