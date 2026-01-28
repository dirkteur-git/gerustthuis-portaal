<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../services/supabase'

// Data
const loading = ref(true)
const rooms = ref([])
const selectedRooms = ref([])
const showRoomFilter = ref(false)
const heatmapData = ref([]) // { date, hours: [{ hour, count, roomCounts }] }
const sensorHealth = ref({ active: 0, total: 0 })
const selectedHour = ref(null) // { date, hour, roomCounts, x, y }
const popupPosition = ref({ x: 0, y: 0 })
const lastRefreshTime = ref(null)

// Computed
const patroonscore = computed(() => {
  // TODO: Implement pattern score calculation
  return null
})

const sensorscore = computed(() => {
  if (sensorHealth.value.total === 0) return 0
  return Math.round((sensorHealth.value.active / sensorHealth.value.total) * 100)
})

const filteredHeatmapData = computed(() => {
  if (selectedRooms.value.length === 0) return heatmapData.value
  // Filter by selected rooms - recalculate counts per day/hour
  return heatmapData.value.map(day => ({
    ...day,
    hours: day.hours.map(hour => ({
      ...hour,
      count: Object.entries(hour.roomCounts || {})
        .filter(([room]) => selectedRooms.value.includes(room))
        .reduce((sum, [, count]) => sum + count, 0)
    }))
  }))
})

const maxCount = computed(() => {
  let max = 0
  filteredHeatmapData.value.forEach(day => {
    day.hours.forEach(hour => {
      if (hour.count > max) max = hour.count
    })
  })
  return max || 1
})

// Methods
function getHeatmapColor(count) {
  if (count === 0) return 'bg-gray-100'
  const intensity = count / maxCount.value
  if (intensity < 0.25) return 'bg-emerald-100'
  if (intensity < 0.5) return 'bg-emerald-300'
  if (intensity < 0.75) return 'bg-emerald-500'
  return 'bg-emerald-700'
}

function toggleRoom(room) {
  const idx = selectedRooms.value.indexOf(room)
  if (idx === -1) {
    selectedRooms.value.push(room)
  } else {
    selectedRooms.value.splice(idx, 1)
  }
}

function selectAllRooms() {
  selectedRooms.value = [...rooms.value]
}

function clearRoomFilter() {
  selectedRooms.value = []
}

function showHourDetail(event, day, hour) {
  if (hour.count === 0) {
    selectedHour.value = null
    return
  }
  // Position popup near click
  popupPosition.value = {
    x: event.clientX,
    y: event.clientY
  }
  selectedHour.value = {
    date: day.date,
    hour: hour.hour,
    roomCounts: hour.roomCounts || {}
  }
}

function closeHourDetail() {
  selectedHour.value = null
}

const sortedRoomCounts = computed(() => {
  if (!selectedHour.value) return []
  return Object.entries(selectedHour.value.roomCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([room, count]) => ({ room, count }))
})

const totalSelectedCount = computed(() => {
  return sortedRoomCounts.value.reduce((sum, item) => sum + item.count, 0)
})

const popupStyle = computed(() => {
  const x = Math.min(popupPosition.value.x, (typeof window !== 'undefined' ? window.innerWidth : 1000) - 280)
  const y = Math.min(popupPosition.value.y + 10, (typeof window !== 'undefined' ? window.innerHeight : 800) - 300)
  return {
    left: `${x}px`,
    top: `${y}px`
  }
})

function formatDate(dateStr) {
  const days = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
  const d = new Date(dateStr)
  return `${days[d.getDay()]} ${d.getDate()}-${['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][d.getMonth()]}`
}

const formattedLastRefresh = computed(() => {
  if (!lastRefreshTime.value) return null
  const d = new Date(lastRefreshTime.value)
  const day = d.getDate()
  const month = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][d.getMonth()]
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${month}, ${hours}:${minutes}`
})

async function loadRooms() {
  const { data, error } = await supabase
    .from('hue_devices')
    .select('room_name')
    .not('room_name', 'is', null)

  if (error) {
    console.error('Error fetching rooms:', error)
    return
  }

  rooms.value = [...new Set(data?.map(d => d.room_name) || [])].sort()
  selectedRooms.value = [...rooms.value]
}

async function loadSensorHealth() {
  const ninetyMinutesAgo = new Date(Date.now() - 90 * 60 * 1000).toISOString()

  // Get physical devices (motion sensors)
  const { data: physicalDevices, error: physError } = await supabase
    .from('physical_devices')
    .select('id, battery_updated_at')

  if (physError) {
    console.error('Error fetching physical devices:', physError)
    return
  }

  // Get contact sensors (standalone)
  const { data: contactSensors, error: contactError } = await supabase
    .from('hue_devices')
    .select('id, last_state_at')
    .eq('device_type', 'contact_sensor')

  if (contactError) {
    console.error('Error fetching contact sensors:', contactError)
    return
  }

  // Count active sensors
  const activePhysical = (physicalDevices || []).filter(
    d => d.battery_updated_at && new Date(d.battery_updated_at) > new Date(ninetyMinutesAgo)
  ).length

  const activeContact = (contactSensors || []).filter(
    d => d.last_state_at && new Date(d.last_state_at) > new Date(ninetyMinutesAgo)
  ).length

  sensorHealth.value = {
    active: activePhysical + activeContact,
    total: (physicalDevices?.length || 0) + (contactSensors?.length || 0)
  }
}

// Helper to get local date string YYYY-MM-DD
function toLocalDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function loadHeatmapData() {
  // Get activity from room_activity_hourly table (last 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('room_activity_hourly')
    .select('room_name, hour, motion_events, door_events, updated_at')
    .gte('hour', sevenDaysAgo.toISOString())

  if (error) {
    console.error('Error fetching heatmap data:', error)
    return
  }

  // Group by day, then by hour (0-23)
  // Y-axis = days, X-axis = hours, color = activity count
  const dayMap = new Map()

  // Initialize all 7 days with 24 hours each (using local dates)
  for (let i = 0; i < 7; i++) {
    const date = new Date()
    date.setDate(date.getDate() - 6 + i)
    const dateKey = toLocalDateKey(date)

    const hours = []
    for (let h = 0; h < 24; h++) {
      hours.push({ hour: h, count: 0, roomCounts: {} })
    }
    dayMap.set(dateKey, { date: dateKey, hours })
  }

  // Find the most recent updated_at timestamp
  let latestUpdate = null
  for (const row of data || []) {
    if (row.updated_at) {
      const updateTime = new Date(row.updated_at)
      if (!latestUpdate || updateTime > latestUpdate) {
        latestUpdate = updateTime
      }
    }
  }
  lastRefreshTime.value = latestUpdate

  // Aggregate events per day per hour, tracking room counts for filtering
  for (const row of data || []) {
    if (!row.room_name) continue

    // Ensure UTC parsing - Supabase returns TIMESTAMPTZ but sometimes without 'Z'
    const hourStr = row.hour
    const eventDate = new Date(hourStr.endsWith('Z') || hourStr.includes('+') ? hourStr : hourStr + 'Z')
    const dateKey = toLocalDateKey(eventDate)
    const hourOfDay = eventDate.getHours()

    const day = dayMap.get(dateKey)
    if (day) {
      const eventCount = (row.motion_events || 0) + (row.door_events || 0)
      day.hours[hourOfDay].count += eventCount
      day.hours[hourOfDay].roomCounts[row.room_name] =
        (day.hours[hourOfDay].roomCounts[row.room_name] || 0) + eventCount
    }
  }

  // Convert to array, sorted by date ascending
  heatmapData.value = Array.from(dayMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  )
}

onMounted(async () => {
  try {
    await Promise.all([
      loadRooms(),
      loadSensorHealth(),
      loadHeatmapData()
    ])
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-4" style="max-width: 1400px;">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p class="text-gray-500">Kamer activiteit</p>
      </div>
      <div class="text-gray-500 flex items-center gap-1.5 text-sm">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span v-if="formattedLastRefresh">{{ formattedLastRefresh }}</span>
        <span v-else>-</span>
      </div>
    </div>

    <!-- Score Cards -->
    <div class="grid grid-cols-2 gap-4">
      <!-- Patroonscore -->
      <div class="bg-white rounded-xl shadow-sm border p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p class="text-sm text-gray-500">Patroonscore</p>
              <p class="text-sm font-medium text-gray-900">{{ patroonscore !== null ? 'Normaal' : '-' }}</p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold" :class="patroonscore !== null ? 'text-blue-600' : 'text-gray-300'">
              {{ patroonscore !== null ? patroonscore : '-' }}
            </p>
            <p class="text-xs text-gray-400">/ 100</p>
          </div>
        </div>
      </div>

      <!-- Sensorscore -->
      <div class="bg-white rounded-xl shadow-sm border p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </div>
            <div>
              <p class="text-sm text-gray-500">Sensorscore</p>
              <p class="text-sm font-medium text-gray-900">{{ sensorHealth.active }}/{{ sensorHealth.total }} actief</p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold" :class="sensorscore === 100 ? 'text-emerald-600' : sensorscore > 50 ? 'text-orange-500' : 'text-red-500'">
              {{ sensorscore }}
            </p>
            <p class="text-xs text-gray-400">/ 100</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Heatmap -->
    <div class="bg-white rounded-xl shadow-sm border p-4">
      <div class="flex justify-between items-center mb-3">
        <div>
          <h2 class="text-base font-semibold text-gray-900">Activiteit per uur</h2>
          <p class="text-xs text-gray-500">Laatste 7 dagen</p>
        </div>
        <div class="relative">
          <button
            @click="showRoomFilter = !showRoomFilter"
            class="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {{ selectedRooms.length }}/{{ rooms.length }} kamers
          </button>

          <!-- Room filter dropdown -->
          <div
            v-if="showRoomFilter"
            class="absolute right-0 mt-2 w-64 bg-white border rounded-lg shadow-lg z-10 p-3"
          >
            <div class="flex justify-between mb-2">
              <button @click="selectAllRooms" class="text-xs text-blue-600 hover:underline">Alles</button>
              <button @click="clearRoomFilter" class="text-xs text-gray-500 hover:underline">Wissen</button>
            </div>
            <div class="max-h-64 overflow-y-auto space-y-1">
              <label
                v-for="room in rooms"
                :key="room"
                class="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  :checked="selectedRooms.includes(room)"
                  @change="toggleRoom(room)"
                  class="rounded text-emerald-600"
                >
                <span class="text-sm">{{ room }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Heatmap Grid -->
      <div v-if="loading" class="text-center py-8 text-gray-500">Laden...</div>
      <div v-else-if="filteredHeatmapData.length === 0" class="text-center py-8 text-gray-500">
        Geen activiteit gevonden
      </div>
      <div v-else>
        <div>
          <!-- Hour labels -->
          <div class="flex mb-1">
            <div class="w-20 shrink-0"></div>
            <div class="flex-1 flex">
              <div v-for="h in 24" :key="h - 1" class="flex-1 text-center text-xs text-gray-400">
                <span v-if="(h - 1) % 3 === 0">{{ h - 1 }}</span>
              </div>
            </div>
          </div>

          <!-- Days -->
          <div v-for="day in filteredHeatmapData" :key="day.date" class="flex items-center mb-0.5">
            <div class="w-20 shrink-0 text-xs text-gray-500 pr-2">
              {{ formatDate(day.date) }}
            </div>
            <div class="flex-1 flex gap-0.5">
              <div
                v-for="hour in day.hours"
                :key="hour.hour"
                :class="[
                  'flex-1 h-5 rounded-sm cursor-pointer transition-colors hover:ring-2 hover:ring-emerald-400',
                  getHeatmapColor(hour.count)
                ]"
                :title="`${formatDate(day.date)} ${hour.hour}:00 - ${hour.count} events`"
                @click="showHourDetail($event, day, hour)"
              ></div>
            </div>
          </div>

          <!-- Legend -->
          <div class="flex justify-end items-center gap-2 mt-3 text-xs text-gray-500">
            <span>Minder</span>
            <div class="w-3 h-3 rounded-sm bg-gray-100"></div>
            <div class="w-3 h-3 rounded-sm bg-emerald-100"></div>
            <div class="w-3 h-3 rounded-sm bg-emerald-300"></div>
            <div class="w-3 h-3 rounded-sm bg-emerald-500"></div>
            <div class="w-3 h-3 rounded-sm bg-emerald-700"></div>
            <span>Meer</span>
          </div>
        </div>
      </div>

    </div>

    <!-- Hour Detail Popup -->
    <Teleport to="body">
      <div
        v-if="selectedHour"
        class="fixed inset-0 z-40"
        @click="closeHourDetail"
      ></div>
      <div
        v-if="selectedHour"
        class="fixed z-50 bg-white rounded-xl shadow-2xl border p-4 w-64"
        :style="popupStyle"
      >
        <!-- Header -->
        <div class="flex justify-between items-start mb-3">
          <div>
            <p class="font-semibold text-gray-900">{{ formatDate(selectedHour.date) }}</p>
            <p class="text-xs text-gray-500">{{ selectedHour.hour }}:00 - {{ selectedHour.hour + 1 }}:00</p>
          </div>
          <button
            @click="closeHourDetail"
            class="text-gray-400 hover:text-gray-600 -mt-1 -mr-1"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Total -->
        <div class="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg mb-3">
          <div class="w-8 h-8 bg-emerald-100 rounded flex items-center justify-center">
            <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <p class="text-lg font-bold text-emerald-700">{{ totalSelectedCount }}</p>
            <p class="text-xs text-emerald-600 -mt-0.5">bewegingen</p>
          </div>
        </div>

        <!-- Room List -->
        <div class="space-y-1.5 max-h-48 overflow-y-auto">
          <div
            v-for="item in sortedRoomCounts"
            :key="item.room"
            class="flex justify-between items-center py-1.5 px-2 bg-gray-50 rounded"
          >
            <span class="text-sm text-gray-700">{{ item.room }}</span>
            <span class="text-sm font-semibold text-gray-900">{{ item.count }}</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
