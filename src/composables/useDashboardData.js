import { ref } from 'vue'
import { activityDb, integrationsDb } from '../services/client'
import { toLocalDateKey, calculateDayStart, formatMinutesToTime, avg } from './useDataQuality'

export function useDashboardData() {
  const heatmapData = ref([])
  const recentActivity = ref([])
  const todayStats = ref(null)
  const averageStats = ref(null)
  const historicalDays = ref([])
  const offlineSensors = ref([])

  async function loadTodayStats() {
    const today = toLocalDateKey(new Date())

    const { data, error } = await activityDb()
      .from('daily_activity_stats')
      .select('*')
      .eq('date', today)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading today stats:', error)
    }

    if (data) {
      const { data: lastEvent } = await activityDb()
        .from('activity_events')
        .select('recorded_at')
        .gte('recorded_at', `${today}T00:00:00`)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single()

      todayStats.value = {
        totalEvents: data.total_events || 0,
        firstActivity: data.first_activity,
        lastActivity: data.last_activity,
        lastTimestamp: lastEvent?.recorded_at,
        activeHours: data.active_hours || 0,
        roomsActive: data.rooms_active || 0,
        longestGapMinutes: data.longest_gap_minutes || 0,
        nightEvents: data.night_events || 0,
        eventsPerHour: data.events_per_hour || Array(24).fill(0),
      }
    } else {
      const { data: events } = await activityDb()
        .from('activity_events')
        .select('recorded_at')
        .gte('recorded_at', `${today}T00:00:00`)
        .order('recorded_at', { ascending: true })

      if (events && events.length > 0) {
        const firstEvent = new Date(events[0].recorded_at)
        const lastEvent = new Date(events[events.length - 1].recorded_at)
        const eventsPerHour = Array(24).fill(0)
        events.forEach(e => { eventsPerHour[new Date(e.recorded_at).getHours()]++ })

        todayStats.value = {
          totalEvents: events.length,
          firstActivity: `${String(firstEvent.getHours()).padStart(2, '0')}:${String(firstEvent.getMinutes()).padStart(2, '0')}`,
          lastActivity: `${String(lastEvent.getHours()).padStart(2, '0')}:${String(lastEvent.getMinutes()).padStart(2, '0')}`,
          lastTimestamp: events[events.length - 1].recorded_at,
          activeHours: 0, roomsActive: 0, longestGapMinutes: 0, nightEvents: 0, eventsPerHour,
        }
      } else {
        todayStats.value = {
          totalEvents: 0, firstActivity: null, lastActivity: null, lastTimestamp: null,
          activeHours: 0, roomsActive: 0, longestGapMinutes: 0, nightEvents: 0,
          eventsPerHour: Array(24).fill(0),
        }
      }
    }
  }

  async function loadAverageStats() {
    const today = new Date()
    const fourteenDaysAgo = new Date(today)
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    const { data, error } = await activityDb()
      .from('daily_activity_stats')
      .select('*')
      .gte('date', toLocalDateKey(fourteenDaysAgo))
      .lt('date', toLocalDateKey(today))

    if (error) { console.error('Error loading average stats:', error); return }

    if (data && data.length > 0) {
      historicalDays.value = data.filter(d => d.total_events > 0)
      const totalEvents = data.reduce((sum, d) => sum + (d.total_events || 0), 0) / data.length
      const dayStarts = data.map(d => calculateDayStart(d.events_per_hour)).filter(v => v !== null)
      const avgDayStartMinutes = dayStarts.length > 0
        ? dayStarts.reduce((a, b) => a + b, 0) / dayStarts.length
        : null

      averageStats.value = {
        totalEvents: Math.round(totalEvents),
        avgDayStart: formatMinutesToTime(avgDayStartMinutes),
        daysCount: data.length,
      }
    } else {
      historicalDays.value = []
      averageStats.value = { totalEvents: 0, avgDayStart: null, daysCount: 0 }
    }
  }

  async function loadHeatmapData() {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const { data, error } = await activityDb()
      .from('room_activity_hourly')
      .select('room_name, hour, total_events')
      .gte('hour', sevenDaysAgo.toISOString())

    if (error) { console.error('Error fetching heatmap data:', error); return }

    const dayMap = new Map()
    for (let i = 0; i < 7; i++) {
      const date = new Date()
      date.setDate(date.getDate() - 6 + i)
      const dateKey = toLocalDateKey(date)
      const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, rooms: {} }))
      dayMap.set(dateKey, { date: dateKey, hours })
    }

    const now = new Date()
    const currentHourTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime()

    for (const row of data || []) {
      const eventDate = new Date(row.hour)
      if (eventDate.getTime() >= currentHourTimestamp) continue

      const dateKey = toLocalDateKey(eventDate)
      const hourOfDay = eventDate.getHours()
      const day = dayMap.get(dateKey)
      if (day) {
        day.hours[hourOfDay].count += row.total_events || 0
        if (row.room_name) {
          day.hours[hourOfDay].rooms[row.room_name] =
            (day.hours[hourOfDay].rooms[row.room_name] || 0) + (row.total_events || 0)
        }
      }
    }

    heatmapData.value = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  }

  async function loadRecentActivity() {
    const { data, error } = await activityDb()
      .from('activity_events')
      .select('room_name, device_type, recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(50)

    if (error) { console.error('Error loading recent activity:', error); return }
    recentActivity.value = data || []
  }

  async function loadOfflineSensors() {
    const ninetyMinutesAgo = new Date(Date.now() - 90 * 60 * 1000).toISOString()

    const { data, error } = await integrationsDb()
      .from('hue_devices')
      .select('name, room_name, last_state_at')
      .in('device_type', ['motion_sensor', 'contact_sensor'])
      .or(`last_state_at.is.null,last_state_at.lt.${ninetyMinutesAgo}`)

    if (error) { console.error('Error loading offline sensors:', error); return }
    offlineSensors.value = data || []
  }

  async function refreshAllData() {
    await Promise.all([
      loadTodayStats(),
      loadAverageStats(),
      loadHeatmapData(),
      loadRecentActivity(),
      loadOfflineSensors(),
    ])
  }

  return {
    heatmapData, recentActivity, todayStats, averageStats, historicalDays, offlineSensors,
    refreshAllData,
  }
}
