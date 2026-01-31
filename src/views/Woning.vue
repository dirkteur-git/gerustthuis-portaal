<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../services/supabase'

// Data
const loading = ref(true)
const rooms = ref([])
const deviceCounts = ref({})
const activityData = ref({})

// Hover state voor tooltip
const hoverInfo = ref(null) // { roomName, hourIndex, x, y }

// Format sensors als tekst: "3 lampen · 1 beweging · 2 deuren"
function formatSensors(room) {
  const parts = []
  if (room.devices.light > 0) {
    parts.push(`${room.devices.light} lamp${room.devices.light > 1 ? 'en' : ''}`)
  }
  if (room.devices.motion_sensor > 0) {
    parts.push(`${room.devices.motion_sensor} beweging`)
  }
  if (room.devices.contact_sensor > 0) {
    parts.push(`${room.devices.contact_sensor} deur${room.devices.contact_sensor > 1 ? 'en' : ''}`)
  }
  if (room.devices.button > 0) {
    parts.push(`${room.devices.button} knop${room.devices.button > 1 ? 'pen' : ''}`)
  }
  return parts.join(' · ') || 'Geen sensoren'
}

// Bereken tijd label voor een uur index (0 = 24u geleden, 23 = nu)
function getHourLabel(hourIndex) {
  const now = new Date()
  const hoursAgo = 23 - hourIndex
  const targetTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000)
  return targetTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

// Computed: rooms met device counts en activiteit, gesorteerd op activiteit
const roomsWithData = computed(() => {
  return rooms.value.map(roomName => {
    const counts = deviceCounts.value[roomName] || {}
    const activity = activityData.value[roomName] || Array(24).fill(0)

    return {
      name: roomName,
      devices: {
        light: counts.light || 0,
        motion_sensor: counts.motion_sensor || 0,
        contact_sensor: counts.contact_sensor || 0,
        button: counts.button || 0
      },
      activity,
      totalDevices: Object.values(counts).reduce((a, b) => a + b, 0),
      totalActivity: activity.reduce((a, b) => a + b, 0)
    }
  }).sort((a, b) => b.totalActivity - a.totalActivity)
})

// Load unique rooms from hue_devices
async function loadRooms() {
  const { data, error } = await supabase
    .from('hue_devices')
    .select('room_name')

  if (error) {
    console.error('Error loading rooms:', error)
    return
  }

  const uniqueRooms = [...new Set(data.map(d => d.room_name).filter(Boolean))]
  rooms.value = uniqueRooms.sort()
}

// Load device counts per room from hue_devices
async function loadDeviceCounts() {
  const { data, error } = await supabase
    .from('hue_devices')
    .select('room_name, device_type')

  if (error) {
    console.error('Error loading device counts:', error)
    return
  }

  const counts = {}
  for (const device of data) {
    if (!device.room_name) continue
    if (!counts[device.room_name]) {
      counts[device.room_name] = {}
    }
    const type = device.device_type
    counts[device.room_name][type] = (counts[device.room_name][type] || 0) + 1
  }

  deviceCounts.value = counts
}

// Load activity per room per hour (last 24h) from room_activity_hourly view
async function loadActivityData() {
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // room_activity_hourly view: room_name, hour (text YYYY-MM-DDTHH:MI:SSZ), total_events
  const { data, error } = await supabase
    .from('room_activity_hourly')
    .select('room_name, hour, total_events')
    .gte('hour', yesterday.toISOString().slice(0, 13) + ':00:00Z')
    .order('hour', { ascending: true })

  if (error) {
    console.error('Error loading activity data:', error)
    return
  }

  // Groepeer per kamer en uur
  // Array van 24 uren: index 0 = oudste (24u geleden), index 23 = nieuwste (nu)
  const activity = {}

  for (const row of data || []) {
    if (!row.room_name) continue

    const hourTime = new Date(row.hour)
    const diffMs = now.getTime() - hourTime.getTime()
    const hoursAgo = Math.floor(diffMs / (1000 * 60 * 60))

    // Alleen data van de laatste 24 uur
    if (hoursAgo < 0 || hoursAgo >= 24) continue

    if (!activity[row.room_name]) {
      activity[row.room_name] = Array(24).fill(0)
    }

    // index 0 = 23-24 uur geleden, index 23 = 0-1 uur geleden (meest recent)
    const index = 23 - hoursAgo
    activity[row.room_name][index] = Number(row.total_events) || 0
  }

  activityData.value = activity
}

// Sparkline SVG path generator - alleen lijn, geen fill
function sparklinePath(values, width = 200, height = 32) {
  if (!values || values.length === 0) return ''

  const max = Math.max(...values, 1)
  const points = values.map((val, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - (val / max) * (height - 4) - 2
    return `${x},${y}`
  })

  return `M ${points.join(' L ')}`
}

// Hover handlers voor sparkline
function handleSparklineHover(event, room) {
  const svg = event.currentTarget
  const rect = svg.getBoundingClientRect()
  const x = event.clientX - rect.left
  const percentage = x / rect.width
  const hourIndex = Math.min(23, Math.max(0, Math.round(percentage * 23)))

  hoverInfo.value = {
    roomName: room.name,
    hourIndex,
    events: room.activity[hourIndex] || 0,
    time: getHourLabel(hourIndex),
    x: event.clientX,
    y: event.clientY
  }
}

function handleSparklineLeave() {
  hoverInfo.value = null
}

onMounted(async () => {
  try {
    await Promise.all([
      loadRooms(),
      loadDeviceCounts(),
      loadActivityData()
    ])
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6" style="max-width: 1400px;">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Woning</h1>
      <p class="text-gray-500">Kameroverzicht met activiteit</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-lg border border-gray-200 p-12 text-center">
      <div class="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
      <p class="text-gray-500">Kamers laden...</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="roomsWithData.length === 0" class="bg-white rounded-lg border border-gray-200 p-12 text-center">
      <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
      <h2 class="text-lg font-medium text-gray-900 mb-2">Geen kamers gevonden</h2>
      <p class="text-gray-500">Verbind eerst je Philips Hue Bridge om kamers te zien.</p>
    </div>

    <!-- Room Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="room in roomsWithData"
        :key="room.name"
        class="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow cursor-pointer"
      >
        <!-- Kamernaam -->
        <h3 class="text-base font-semibold text-gray-900">
          {{ room.name }}
        </h3>

        <!-- Sensors als tekst -->
        <p class="text-sm text-gray-500 mt-1">
          {{ formatSensors(room) }}
        </p>

        <!-- Sparkline met hover -->
        <div class="mt-4 h-8 relative">
          <svg
            v-if="room.totalActivity > 0"
            viewBox="0 0 200 32"
            class="w-full h-full cursor-crosshair"
            preserveAspectRatio="none"
            @mousemove="handleSparklineHover($event, room)"
            @mouseleave="handleSparklineLeave"
          >
            <path
              :d="sparklinePath(room.activity, 200, 32)"
              fill="none"
              stroke="#10b981"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <!-- Geen activiteit: vlakke lijn -->
          <svg
            v-else
            viewBox="0 0 200 32"
            class="w-full h-full"
            preserveAspectRatio="none"
          >
            <line
              x1="0"
              y1="16"
              x2="200"
              y2="16"
              stroke="#e5e7eb"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </div>

        <!-- Event count -->
        <p class="text-xs text-gray-400 mt-2 text-right">
          {{ room.totalActivity > 0 ? `${room.totalActivity} events` : 'Geen activiteit (24u)' }}
        </p>
      </div>
    </div>

    <!-- Tooltip -->
    <Teleport to="body">
      <div
        v-if="hoverInfo"
        class="fixed z-50 bg-gray-900 text-white text-xs rounded px-2 py-1 pointer-events-none shadow-lg"
        :style="{
          left: hoverInfo.x + 10 + 'px',
          top: hoverInfo.y - 30 + 'px'
        }"
      >
        {{ hoverInfo.time }} · {{ hoverInfo.events }} event{{ hoverInfo.events !== 1 ? 's' : '' }}
      </div>
    </Teleport>
  </div>
</template>
