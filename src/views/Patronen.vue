<script setup>
import { ref, computed, onMounted } from 'vue'
import { getHueConfig, activityDb } from '../services/supabase'
import {
  MINIMUM_DAYS_REQUIRED,
  calculateDayStart,
  toLocalDateKey,
  timeToMinutes,
  avg,
  awakeDuration,
} from '../composables/useDataQuality'
import PatronenDagritme from '../components/PatronenDagritme.vue'
import PatronenVandaag from '../components/PatronenVandaag.vue'
import PatronenTrends from '../components/PatronenTrends.vue'

// State
const loading = ref(true)
const hasConfig = ref(true)
const historicalData = ref([])
const todayStats = ref(null)

// Date helpers
const days = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
const fullDays = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']

function formatShortDate(dateStr) {
  const d = new Date(dateStr)
  return `${days[d.getDay()]} ${d.getDate()}`
}

// Load daily stats for last 14 days + today
async function loadData() {
  const today = toLocalDateKey(new Date())
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const { data, error } = await activityDb()
    .from('daily_activity_stats')
    .select('*')
    .gte('date', toLocalDateKey(fourteenDaysAgo))
    .order('date', { ascending: true })

  if (error) { console.error('Error loading pattern data:', error); return }
  if (!data) return

  todayStats.value = data.find(d => d.date === today) || null
  historicalData.value = data.filter(d => d.date !== today && d.total_events > 0)
}

// === DAGRITME ===

const hasEnoughData = computed(() => historicalData.value.length >= MINIMUM_DAYS_REQUIRED)
const currentHour = computed(() => new Date().getHours())

const averageHourlyPattern = computed(() => {
  if (!hasEnoughData.value) return Array(24).fill(0)
  const hourlyTotals = Array(24).fill(0)
  let count = 0
  for (const day of historicalData.value) {
    if (day.events_per_hour && day.events_per_hour.length === 24) {
      count++
      for (let h = 0; h < 24; h++) hourlyTotals[h] += day.events_per_hour[h] || 0
    }
  }
  if (count === 0) return Array(24).fill(0)
  return hourlyTotals.map(t => Math.round(t / count))
})

const maxHourlyAvg = computed(() => Math.max(...averageHourlyPattern.value, 1))

// Stats voor PatronenDagritme component
const dagritmeStats = computed(() => {
  const times = historicalData.value.map(d => calculateDayStart(d.events_per_hour)).filter(t => t !== null)
  const bedTimes = historicalData.value.map(d => timeToMinutes(d.last_activity)).filter(t => t > 0)
  const awakeDurations = historicalData.value.map(d => awakeDuration(d.first_activity, d.last_activity)).filter(v => v !== null)
  const activeHoursValues = historicalData.value.map(d => d.active_hours).filter(v => v != null)
  const dailyEvents = historicalData.value.map(d => d.total_events).filter(v => v != null)
  const longestGapValues = historicalData.value.map(d => d.longest_gap_minutes).filter(v => v != null)

  return {
    avgWakeUp: times.length > 0 ? Math.round(avg(times)) : null,
    avgBedTime: bedTimes.length > 0 ? Math.round(avg(bedTimes)) : null,
    avgAwakeDuration: awakeDurations.length > 0 ? Math.round(avg(awakeDurations)) : null,
    avgActiveHours: activeHoursValues.length > 0 ? avg(activeHoursValues) : null,
    avgDailyEvents: dailyEvents.length > 0 ? Math.round(avg(dailyEvents)) : null,
    avgLongestGap: longestGapValues.length > 0 ? Math.round(avg(longestGapValues)) : null,
  }
})

// === WEEKDAG ANALYSE ===

const weekdayAnalysis = computed(() => {
  if (!hasEnoughData.value) return null
  const byDay = [[], [], [], [], [], [], []]
  for (const day of historicalData.value) {
    const dow = new Date(day.date).getDay()
    byDay[dow].push(day.total_events || 0)
  }
  return byDay.map((events, idx) => ({
    day: days[idx],
    fullDay: fullDays[idx],
    avg: events.length > 0 ? Math.round(avg(events)) : 0,
    count: events.length,
  }))
})

const maxWeekdayAvg = computed(() => {
  if (!weekdayAnalysis.value) return 1
  return Math.max(...weekdayAnalysis.value.map(d => d.avg), 1)
})

// === TRENDS ===

const allDataSorted = computed(() => {
  const all = [...historicalData.value]
  if (todayStats.value) all.push(todayStats.value)
  return all.sort((a, b) => a.date.localeCompare(b.date))
})

const trendEvents = computed(() => allDataSorted.value.map(d => d.total_events || 0))
const trendActiveHours = computed(() => allDataSorted.value.map(d => d.active_hours || 0))
const trendNightEvents = computed(() => allDataSorted.value.map(d => d.night_events || 0))
const trendLongestGap = computed(() => allDataSorted.value.map(d => d.longest_gap_minutes || 0))
const trendAwakeDuration = computed(() => allDataSorted.value.map(d => {
  const dur = awakeDuration(d.first_activity, d.last_activity)
  return dur !== null ? dur : 0
}))
const trendDates = computed(() => allDataSorted.value.map(d => formatShortDate(d.date)))

onMounted(async () => {
  try {
    const config = await getHueConfig()
    if (!config) { hasConfig.value = false; return }
    await loadData()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6" style="max-width: 1400px;">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Patronen</h1>
      <p class="text-gray-500">Analyse van activiteitspatronen</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-lg border border-gray-200 p-12 text-center">
      <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
      <p class="text-gray-500">Patronen analyseren...</p>
    </div>

    <!-- No Hue config -->
    <div v-else-if="!hasConfig" class="bg-white rounded-lg border border-gray-200 p-12 text-center">
      <div class="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <h2 class="text-lg font-semibold text-gray-900 mb-2">Verbind je Hue Bridge</h2>
      <p class="text-gray-500 mb-4">Koppel eerst je Philips Hue Bridge om patronen te analyseren.</p>
      <router-link to="/instellingen" class="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors">
        Naar Instellingen
      </router-link>
    </div>

    <!-- Not enough data -->
    <div v-else-if="!hasEnoughData" class="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
      <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <h2 class="text-xl font-semibold text-blue-900 mb-2">Nog even geduld</h2>
      <p class="text-blue-700 mb-2">
        We hebben minimaal {{ MINIMUM_DAYS_REQUIRED }} dagen data nodig voor betrouwbare patroonherkenning.
      </p>
      <p class="text-blue-600 text-sm">
        Nu beschikbaar: {{ historicalData.length }} {{ historicalData.length === 1 ? 'dag' : 'dagen' }} met activiteit
      </p>
    </div>

    <template v-else>
      <PatronenDagritme
        :averageHourlyPattern="averageHourlyPattern"
        :maxHourlyAvg="maxHourlyAvg"
        :historicalCount="historicalData.length"
        :stats="dagritmeStats"
      />

      <PatronenVandaag
        :todayStats="todayStats"
        :historicalData="historicalData"
        :averageHourlyPattern="averageHourlyPattern"
        :currentHour="currentHour"
      />

      <!-- Weekpatroon -->
      <div v-if="weekdayAnalysis" class="bg-white border border-gray-200 rounded-lg p-5">
        <h2 class="text-base font-semibold text-gray-900 mb-1">Weekpatroon</h2>
        <p class="text-sm text-gray-500 mb-4">Gemiddelde activiteit per weekdag</p>

        <div class="flex items-end gap-2 h-28">
          <div
            v-for="day in weekdayAnalysis"
            :key="day.day"
            class="flex-1 flex flex-col items-center group relative"
          >
            <div class="text-xs font-medium text-gray-700 mb-1">{{ day.avg }}</div>
            <div
              class="w-full rounded-t transition-all"
              :class="day.avg > 0 ? 'bg-primary-400 group-hover:bg-primary-500' : 'bg-gray-100'"
              :style="{ height: `${Math.max(4, (day.avg / maxWeekdayAvg) * 100)}%` }"
            ></div>
            <div class="text-xs font-medium text-gray-500 mt-1">{{ day.day }}</div>
            <div class="absolute bottom-full mb-6 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
              {{ day.fullDay }}: gem. {{ day.avg }} events ({{ day.count }}x)
            </div>
          </div>
        </div>
      </div>

      <PatronenTrends
        :events="trendEvents"
        :activeHours="trendActiveHours"
        :nightEvents="trendNightEvents"
        :longestGap="trendLongestGap"
        :awakeDuration="trendAwakeDuration"
        :dates="trendDates"
        :totalDays="allDataSorted.length"
      />

      <div class="text-xs text-gray-400 text-center">
        Gebaseerd op {{ historicalData.length }} dagen met activiteit
      </div>
    </template>
  </div>
</template>
