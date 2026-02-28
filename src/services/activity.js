import { supabase } from './client'

export async function getRecentEvents(limit = 50) {
  const { data, error } = await supabase
    .from('raw_events')
    .select(`
      *,
      hue_devices (name, device_type, room_name)
    `)
    .order('recorded_at', { ascending: false })
    .limit(limit)

  if (error) console.error('Error fetching events:', error)
  return data || []
}
