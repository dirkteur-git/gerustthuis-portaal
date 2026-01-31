<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../services/supabase'
import {
  MINIMUM_DAYS_REQUIRED,
  DAY_START_HOUR,
  NIGHT_START_HOUR,
  NIGHT_END_HOUR,
  calculateDayStart,
  getDayEvents,
  getDayEventsUntilHour,
  getActiveDayHours,
  getActiveDayHoursUntilHour,
  isNightHour,
  formatMinutesToTime,
  toLocalDateKey,
  avg,
  stddev
} from '../composables/useDataQuality'

// Data
const loading = ref(true)
const todayStats = ref(null)
const baselineStats = ref(null)
const weekData = ref([])
const dataQuality = ref({ days: 0, sufficient: false })
const currentHour = ref(new Date().getHours())

// Constanten
const DAY_COMPLETE_HOUR = 21 // Dag is "compleet" om 21:00
const minDaysRequired = MINIMUM_DAYS_REQUIRED // For template access

// Helper: Is de dag nog bezig?
const isDayInProgress = computed(() => {
  return currentHour.value < DAY_COMPLETE_HOUR
})

// Helper: TIME string to decimal hours
function timeToDecimal(timeStr) {
  if (!timeStr) return null
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours + minutes / 60
}

// Helper: decimal hours to HH:MM format
function decimalToTime(decimal) {
  if (decimal === null || decimal === undefined) return '--:--'
  return formatMinutesToTime(decimal * 60) || '--:--'
}

// Helper: format TIME for display
function formatTime(timeStr) {
  if (!timeStr) return '--:--'
  return timeStr.substring(0, 5)
}

// Helper: Get first day activity hour from events_per_hour using shared calculateDayStart
function getFirstDayActivityHourHour(eventsPerHour) {
  const dayStartMinutes = calculateDayStart(eventsPerHour)
  if (dayStartMinutes === null) return null
  return Math.floor(dayStartMinutes / 60) // Convert minutes to hour
}

// Computed: status indicator
const statusInfo = computed(() => {
  if (!todayStats.value || !baselineStats.value) {
    return { status: 'loading', text: 'Laden...', color: 'text-gray-500', bgColor: 'bg-gray-100', dotColor: 'bg-gray-400', subtext: '' }
  }

  // Als dag nog bezig is, vergelijk alleen tot het huidige uur
  if (isDayInProgress.value) {
    // Vergelijk met gemiddelde tot dit uur
    const todayDayEvents = getDayEventsUntilHour(todayStats.value.events_per_hour, currentHour.value)
    const baselineDayEvents = baselineStats.value.day_events_until_hour?.[currentHour.value] || 0
    const baselineStd = baselineStats.value.day_events_until_hour_std?.[currentHour.value] || 1

    if (baselineDayEvents === 0) {
      return { status: 'in_progress', text: 'Dag nog bezig', color: 'text-blue-600', bgColor: 'bg-blue-50', dotColor: 'bg-blue-500', subtext: `${todayDayEvents} activiteiten tot nu` }
    }

    const z = Math.abs(todayDayEvents - baselineDayEvents) / baselineStd

    if (z < 1.5) return { status: 'in_progress', text: 'Dag nog bezig - normaal', color: 'text-blue-600', bgColor: 'bg-blue-50', dotColor: 'bg-blue-500', subtext: `${todayDayEvents} activiteiten (normaal: ~${Math.round(baselineDayEvents)})` }
    if (z < 2.5) return { status: 'attention', text: 'Dag nog bezig - beetje rustig', color: 'text-amber-600', bgColor: 'bg-amber-50', dotColor: 'bg-amber-500', subtext: `${todayDayEvents} activiteiten (normaal: ~${Math.round(baselineDayEvents)})` }
    return { status: 'concern', text: 'Dag nog bezig - erg rustig', color: 'text-orange-600', bgColor: 'bg-orange-50', dotColor: 'bg-orange-500', subtext: `${todayDayEvents} activiteiten (normaal: ~${Math.round(baselineDayEvents)})` }
  }

  // Volledige dag vergelijking (na 21:00)
  const zScores = []

  // Eerste dag-activiteit z-score (na 06:00)
  const todayFirstDay = getFirstDayActivityHour(todayStats.value.events_per_hour)
  if (todayFirstDay !== null && baselineStats.value.first_day_activity_avg) {
    const z = Math.abs(todayFirstDay - baselineStats.value.first_day_activity_avg) / (baselineStats.value.first_day_activity_std || 1)
    zScores.push(z)
  }

  // Dag-events z-score (06:00-23:00)
  const todayDayEvents = getDayEvents(todayStats.value.events_per_hour)
  if (baselineStats.value.day_events_avg) {
    const z = Math.abs(todayDayEvents - baselineStats.value.day_events_avg) / (baselineStats.value.day_events_std || 1)
    zScores.push(z)
  }

  // Actieve dag-uren z-score
  const todayActiveDayHours = getActiveDayHours(todayStats.value.events_per_hour)
  if (baselineStats.value.active_day_hours_avg) {
    const z = Math.abs(todayActiveDayHours - baselineStats.value.active_day_hours_avg) / (baselineStats.value.active_day_hours_std || 1)
    zScores.push(z)
  }

  const maxZ = Math.max(...zScores, 0)

  if (maxZ < 1.5) return { status: 'normal', text: 'Zoals gewoonlijk', color: 'text-emerald-600', bgColor: 'bg-emerald-50', dotColor: 'bg-emerald-500', subtext: '' }
  if (maxZ < 2.5) return { status: 'attention', text: 'Beetje afwijkend', color: 'text-amber-600', bgColor: 'bg-amber-50', dotColor: 'bg-amber-500', subtext: '' }
  return { status: 'concern', text: 'Sterk afwijkend', color: 'text-amber-700', bgColor: 'bg-amber-50', dotColor: 'bg-amber-600', subtext: '' }
})

// Computed: comparison items - DAG activiteit (06:00-23:00)
const comparisonItems = computed(() => {
  if (!todayStats.value || !baselineStats.value) return []

  const items = []

  // Eerste dag-activiteit (na 06:00)
  const todayFirstDay = getFirstDayActivityHour(todayStats.value.events_per_hour)
  const avgFirstDay = baselineStats.value.first_day_activity_avg
  items.push({
    label: 'Opstaan',
    today: todayFirstDay !== null ? `${String(todayFirstDay).padStart(2, '0')}:00` : '--:--',
    normal: avgFirstDay ? decimalToTime(avgFirstDay) : '--:--',
    diff: getDiffIndicator(todayFirstDay, avgFirstDay, baselineStats.value.first_day_activity_std),
    note: isDayInProgress.value && todayFirstDay === null ? 'nog geen activiteit' : null
  })

  // Actieve dag-uren (06:00-23:00)
  const todayActiveDayHours = isDayInProgress.value
    ? getActiveDayHoursUntilHour(todayStats.value.events_per_hour, currentHour.value)
    : getActiveDayHours(todayStats.value.events_per_hour)
  const avgActiveDayHours = isDayInProgress.value
    ? baselineStats.value.active_day_hours_until_hour?.[currentHour.value] || 0
    : baselineStats.value.active_day_hours_avg
  items.push({
    label: 'Actieve uren (dag)',
    today: todayActiveDayHours,
    normal: avgActiveDayHours ? Math.round(avgActiveDayHours) : '--',
    diff: isDayInProgress.value ? { icon: '', color: '' } : getDiffIndicator(todayActiveDayHours, avgActiveDayHours, baselineStats.value.active_day_hours_std)
  })

  // Dag-events (06:00-23:00)
  const todayDayEvents = isDayInProgress.value
    ? getDayEventsUntilHour(todayStats.value.events_per_hour, currentHour.value)
    : getDayEvents(todayStats.value.events_per_hour)
  const avgDayEvents = isDayInProgress.value
    ? baselineStats.value.day_events_until_hour?.[currentHour.value] || 0
    : baselineStats.value.day_events_avg
  items.push({
    label: 'Dag activiteit',
    today: todayDayEvents,
    normal: avgDayEvents ? Math.round(avgDayEvents) : '--',
    diff: isDayInProgress.value ? { icon: '', color: '' } : getDiffIndicator(todayDayEvents, avgDayEvents, baselineStats.value.day_events_std)
  })

  // Nacht-events (23:00-06:00 van afgelopen nacht)
  const todayNightEvents = todayStats.value.night_events ?? 0
  const avgNightEvents = baselineStats.value.night_events_avg
  items.push({
    label: 'Nacht activiteit',
    today: todayNightEvents,
    normal: avgNightEvents ? Math.round(avgNightEvents) : '--',
    diff: getDiffIndicator(todayNightEvents, avgNightEvents, baselineStats.value.night_events_std),
    note: 'afgelopen nacht (23:00-06:00)'
  })

  return items
})

function getDiffIndicator(today, avg, std) {
  if (today === null || avg === null || !std) return { icon: '', color: '' }
  const z = Math.abs(today - avg) / std
  if (z < 1.5) return { icon: '✓', color: 'text-emerald-500' }
  if (z < 2.5) return { icon: '!', color: 'text-amber-500' }
  return { icon: '!!', color: 'text-red-500' }
}

// Computed: hourly chart data
const hourlyChartData = computed(() => {
  if (!todayStats.value?.events_per_hour || !baselineStats.value?.events_per_hour_avg) {
    return []
  }

  const data = []
  for (let h = 0; h < 24; h++) {
    const todayVal = todayStats.value.events_per_hour[h] || 0
    const avgVal = baselineStats.value.events_per_hour_avg[h] || 0
    data.push({
      hour: h,
      today: todayVal,
      baseline: avgVal,
      maxVal: Math.max(todayVal, avgVal)
    })
  }
  return data
})

const hourlyMaxValue = computed(() => {
  return Math.max(...hourlyChartData.value.map(d => d.maxVal), 1)
})

// Computed: sparkline data for trends
const trendData = computed(() => {
  if (weekData.value.length === 0) return null

  return {
    events: weekData.value.map(d => d.total_events || 0),
    activeHours: weekData.value.map(d => d.active_hours || 0),
    firstActivity: weekData.value.map(d => timeToDecimal(d.first_activity) || 0)
  }
})

// Load today's stats
async function loadTodayStats() {
  const today = toLocalDateKey(new Date())

  const { data, error } = await supabase
    .from('daily_activity_stats')
    .select('*')
    .eq('date', today)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error loading today stats:', error)
  }

  todayStats.value = data || {
    first_activity: null,
    last_activity: null,
    total_events: 0,
    active_hours: 0,
    events_per_hour: Array(24).fill(0),
    rooms_active: 0,
    rooms_available: 0,
    longest_gap_minutes: 0,
    night_events: 0
  }
}

// Load baseline (last 14 days average)
async function loadBaseline() {
  const today = new Date()
  const fourteenDaysAgo = new Date(today)
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const { data, error } = await supabase
    .from('daily_activity_stats')
    .select('*')
    .gte('date', toLocalDateKey(fourteenDaysAgo))
    .lt('date', toLocalDateKey(today))
    .order('date', { ascending: true })

  if (error) {
    console.error('Error loading baseline:', error)
    return
  }

  // Data quality
  dataQuality.value = {
    days: data?.length || 0,
    sufficient: (data?.length || 0) >= MINIMUM_DAYS_REQUIRED
  }

  if (!data || data.length === 0) {
    baselineStats.value = null
    return
  }

  // Eerste DAG-activiteit (na 06:00)
  const firstDayActivities = data
    .map(d => getFirstDayActivityHour(d.events_per_hour))
    .filter(v => v !== null)

  // Dag-events (06:00-23:00)
  const dayEvents = data.map(d => getDayEvents(d.events_per_hour))

  // Actieve dag-uren (06:00-23:00)
  const activeDayHours = data.map(d => getActiveDayHours(d.events_per_hour))

  // Nacht-events
  const nightEvents = data.map(d => d.night_events || 0)

  // Events per uur gemiddelde
  const eventsPerHourAvg = Array(24).fill(0)
  for (const day of data) {
    if (day.events_per_hour) {
      for (let h = 0; h < 24; h++) {
        eventsPerHourAvg[h] += (day.events_per_hour[h] || 0)
      }
    }
  }
  for (let h = 0; h < 24; h++) {
    eventsPerHourAvg[h] = eventsPerHourAvg[h] / data.length
  }

  // Dag-events tot elk uur (voor vergelijking met onvolledige dag)
  const dayEventsUntilHour = {}
  const dayEventsUntilHourStd = {}
  const activeDayHoursUntilHour = {}

  for (let targetHour = DAY_START_HOUR; targetHour <= NIGHT_START_HOUR; targetHour++) {
    const eventsUntilHour = data.map(d => getDayEventsUntilHour(d.events_per_hour, targetHour))
    const activeUntilHour = data.map(d => getActiveDayHoursUntilHour(d.events_per_hour, targetHour))
    dayEventsUntilHour[targetHour] = avg(eventsUntilHour)
    dayEventsUntilHourStd[targetHour] = stddev(eventsUntilHour)
    activeDayHoursUntilHour[targetHour] = avg(activeUntilHour)
  }

  baselineStats.value = {
    // Dag metrics (06:00-23:00)
    first_day_activity_avg: avg(firstDayActivities),
    first_day_activity_std: stddev(firstDayActivities),
    day_events_avg: avg(dayEvents),
    day_events_std: stddev(dayEvents),
    active_day_hours_avg: avg(activeDayHours),
    active_day_hours_std: stddev(activeDayHours),

    // Nacht metrics (23:00-06:00)
    night_events_avg: avg(nightEvents),
    night_events_std: stddev(nightEvents),

    // Per-uur gemiddelden
    events_per_hour_avg: eventsPerHourAvg,

    // Voor onvolledige dag vergelijking
    day_events_until_hour: dayEventsUntilHour,
    day_events_until_hour_std: dayEventsUntilHourStd,
    active_day_hours_until_hour: activeDayHoursUntilHour
  }
}

// Load last 7 days for trend
async function loadWeekData() {
  const today = new Date()
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

  const { data, error } = await supabase
    .from('daily_activity_stats')
    .select('date, total_events, active_hours, first_activity')
    .gte('date', toLocalDateKey(sevenDaysAgo))
    .lte('date', toLocalDateKey(today))
    .order('date', { ascending: true })

  if (error) {
    console.error('Error loading week data:', error)
    return
  }

  weekData.value = data || []
}

// Sparkline SVG path generator
function sparklinePath(values, width = 120, height = 30) {
  if (!values || values.length === 0) return ''
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  })

  return `M ${points.join(' L ')}`
}

onMounted(async () => {
  try {
    await Promise.all([
      loadTodayStats(),
      loadBaseline(),
      loadWeekData()
    ])
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-4" style="max-width: 1400px;">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Patronen</h1>
      <p class="text-gray-500">Analyse van activiteitspatronen</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-xl shadow-sm border p-12 text-center">
      <div class="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
      <p class="text-gray-500">Data laden...</p>
    </div>

    <template v-else>
      <!-- Data Quality Warning (bovenaan als onvoldoende) -->
      <div v-if="!dataQuality.sufficient" class="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p class="font-medium text-amber-800">Onvoldoende data voor betrouwbare analyse</p>
            <p class="text-sm text-amber-600">
              {{ dataQuality.days }} dagen beschikbaar, minimaal {{ minDaysRequired }} nodig voor goede vergelijking
            </p>
          </div>
        </div>
      </div>

      <!-- Status Card (Vandaag vs Normaal) -->
      <div class="rounded-xl shadow-sm border p-5" :class="statusInfo.bgColor">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-3 h-3 rounded-full" :class="statusInfo.dotColor"></div>
          <div>
            <h2 class="text-lg font-semibold" :class="statusInfo.color">{{ statusInfo.text }}</h2>
            <p v-if="statusInfo.subtext" class="text-sm text-gray-600">{{ statusInfo.subtext }}</p>
            <p class="text-sm text-gray-500">
              {{ isDayInProgress ? `Vergelijking tot ${currentHour}:00` : 'Vergelijking met afgelopen 14 dagen' }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div
            v-for="item in comparisonItems"
            :key="item.label"
            class="bg-gray-50 rounded-lg p-3"
          >
            <div class="flex justify-between items-start mb-1">
              <span class="text-sm text-gray-500">{{ item.label }}</span>
              <span v-if="item.diff.icon" :class="['text-sm font-bold', item.diff.color]">
                {{ item.diff.icon }}
              </span>
            </div>
            <div class="flex items-baseline gap-2">
              <span class="text-xl font-bold text-gray-900">{{ item.today }}</span>
              <span class="text-sm text-gray-400">(normaal {{ item.normal }})</span>
            </div>
            <p v-if="item.note" class="text-xs text-gray-400 mt-1">{{ item.note }}</p>
          </div>
        </div>
      </div>

      <!-- Hourly Activity Chart -->
      <div class="bg-white rounded-xl shadow-sm border p-5">
        <h2 class="text-base font-semibold text-gray-900 mb-1">Activiteit per uur</h2>
        <p class="text-xs text-gray-500 mb-4">Vandaag (gekleurd) vs gemiddelde (grijs)</p>

        <div class="relative h-32">
          <!-- Bars -->
          <div class="flex items-end h-full gap-0.5">
            <div
              v-for="item in hourlyChartData"
              :key="item.hour"
              class="flex-1 flex flex-col items-center gap-0.5 h-full justify-end"
            >
              <!-- Baseline bar (gray, behind) -->
              <div
                class="w-full bg-gray-200 rounded-t"
                :style="{ height: `${(item.baseline / hourlyMaxValue) * 100}%`, minHeight: item.baseline > 0 ? '2px' : '0' }"
              ></div>
            </div>
          </div>
          <!-- Today bars overlay -->
          <div class="absolute inset-0 flex items-end gap-0.5 pointer-events-none">
            <div
              v-for="item in hourlyChartData"
              :key="item.hour"
              class="flex-1 flex flex-col items-center h-full justify-end"
            >
              <div
                class="w-2/3 rounded-t"
                :class="item.today > item.baseline * 1.5 ? 'bg-amber-400' : item.today < item.baseline * 0.5 && item.baseline > 0 ? 'bg-red-400' : 'bg-emerald-500'"
                :style="{ height: `${(item.today / hourlyMaxValue) * 100}%`, minHeight: item.today > 0 ? '2px' : '0' }"
              ></div>
            </div>
          </div>
        </div>

        <!-- Hour labels -->
        <div class="flex mt-1">
          <div
            v-for="h in 24"
            :key="h - 1"
            class="flex-1 text-center text-xs text-gray-400"
          >
            <span v-if="(h - 1) % 4 === 0">{{ h - 1 }}</span>
          </div>
        </div>

        <!-- Legend -->
        <div class="flex justify-center gap-4 mt-3 text-xs text-gray-500">
          <div class="flex items-center gap-1">
            <div class="w-3 h-3 bg-gray-200 rounded"></div>
            <span>Gemiddeld</span>
          </div>
          <div class="flex items-center gap-1">
            <div class="w-3 h-3 bg-emerald-500 rounded"></div>
            <span>Normaal</span>
          </div>
          <div class="flex items-center gap-1">
            <div class="w-3 h-3 bg-amber-400 rounded"></div>
            <span>Meer dan normaal</span>
          </div>
          <div class="flex items-center gap-1">
            <div class="w-3 h-3 bg-red-400 rounded"></div>
            <span>Minder dan normaal</span>
          </div>
        </div>
      </div>

      <!-- Trend Sparklines -->
      <div class="grid grid-cols-3 gap-4">
        <!-- Total Events Trend -->
        <div class="bg-white rounded-xl shadow-sm border p-4">
          <p class="text-sm text-gray-500 mb-1">Momenten (7 dagen)</p>
          <div class="flex items-end gap-2">
            <span class="text-xl font-bold text-gray-900">
              {{ weekData.length > 0 ? weekData[weekData.length - 1]?.total_events || 0 : '--' }}
            </span>
            <svg v-if="trendData" width="80" height="24" class="text-emerald-500">
              <path
                :d="sparklinePath(trendData.events, 80, 24)"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        </div>

        <!-- Active Hours Trend -->
        <div class="bg-white rounded-xl shadow-sm border p-4">
          <p class="text-sm text-gray-500 mb-1">Actieve uren (7 dagen)</p>
          <div class="flex items-end gap-2">
            <span class="text-xl font-bold text-gray-900">
              {{ weekData.length > 0 ? weekData[weekData.length - 1]?.active_hours || 0 : '--' }}
            </span>
            <svg v-if="trendData" width="80" height="24" class="text-blue-500">
              <path
                :d="sparklinePath(trendData.activeHours, 80, 24)"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        </div>

        <!-- First Activity Trend -->
        <div class="bg-white rounded-xl shadow-sm border p-4">
          <p class="text-sm text-gray-500 mb-1">Eerste activiteit (7 dagen)</p>
          <div class="flex items-end gap-2">
            <span class="text-xl font-bold text-gray-900">
              {{ weekData.length > 0 ? formatTime(weekData[weekData.length - 1]?.first_activity) : '--:--' }}
            </span>
            <svg v-if="trendData" width="80" height="24" class="text-purple-500">
              <path
                :d="sparklinePath(trendData.firstActivity, 80, 24)"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>

      <!-- Data Quality Indicator (alleen als voldoende) -->
      <div v-if="dataQuality.sufficient" class="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
            <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p class="font-medium text-emerald-700">Betrouwbare analyse</p>
            <p class="text-sm text-emerald-600">Gebaseerd op {{ dataQuality.days }} dagen data</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
