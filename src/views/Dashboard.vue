<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getHueConfig } from '../services/supabase'
import {
  MINIMUM_DAYS_REQUIRED,
  calculateDayStart,
  formatMinutesToTime,
  avg,
  stddev,
  getDayEventsUntilHour,
  getActiveDayHoursUntilHour,
} from '../composables/useDataQuality'
import { useDashboardData } from '../composables/useDashboardData'
import ActivityHeatmap from '../components/ActivityHeatmap.vue'

// UI state
const loading = ref(true)
const hasConfig = ref(true)

// Data (via composable)
const { heatmapData, recentActivity, todayStats, averageStats, historicalDays, refreshAllData } =
  useDashboardData()

// === Z-SCORE HELPERS ===

function calcZScore(value, mean, std) {
  if (value === null || mean === null || std === null || std === 0) return 0
  return (value - mean) / std
}

function zSeverity(z) {
  const absZ = Math.abs(z)
  if (absZ >= 2) return 'high'
  if (absZ >= 1) return 'medium'
  return 'low'
}

// === STATUS BEPALING (rolling: vergelijkt alleen tot huidig uur) ===

const statusInfo = computed(() => {
  if (!todayStats.value || !averageStats.value || averageStats.value.daysCount < MINIMUM_DAYS_REQUIRED) {
    const daysCount = averageStats.value?.daysCount || 0
    return {
      level: 'unknown', color: 'gray',
      title: 'We leren nog',
      subtitle: daysCount > 0
        ? `${daysCount} dagen beschikbaar, minimaal ${MINIMUM_DAYS_REQUIRED} nodig`
        : 'Nog geen data beschikbaar',
      deviations: [],
    }
  }

  const today = todayStats.value
  const stats = averageStats.value
  const ch = new Date().getHours()

  const expectedEventsUntilNow = historicalDays.value.length > 0
    ? avg(historicalDays.value.map(d => getDayEventsUntilHour(d.events_per_hour, ch)))
    : stats.totalEvents
  if (today.totalEvents === 0 && expectedEventsUntilNow > 5) {
    return {
      level: 'concern', color: 'red',
      title: 'Geen activiteit',
      subtitle: 'Nog geen activiteit vandaag, misschien even checken',
      deviations: [],
    }
  }

  const hist = historicalDays.value
  const metrics = []

  const todayEventsUntilNow = getDayEventsUntilHour(today.eventsPerHour, ch)
  const histEventsUntilNow = hist.map(d => getDayEventsUntilHour(d.events_per_hour, ch)).filter(v => v != null)
  if (histEventsUntilNow.length >= 2) {
    const z = calcZScore(todayEventsUntilNow, avg(histEventsUntilNow), stddev(histEventsUntilNow))
    if (Math.abs(z) >= 1) {
      metrics.push({
        label: 'Activiteit', z, severity: zSeverity(z),
        text: `${todayEventsUntilNow} events (normaal ${Math.round(avg(histEventsUntilNow))} om ${String(ch).padStart(2, '0')}:00)`,
      })
    }
  }

  const todayWake = calculateDayStart(today.eventsPerHour)
  const histWake = hist.map(d => calculateDayStart(d.events_per_hour)).filter(v => v !== null)
  if (todayWake !== null && histWake.length >= 2) {
    const z = calcZScore(todayWake, avg(histWake), stddev(histWake))
    if (Math.abs(z) >= 1) {
      metrics.push({
        label: 'Opgestaan', z, severity: zSeverity(z),
        text: `${formatMinutesToTime(todayWake)} (normaal ${formatMinutesToTime(Math.round(avg(histWake)))})`,
      })
    }
  }

  const todayActiveUntilNow = getActiveDayHoursUntilHour(today.eventsPerHour, ch)
  const histActiveUntilNow = hist.map(d => getActiveDayHoursUntilHour(d.events_per_hour, ch)).filter(v => v != null)
  if (histActiveUntilNow.length >= 2) {
    const z = calcZScore(todayActiveUntilNow, avg(histActiveUntilNow), stddev(histActiveUntilNow))
    if (Math.abs(z) >= 1) {
      metrics.push({
        label: 'Actieve uren', z, severity: zSeverity(z),
        text: `${todayActiveUntilNow}u (normaal ${avg(histActiveUntilNow).toFixed(1)}u om ${String(ch).padStart(2, '0')}:00)`,
      })
    }
  }

  const histNight = hist.map(d => d.night_events).filter(v => v != null)
  if (today.nightEvents != null && histNight.length >= 2) {
    const z = calcZScore(today.nightEvents, avg(histNight), stddev(histNight))
    if (Math.abs(z) >= 1) {
      metrics.push({
        label: 'Nachtactiviteit', z, severity: zSeverity(z),
        text: `${today.nightEvents} events (normaal ${Math.round(avg(histNight))})`,
      })
    }
  }

  metrics.sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
  const topDeviations = metrics.slice(0, 3)
  const maxZ = metrics.length > 0 ? Math.abs(metrics[0].z) : 0

  if (maxZ >= 2) return { level: 'alert', color: 'red', title: 'Sterk afwijkend', subtitle: 'Meerdere patronen wijken af van normaal', deviations: topDeviations }
  if (maxZ >= 1) return { level: 'attention', color: 'amber', title: 'Let even op', subtitle: 'Enkele patronen wijken af van normaal', deviations: topDeviations }
  return { level: 'normal', color: 'green', title: 'Normale dag', subtitle: 'Vergelijkbaar met vorige week', deviations: [] }
})

// Computed: Dagstart info
const firstActivityInfo = computed(() => {
  const dayStartMinutes = todayStats.value?.eventsPerHour
    ? calculateDayStart(todayStats.value.eventsPerHour)
    : null

  if (dayStartMinutes === null) {
    const avgTime = averageStats.value?.avgDayStart
    return avgTime
      ? { title: 'Nog niet op', subtitle: `Normaal rond ${avgTime}` }
      : { title: 'Nog niet op', subtitle: 'Wacht op dagactiviteit' }
  }

  const dayStartTime = formatMinutesToTime(dayStartMinutes)
  const hist = historicalDays.value
  const histWake = hist.map(d => calculateDayStart(d.events_per_hour)).filter(v => v !== null)

  let subtitle = ''
  if (histWake.length >= 2) {
    const avgWake = Math.round(avg(histWake))
    const diffMinutes = dayStartMinutes - avgWake
    if (Math.abs(diffMinutes) < 15) {
      subtitle = 'Normaal tijdstip'
    } else {
      const hours = Math.floor(Math.abs(diffMinutes) / 60)
      const mins = Math.abs(diffMinutes) % 60
      const timeStr = hours > 0 ? `${hours}u${mins > 0 ? mins + 'm' : ''}` : `${mins} min`
      subtitle = `${timeStr} ${diffMinutes > 0 ? 'later' : 'eerder'} dan normaal`
    }
  }

  return { title: `Op sinds ${dayStartTime}`, subtitle }
})

// Computed: Laatste activiteit info
const lastActivityInfo = computed(() => {
  const lastEvent = recentActivity.value[0]
  if (!lastEvent) return { title: 'Geen activiteit', subtitle: 'Vandaag nog niets gezien' }

  const lastDate = new Date(lastEvent.recorded_at)
  const diffMinutes = Math.floor((Date.now() - lastDate.getTime()) / 60000)
  const lastTime = `${String(lastDate.getHours()).padStart(2, '0')}:${String(lastDate.getMinutes()).padStart(2, '0')}`

  let timeAgo = ''
  if (diffMinutes < 1) timeAgo = 'Zojuist'
  else if (diffMinutes < 60) timeAgo = `${diffMinutes} ${diffMinutes === 1 ? 'minuut' : 'minuten'} geleden`
  else timeAgo = `${Math.floor(diffMinutes / 60)} uur geleden`

  return { title: `Laatste teken ${lastTime}`, subtitle: timeAgo }
})

// Computed: Gegroepeerde recente activiteit (unieke kamers, max 5)
const hiddenRooms = ['Toilet', 'Tuin']
const groupedRecentActivity = computed(() => {
  const seen = new Set()
  const result = []
  for (const activity of recentActivity.value) {
    if (hiddenRooms.includes(activity.room_name) || seen.has(activity.room_name)) continue
    seen.add(activity.room_name)
    result.push(activity)
    if (result.length >= 5) break
  }
  return result
})

// Helpers
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

// Lifecycle
let refreshInterval = null

onMounted(async () => {
  try {
    const config = await getHueConfig()
    if (!config) { hasConfig.value = false; return }
    await refreshAllData()
    refreshInterval = setInterval(refreshAllData, 5 * 60 * 1000)
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<template>
  <div class="space-y-4" style="max-width: 1400px;">
    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-lg border p-12 text-center">
      <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
      <p class="text-gray-500">Laden...</p>
    </div>

    <!-- No Hue config -->
    <div v-else-if="!hasConfig" class="bg-white rounded-lg border p-12 text-center">
      <div class="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <h2 class="text-lg font-semibold text-gray-900 mb-2">Verbind je Hue Bridge</h2>
      <p class="text-gray-500 mb-4">Koppel eerst je Philips Hue Bridge om sensordata te ontvangen.</p>
      <router-link to="/instellingen" class="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors">
        Naar Instellingen
      </router-link>
    </div>

    <template v-else>
      <!-- Status Banner -->
      <div
        class="rounded-lg p-5"
        :class="{
          'bg-primary-50 border border-primary-200': statusInfo.color === 'green',
          'bg-amber-50 border border-amber-200': statusInfo.color === 'amber',
          'bg-red-50 border border-red-200': statusInfo.color === 'red',
          'bg-gray-50 border border-gray-200': statusInfo.color === 'gray',
        }"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-3 h-3 rounded-full flex-shrink-0"
            :class="{
              'bg-primary-500': statusInfo.color === 'green',
              'bg-amber-500': statusInfo.color === 'amber',
              'bg-red-500': statusInfo.color === 'red',
              'bg-gray-400': statusInfo.color === 'gray',
            }"
          ></div>
          <div class="flex-1">
            <h1
              class="text-lg font-semibold"
              :class="{
                'text-primary-900': statusInfo.color === 'green',
                'text-amber-900': statusInfo.color === 'amber',
                'text-red-900': statusInfo.color === 'red',
                'text-gray-900': statusInfo.color === 'gray',
              }"
            >{{ statusInfo.title }}</h1>
            <p
              class="text-sm"
              :class="{
                'text-primary-700': statusInfo.color === 'green',
                'text-amber-700': statusInfo.color === 'amber',
                'text-red-700': statusInfo.color === 'red',
                'text-gray-600': statusInfo.color === 'gray',
              }"
            >{{ statusInfo.subtitle }}</p>
          </div>
        </div>

        <div v-if="statusInfo.deviations.length > 0" class="mt-3 space-y-1.5 ml-6">
          <div v-for="dev in statusInfo.deviations" :key="dev.label" class="flex items-center gap-2">
            <span
              class="text-xs font-medium px-1.5 py-0.5 rounded"
              :class="{
                'bg-amber-200 text-amber-800': dev.severity === 'medium',
                'bg-red-200 text-red-800': dev.severity === 'high',
              }"
            >{{ dev.label }}</span>
            <span
              class="text-sm"
              :class="{
                'text-amber-700': statusInfo.color === 'amber',
                'text-red-700': statusInfo.color === 'red',
              }"
            >{{ dev.text }}</span>
          </div>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-white border border-gray-200 rounded-lg p-5">
          <p class="text-lg font-semibold text-gray-900">{{ firstActivityInfo.title }}</p>
          <p class="text-sm text-gray-500 mt-1">{{ firstActivityInfo.subtitle }}</p>
        </div>
        <div class="bg-white border border-gray-200 rounded-lg p-5">
          <p class="text-lg font-semibold text-gray-900">{{ lastActivityInfo.title }}</p>
          <p class="text-sm text-gray-500 mt-1">{{ lastActivityInfo.subtitle }}</p>
        </div>
      </div>

      <!-- Heatmap -->
      <ActivityHeatmap :heatmapData="heatmapData" />

      <!-- Recente activiteit -->
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
              <span class="text-sm font-medium text-gray-500 w-12">{{ formatActivityTime(activity.recorded_at) }}</span>
              <span class="text-sm text-gray-900">{{ activity.room_name }}</span>
            </div>
            <span class="text-sm text-gray-400">{{ getActivityIcon(activity.device_type) }}</span>
          </div>
        </div>

        <router-link to="/patronen" class="block text-sm text-primary-600 hover:text-primary-700 mt-4 text-right">
          Bekijk volledige tijdlijn
        </router-link>
      </div>
    </template>
  </div>
</template>
