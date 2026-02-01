<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '../services/supabase'
import {
  MINIMUM_DAYS_REQUIRED,
  calculateDayStart,
  formatMinutesToTime,
  toLocalDateKey,
  timeToMinutes
} from '../composables/useDataQuality'

// Data
const loading = ref(true)
const heatmapData = ref([])
const recentActivity = ref([])
const todayStats = ref(null)
const averageStats = ref(null)
const offlineSensors = ref([])

// Heatmap hover state
const heatmapHover = ref(null) // { day, hour, count, x, y }

// Computed: Status bepaling (Wisdom niveau)
const statusInfo = computed(() => {
  // Minimaal MINIMUM_DAYS_REQUIRED dagen data nodig voor betrouwbare meting
  if (!todayStats.value || !averageStats.value || averageStats.value.daysCount < MINIMUM_DAYS_REQUIRED) {
    const daysCount = averageStats.value?.daysCount || 0
    return {
      level: 'unknown',
      color: 'gray',
      title: 'We leren nog',
      subtitle: daysCount > 0
        ? `${daysCount} dagen beschikbaar, minimaal ${MINIMUM_DAYS_REQUIRED} nodig`
        : 'Nog geen data beschikbaar'
    }
  }

  const today = todayStats.value
  const avg = averageStats.value

  // Geen activiteit vandaag terwijl we wel activiteit verwachten
  if (today.totalEvents === 0 && avg.totalEvents > 10) {
    return {
      level: 'concern',
      color: 'amber',
      title: 'Erg rustig',
      subtitle: 'Nog geen activiteit vandaag, misschien even checken'
    }
  }

  // Veel minder dan normaal (< 50% van gemiddelde)
  const ratio = today.totalEvents / Math.max(avg.totalEvents, 1)
  if (ratio < 0.5 && today.totalEvents < 20) {
    return {
      level: 'attention',
      color: 'amber',
      title: 'Rustige dag',
      subtitle: 'Minder activiteit dan normaal'
    }
  }

  // Meer dan normaal (> 150% van gemiddelde)
  if (ratio > 1.5) {
    return {
      level: 'active',
      color: 'green',
      title: 'Actieve dag',
      subtitle: 'Meer activiteit dan normaal'
    }
  }

  // Normaal
  return {
    level: 'normal',
    color: 'green',
    title: 'Normale dag',
    subtitle: 'Vergelijkbaar met vorige week'
  }
})

// Computed: Eerste activiteit / dagstart info (Information + Knowledge)
// Gebruik dagstart cluster detectie ipv eerste event
const firstActivityInfo = computed(() => {
  // Bereken dagstart uit events_per_hour
  const dayStartMinutes = todayStats.value?.eventsPerHour
    ? calculateDayStart(todayStats.value.eventsPerHour)
    : null

  if (dayStartMinutes === null) {
    const avgTime = averageStats.value?.avgDayStart
    if (avgTime) {
      return {
        title: 'Nog niet op',
        subtitle: `Normaal rond ${avgTime}`
      }
    }
    return {
      title: 'Nog niet op',
      subtitle: 'Wacht op dagactiviteit'
    }
  }

  const dayStartTime = formatMinutesToTime(dayStartMinutes)
  const avgDayStartMinutes = averageStats.value?.avgDayStart
    ? timeToMinutes(averageStats.value.avgDayStart)
    : null

  let subtitle = ''
  if (avgDayStartMinutes !== null) {
    const diffMinutes = dayStartMinutes - avgDayStartMinutes
    if (Math.abs(diffMinutes) < 30) {
      subtitle = 'Normaal voor haar'
    } else if (diffMinutes > 30) {
      subtitle = 'Later dan normaal'
    } else {
      subtitle = 'Vroeger dan normaal'
    }
  }

  return {
    title: `Op sinds ${dayStartTime}`,
    subtitle
  }
})

// Computed: Laatste activiteit info (Information + Knowledge)
// Gebruik recentActivity voor real-time data, niet daily_activity_stats
const lastActivityInfo = computed(() => {
  // Gebruik de meest recente event uit recentActivity (die is real-time)
  const lastEvent = recentActivity.value[0]

  if (!lastEvent) {
    return {
      title: 'Geen activiteit',
      subtitle: 'Vandaag nog niets gezien'
    }
  }

  const lastDate = new Date(lastEvent.recorded_at)
  const now = new Date()
  const diffMs = now.getTime() - lastDate.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  let timeAgo = ''
  if (diffMinutes < 1) {
    timeAgo = 'Zojuist'
  } else if (diffMinutes < 60) {
    timeAgo = `${diffMinutes} ${diffMinutes === 1 ? 'minuut' : 'minuten'} geleden`
  } else {
    const diffHours = Math.floor(diffMinutes / 60)
    timeAgo = `${diffHours} ${diffHours === 1 ? 'uur' : 'uur'} geleden`
  }

  const lastTime = `${String(lastDate.getHours()).padStart(2, '0')}:${String(lastDate.getMinutes()).padStart(2, '0')}`

  return {
    title: `Laatste teken ${lastTime}`,
    subtitle: timeAgo
  }
})

// Kamers die we niet tonen (nog niet in gebruik)
const hiddenRooms = ['Toilet', 'Tuin']

// Computed: Gegroepeerde recente activiteit (unieke kamers)
const groupedRecentActivity = computed(() => {
  const seen = new Set()
  const result = []

  for (const activity of recentActivity.value) {
    // Skip verborgen kamers
    if (hiddenRooms.includes(activity.room_name)) continue

    // Skip als we deze kamer al hebben gezien
    if (seen.has(activity.room_name)) continue

    seen.add(activity.room_name)
    result.push(activity)

    // Max 5 unieke kamers
    if (result.length >= 5) break
  }

  return result
})

// Computed: Heatmap max voor kleurbereik
const maxCount = computed(() => {
  let max = 0
  heatmapData.value.forEach(day => {
    day.hours.forEach(hour => {
      if (hour.count > max) max = hour.count
    })
  })
  return max || 1
})

// Methods
function formatTime(time) {
  if (!time) return ''
  // time kan "HH:MM:SS" of Date object zijn
  if (typeof time === 'string') {
    return time.slice(0, 5) // "HH:MM"
  }
  return `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr)
  const days = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
  return days[d.getDay()]
}

function getHeatmapColor(count) {
  if (count === 0) return 'bg-gray-100'
  const intensity = count / maxCount.value
  if (intensity < 0.25) return 'bg-emerald-100'
  if (intensity < 0.5) return 'bg-emerald-300'
  if (intensity < 0.75) return 'bg-emerald-500'
  return 'bg-emerald-700'
}

function formatActivityTime(timestamp) {
  const d = new Date(timestamp)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function getActivityIcon(deviceType) {
  switch (deviceType) {
    case 'motion_sensor': return 'Beweging'
    case 'contact_sensor': return 'Deur'
    case 'light': return 'Lamp'
    default: return 'Activiteit'
  }
}


// Format datum voor tooltip: "Do 30 jan, 14:00"
function formatHoverDate(dateStr, hourNum) {
  const d = new Date(dateStr)
  const days = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}, ${String(hourNum).padStart(2, '0')}:00`
}

// Heatmap hover handlers
function handleHeatmapHover(event, day, hour) {
  // Sorteer kamers op activiteit (hoogste eerst)
  const roomEntries = Object.entries(hour.rooms || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5) // Max 5 kamers tonen

  // 6 stappen: 0=0%, 1-2=17%, 3-4=33%, 5-6=50%, 7-8=67%, 9-10=83%, 11+=100%
  function getBarWidth(count) {
    if (count === 0) return 0
    if (count <= 2) return 17
    if (count <= 4) return 33
    if (count <= 6) return 50
    if (count <= 8) return 67
    if (count <= 10) return 83
    return 100
  }

  // Get position from touch or mouse event
  const clientX = event.touches ? event.touches[0].clientX : event.clientX
  const clientY = event.touches ? event.touches[0].clientY : event.clientY

  // Calculate position with bounds checking
  const tooltipWidth = 200
  const tooltipHeight = 120
  let x = clientX + 12
  let y = clientY - 10

  // Keep tooltip within viewport
  if (x + tooltipWidth > window.innerWidth) {
    x = clientX - tooltipWidth - 12
  }
  if (y + tooltipHeight > window.innerHeight) {
    y = window.innerHeight - tooltipHeight - 10
  }
  if (y < 10) y = 10

  heatmapHover.value = {
    dateLabel: formatHoverDate(day.date, hour.hour),
    rooms: roomEntries.map(([name, count]) => ({
      name,
      count,
      barWidth: getBarWidth(count)
    })),
    x,
    y
  }
}

function handleHeatmapLeave() {
  heatmapHover.value = null
}

// Data loading
async function loadTodayStats() {
  const today = toLocalDateKey(new Date())

  // Haal vandaag's stats uit daily_activity_stats
  const { data, error } = await supabase
    .from('daily_activity_stats')
    .select('*')
    .eq('date', today)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error loading today stats:', error)
  }

  if (data) {
    // Haal ook de laatste event timestamp
    const { data: lastEvent } = await supabase
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
      eventsPerHour: data.events_per_hour || Array(24).fill(0)
    }
  } else {
    // Geen data voor vandaag - check activity_events direct
    const { data: events } = await supabase
      .from('activity_events')
      .select('recorded_at')
      .gte('recorded_at', `${today}T00:00:00`)
      .order('recorded_at', { ascending: true })

    if (events && events.length > 0) {
      const firstEvent = new Date(events[0].recorded_at)
      const lastEvent = new Date(events[events.length - 1].recorded_at)

      // Bouw events_per_hour array uit ruwe events
      const eventsPerHour = Array(24).fill(0)
      events.forEach(e => {
        const hour = new Date(e.recorded_at).getHours()
        eventsPerHour[hour]++
      })

      todayStats.value = {
        totalEvents: events.length,
        firstActivity: `${String(firstEvent.getHours()).padStart(2, '0')}:${String(firstEvent.getMinutes()).padStart(2, '0')}`,
        lastActivity: `${String(lastEvent.getHours()).padStart(2, '0')}:${String(lastEvent.getMinutes()).padStart(2, '0')}`,
        lastTimestamp: events[events.length - 1].recorded_at,
        activeHours: 0,
        roomsActive: 0,
        eventsPerHour
      }
    } else {
      todayStats.value = {
        totalEvents: 0,
        firstActivity: null,
        lastActivity: null,
        lastTimestamp: null,
        activeHours: 0,
        roomsActive: 0,
        eventsPerHour: Array(24).fill(0)
      }
    }
  }
}

async function loadAverageStats() {
  // Bereken gemiddelden van laatste 14 dagen (excl vandaag) - consistent met Patronen
  const today = new Date()
  const fourteenDaysAgo = new Date(today)
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const { data, error } = await supabase
    .from('daily_activity_stats')
    .select('total_events, first_activity, last_activity, events_per_hour')
    .gte('date', toLocalDateKey(fourteenDaysAgo))
    .lt('date', toLocalDateKey(today))

  if (error) {
    console.error('Error loading average stats:', error)
    return
  }

  if (data && data.length > 0) {
    const totalEvents = data.reduce((sum, d) => sum + (d.total_events || 0), 0) / data.length

    // Gemiddelde eerste activiteit tijd (oude methode, voor fallback)
    const firstTimes = data.filter(d => d.first_activity).map(d => timeToMinutes(d.first_activity))
    const avgFirstMinutes = firstTimes.length > 0
      ? firstTimes.reduce((a, b) => a + b, 0) / firstTimes.length
      : null

    // Gemiddelde dagstart uit events_per_hour (nieuwe methode)
    const dayStarts = data
      .map(d => calculateDayStart(d.events_per_hour))
      .filter(v => v !== null)
    const avgDayStartMinutes = dayStarts.length > 0
      ? dayStarts.reduce((a, b) => a + b, 0) / dayStarts.length
      : null

    averageStats.value = {
      totalEvents: Math.round(totalEvents),
      avgFirstActivity: formatMinutesToTime(avgFirstMinutes),
      avgDayStart: formatMinutesToTime(avgDayStartMinutes),
      daysCount: data.length
    }
  } else {
    averageStats.value = {
      totalEvents: 0,
      avgFirstActivity: null,
      avgDayStart: null,
      daysCount: 0
    }
  }
}

async function loadHeatmapData() {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('room_activity_hourly')
    .select('room_name, hour, total_events')
    .gte('hour', sevenDaysAgo.toISOString())

  if (error) {
    console.error('Error fetching heatmap data:', error)
    return
  }

  // Initialize 7 days with 24 hours each
  const dayMap = new Map()
  for (let i = 0; i < 7; i++) {
    const date = new Date()
    date.setDate(date.getDate() - 6 + i)
    const dateKey = toLocalDateKey(date)
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, rooms: {} }))
    dayMap.set(dateKey, { date: dateKey, hours })
  }

  // Aggregate events per room per hour
  for (const row of data || []) {
    const eventDate = new Date(row.hour)
    const dateKey = toLocalDateKey(eventDate)
    const hourOfDay = eventDate.getHours()

    const day = dayMap.get(dateKey)
    if (day) {
      day.hours[hourOfDay].count += row.total_events || 0
      // Track per room
      if (row.room_name) {
        day.hours[hourOfDay].rooms[row.room_name] =
          (day.hours[hourOfDay].rooms[row.room_name] || 0) + (row.total_events || 0)
      }
    }
  }

  heatmapData.value = Array.from(dayMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  )
}

async function loadRecentActivity() {
  // Haal meer events op zodat we genoeg unieke kamers hebben
  const { data, error } = await supabase
    .from('activity_events')
    .select('room_name, device_type, recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error loading recent activity:', error)
    return
  }

  recentActivity.value = data || []
}

async function loadOfflineSensors() {
  const ninetyMinutesAgo = new Date(Date.now() - 90 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('hue_devices')
    .select('name, room_name, last_state_at')
    .in('device_type', ['motion_sensor', 'contact_sensor'])
    .or(`last_state_at.is.null,last_state_at.lt.${ninetyMinutesAgo}`)

  if (error) {
    console.error('Error loading offline sensors:', error)
    return
  }

  offlineSensors.value = data || []
}

let refreshInterval = null

async function refreshAllData() {
  await Promise.all([
    loadTodayStats(),
    loadAverageStats(),
    loadHeatmapData(),
    loadRecentActivity(),
    loadOfflineSensors()
  ])
}

onMounted(async () => {
  try {
    await refreshAllData()
    refreshInterval = setInterval(refreshAllData, 5 * 60 * 1000)
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<template>
  <div class="space-y-4" style="max-width: 1400px;">
    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-lg border p-12 text-center">
      <div class="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
      <p class="text-gray-500">Laden...</p>
    </div>

    <template v-else>
      <!-- Status Banner (Wisdom) -->
      <div
        class="rounded-lg p-5"
        :class="{
          'bg-emerald-50 border border-emerald-200': statusInfo.color === 'green',
          'bg-amber-50 border border-amber-200': statusInfo.color === 'amber',
          'bg-red-50 border border-red-200': statusInfo.color === 'red',
          'bg-gray-50 border border-gray-200': statusInfo.color === 'gray'
        }"
      >
        <div class="flex items-center gap-3">
          <!-- Status indicator -->
          <div
            class="w-3 h-3 rounded-full"
            :class="{
              'bg-emerald-500': statusInfo.color === 'green',
              'bg-amber-500': statusInfo.color === 'amber',
              'bg-red-500': statusInfo.color === 'red',
              'bg-gray-400': statusInfo.color === 'gray'
            }"
          ></div>
          <div>
            <h1
              class="text-lg font-semibold"
              :class="{
                'text-emerald-900': statusInfo.color === 'green',
                'text-amber-900': statusInfo.color === 'amber',
                'text-red-900': statusInfo.color === 'red',
                'text-gray-900': statusInfo.color === 'gray'
              }"
            >
              {{ statusInfo.title }}
            </h1>
            <p
              class="text-sm"
              :class="{
                'text-emerald-700': statusInfo.color === 'green',
                'text-amber-700': statusInfo.color === 'amber',
                'text-red-700': statusInfo.color === 'red',
                'text-gray-600': statusInfo.color === 'gray'
              }"
            >
              {{ statusInfo.subtitle }}
            </p>
          </div>
        </div>
      </div>

      <!-- KPI Card: Laatste activiteit -->
      <div class="bg-white border border-gray-200 rounded-lg p-5">
        <p class="text-lg font-semibold text-gray-900">{{ lastActivityInfo.title }}</p>
        <p class="text-sm text-gray-500 mt-1">{{ lastActivityInfo.subtitle }}</p>
      </div>

      <!-- Heatmap (Information - visueel) -->
      <div class="bg-white border border-gray-200 rounded-lg p-5">
        <div class="mb-4">
          <h2 class="text-base font-semibold text-gray-900">Activiteit</h2>
          <p class="text-sm text-gray-500">Afgelopen 7 dagen</p>
        </div>

        <div v-if="heatmapData.length === 0" class="text-center py-8 text-gray-400">
          Nog geen data beschikbaar
        </div>
        <div v-else>
          <!-- Heatmap Grid - geen uur labels -->
          <div class="space-y-1">
            <div v-for="day in heatmapData" :key="day.date" class="flex items-center gap-2">
              <div class="w-8 text-xs text-gray-400 text-right">
                {{ formatDayLabel(day.date) }}
              </div>
              <div class="flex-1 flex gap-0.5">
                <div
                  v-for="hour in day.hours"
                  :key="hour.hour"
                  :class="[
                    'flex-1 h-6 md:h-4 rounded-sm cursor-pointer hover:ring-2 hover:ring-emerald-400 hover:ring-offset-1',
                    getHeatmapColor(hour.count)
                  ]"
                  @mouseenter="handleHeatmapHover($event, day, hour)"
                  @mouseleave="handleHeatmapLeave"
                  @touchstart.passive="handleHeatmapHover($event, day, hour)"
                  @touchend="handleHeatmapLeave"
                ></div>
              </div>
            </div>
          </div>

          <!-- Legenda zonder getallen -->
          <div class="flex justify-end items-center gap-1.5 mt-4 text-xs text-gray-400">
            <span>Rustig</span>
            <div class="flex gap-0.5">
              <div class="w-3 h-3 rounded-sm bg-gray-100"></div>
              <div class="w-3 h-3 rounded-sm bg-emerald-100"></div>
              <div class="w-3 h-3 rounded-sm bg-emerald-300"></div>
              <div class="w-3 h-3 rounded-sm bg-emerald-500"></div>
              <div class="w-3 h-3 rounded-sm bg-emerald-700"></div>
            </div>
            <span>Actief</span>
          </div>
        </div>
      </div>

      <!-- Recente activiteit (Information) -->
      <div class="bg-white border border-gray-200 rounded-lg p-5">
        <h2 class="text-base font-semibold text-gray-900 mb-4">Recente activiteit</h2>

        <div v-if="groupedRecentActivity.length === 0" class="text-center py-4 text-gray-400">
          Nog geen activiteit vandaag
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="(activity, index) in groupedRecentActivity"
            :key="index"
            class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
          >
            <div class="flex items-center gap-3">
              <span class="text-sm font-medium text-gray-500 w-12">
                {{ formatActivityTime(activity.recorded_at) }}
              </span>
              <span class="text-sm text-gray-900">{{ activity.room_name }}</span>
            </div>
            <span class="text-sm text-gray-400">{{ getActivityIcon(activity.device_type) }}</span>
          </div>
        </div>

        <router-link
          to="/patronen"
          class="block text-sm text-emerald-600 hover:text-emerald-700 mt-4 text-right"
        >
          Bekijk volledige tijdlijn
        </router-link>
      </div>

    </template>

    <!-- Heatmap Tooltip -->
    <Teleport to="body">
      <div
        v-if="heatmapHover"
        class="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg pointer-events-none p-3 min-w-48"
        :style="{
          left: heatmapHover.x + 12 + 'px',
          top: heatmapHover.y - 10 + 'px'
        }"
      >
        <div class="text-sm font-medium text-gray-900 mb-2">
          {{ heatmapHover.dateLabel }}
        </div>
        <div v-if="heatmapHover.rooms.length === 0" class="text-sm text-gray-400">
          Geen activiteit
        </div>
        <div v-else class="space-y-1.5">
          <div
            v-for="room in heatmapHover.rooms"
            :key="room.name"
            class="flex items-center gap-2"
          >
            <span class="text-xs text-gray-600 w-20 truncate">{{ room.name }}</span>
            <div class="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                class="h-full bg-emerald-500 rounded-full"
                :style="{ width: room.barWidth + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
