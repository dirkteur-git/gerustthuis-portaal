<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase, getHueConfig } from '../services/supabase'
import {
  MINIMUM_DAYS_REQUIRED,
  calculateDayStart,
  formatMinutesToTime,
  toLocalDateKey,
  timeToMinutes,
  avg,
  stddev
} from '../composables/useDataQuality'

// State
const loading = ref(true)
const hasConfig = ref(true)
const historicalData = ref([]) // last 14 days of daily_activity_stats
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

  const { data, error } = await supabase
    .from('daily_activity_stats')
    .select('*')
    .gte('date', toLocalDateKey(fourteenDaysAgo))
    .order('date', { ascending: true })

  if (error) {
    console.error('Error loading pattern data:', error)
    return
  }

  if (!data) return

  // Split today vs history
  todayStats.value = data.find(d => d.date === today) || null
  historicalData.value = data.filter(d => d.date !== today && d.total_events > 0)
}

// === DAGRITME ===

const hasEnoughData = computed(() => historicalData.value.length >= MINIMUM_DAYS_REQUIRED)

// Gemiddeld dagpatroon: per uur het gemiddeld aantal events
const averageHourlyPattern = computed(() => {
  if (!hasEnoughData.value) return Array(24).fill(0)

  const hourlyTotals = Array(24).fill(0)
  let count = 0

  for (const day of historicalData.value) {
    if (day.events_per_hour && day.events_per_hour.length === 24) {
      count++
      for (let h = 0; h < 24; h++) {
        hourlyTotals[h] += day.events_per_hour[h] || 0
      }
    }
  }

  if (count === 0) return Array(24).fill(0)
  return hourlyTotals.map(t => Math.round(t / count))
})

const maxHourlyAvg = computed(() => Math.max(...averageHourlyPattern.value, 1))

// Gemiddeld opstaan
const avgWakeUp = computed(() => {
  const times = historicalData.value
    .map(d => calculateDayStart(d.events_per_hour))
    .filter(t => t !== null)
  if (times.length === 0) return null
  return Math.round(avg(times))
})

// Gemiddeld naar bed (laatste activiteit)
const avgBedTime = computed(() => {
  const times = historicalData.value
    .map(d => timeToMinutes(d.last_activity))
    .filter(t => t > 0)
  if (times.length === 0) return null
  return Math.round(avg(times))
})

// Gemiddeld actieve uren per dag
const avgActiveHours = computed(() => {
  const values = historicalData.value.map(d => d.active_hours).filter(v => v != null)
  if (values.length === 0) return null
  return avg(values)
})

// Gemiddeld events per dag
const avgDailyEvents = computed(() => {
  const values = historicalData.value.map(d => d.total_events).filter(v => v != null)
  if (values.length === 0) return null
  return Math.round(avg(values))
})

// === VANDAAG VS NORMAAL ===

const comparisonMetrics = computed(() => {
  if (!todayStats.value || !hasEnoughData.value) return null

  const metrics = []

  // Opstaan
  const todayWake = calculateDayStart(todayStats.value.events_per_hour)
  if (todayWake !== null && avgWakeUp.value !== null) {
    const diff = todayWake - avgWakeUp.value
    metrics.push({
      label: 'Opgestaan',
      today: formatMinutesToTime(todayWake),
      average: formatMinutesToTime(avgWakeUp.value),
      diff: diff,
      diffText: diff === 0 ? 'normaal' : `${Math.abs(diff)} min ${diff > 0 ? 'later' : 'eerder'}`,
      severity: Math.abs(diff) > 60 ? 'high' : Math.abs(diff) > 30 ? 'medium' : 'low'
    })
  }

  // Laatste activiteit
  const todayLast = timeToMinutes(todayStats.value.last_activity)
  if (todayLast > 0 && avgBedTime.value !== null) {
    const diff = todayLast - avgBedTime.value
    metrics.push({
      label: 'Laatste activiteit',
      today: formatMinutesToTime(todayLast),
      average: formatMinutesToTime(avgBedTime.value),
      diff: diff,
      diffText: diff === 0 ? 'normaal' : `${Math.abs(diff)} min ${diff > 0 ? 'later' : 'eerder'}`,
      severity: Math.abs(diff) > 60 ? 'high' : Math.abs(diff) > 30 ? 'medium' : 'low'
    })
  }

  // Totaal events
  const todayEvents = todayStats.value.total_events || 0
  const avgEvents = avgDailyEvents.value
  if (avgEvents !== null && avgEvents > 0) {
    const pct = Math.round(((todayEvents - avgEvents) / avgEvents) * 100)
    metrics.push({
      label: 'Activiteit',
      today: `${todayEvents}`,
      average: `${avgEvents}`,
      diff: pct,
      diffText: pct === 0 ? 'normaal' : `${Math.abs(pct)}% ${pct > 0 ? 'meer' : 'minder'}`,
      severity: Math.abs(pct) > 50 ? 'high' : Math.abs(pct) > 25 ? 'medium' : 'low'
    })
  }

  // Actieve uren
  const todayActive = todayStats.value.active_hours || 0
  if (avgActiveHours.value !== null) {
    const diff = todayActive - avgActiveHours.value
    metrics.push({
      label: 'Actieve uren',
      today: `${todayActive}u`,
      average: `${avgActiveHours.value.toFixed(1)}u`,
      diff: diff,
      diffText: Math.abs(diff) < 0.5 ? 'normaal' : `${Math.abs(diff).toFixed(1)}u ${diff > 0 ? 'meer' : 'minder'}`,
      severity: Math.abs(diff) > 4 ? 'high' : Math.abs(diff) > 2 ? 'medium' : 'low'
    })
  }

  // Nacht events
  const todayNight = todayStats.value.night_events || 0
  const avgNight = avg(historicalData.value.map(d => d.night_events).filter(v => v != null))
  if (avgNight !== null) {
    const diff = todayNight - avgNight
    metrics.push({
      label: 'Nachtactiviteit',
      today: `${todayNight}`,
      average: `${Math.round(avgNight)}`,
      diff: diff,
      diffText: Math.abs(diff) < 2 ? 'normaal' : `${Math.abs(diff).toFixed(0)} ${diff > 0 ? 'meer' : 'minder'}`,
      severity: Math.abs(diff) > 10 ? 'high' : Math.abs(diff) > 5 ? 'medium' : 'low'
    })
  }

  return metrics
})

// Vandaag vs normaal uurpatroon vergelijking
const todayVsAvgHourly = computed(() => {
  if (!todayStats.value?.events_per_hour || !hasEnoughData.value) return null
  return {
    today: todayStats.value.events_per_hour,
    avg: averageHourlyPattern.value
  }
})

const maxComparisonHourly = computed(() => {
  if (!todayVsAvgHourly.value) return 1
  return Math.max(
    ...todayVsAvgHourly.value.today,
    ...todayVsAvgHourly.value.avg,
    1
  )
})

// === TRENDS ===

// Alle data inclusief vandaag, gesorteerd op datum
const allDataSorted = computed(() => {
  const all = [...historicalData.value]
  if (todayStats.value) all.push(todayStats.value)
  return all.sort((a, b) => a.date.localeCompare(b.date))
})

// Trend sparkline path generator
function trendPath(values, width = 400, height = 60) {
  if (!values || values.length < 2) return ''
  const max = Math.max(...values, 1)
  const points = values.map((val, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - (val / max) * (height - 8) - 4
    return `${x},${y}`
  })
  return `M ${points.join(' L ')}`
}

// Trend data
const trendEvents = computed(() => allDataSorted.value.map(d => d.total_events || 0))
const trendActiveHours = computed(() => allDataSorted.value.map(d => d.active_hours || 0))
const trendNightEvents = computed(() => allDataSorted.value.map(d => d.night_events || 0))
const trendDates = computed(() => allDataSorted.value.map(d => formatShortDate(d.date)))

// Weekdag analyse
const weekdayAnalysis = computed(() => {
  if (!hasEnoughData.value) return null

  const byDay = [[], [], [], [], [], [], []] // zo - za

  for (const day of historicalData.value) {
    const d = new Date(day.date)
    const dow = d.getDay()
    byDay[dow].push(day.total_events || 0)
  }

  return byDay.map((events, idx) => ({
    day: days[idx],
    fullDay: fullDays[idx],
    avg: events.length > 0 ? Math.round(avg(events)) : 0,
    count: events.length
  }))
})

const maxWeekdayAvg = computed(() => {
  if (!weekdayAnalysis.value) return 1
  return Math.max(...weekdayAnalysis.value.map(d => d.avg), 1)
})

onMounted(async () => {
  try {
    const config = await getHueConfig()
    if (!config) {
      hasConfig.value = false
      return
    }
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
      <div class="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
      <p class="text-gray-500">Patronen analyseren...</p>
    </div>

    <!-- No Hue config -->
    <div v-else-if="!hasConfig" class="bg-white rounded-lg border border-gray-200 p-12 text-center">
      <div class="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <h2 class="text-lg font-semibold text-gray-900 mb-2">Verbind je Hue Bridge</h2>
      <p class="text-gray-500 mb-4">Koppel eerst je Philips Hue Bridge om patronen te analyseren.</p>
      <router-link to="/instellingen" class="inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors">
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
      <!-- ==================== -->
      <!-- DAGRITME -->
      <!-- ==================== -->
      <div class="bg-white border border-gray-200 rounded-lg p-5">
        <h2 class="text-base font-semibold text-gray-900 mb-1">Dagritme</h2>
        <p class="text-sm text-gray-500 mb-4">Gemiddeld activiteitspatroon over {{ historicalData.length }} dagen</p>

        <!-- Kerngetallen -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div class="bg-gray-50 rounded-lg p-3">
            <div class="text-lg font-bold text-gray-900">{{ avgWakeUp ? formatMinutesToTime(avgWakeUp) : '-' }}</div>
            <div class="text-xs text-gray-500">Gem. opstaan</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <div class="text-lg font-bold text-gray-900">{{ avgBedTime ? formatMinutesToTime(avgBedTime) : '-' }}</div>
            <div class="text-xs text-gray-500">Gem. laatste activiteit</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <div class="text-lg font-bold text-gray-900">{{ avgActiveHours ? avgActiveHours.toFixed(1) + 'u' : '-' }}</div>
            <div class="text-xs text-gray-500">Gem. actieve uren</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <div class="text-lg font-bold text-gray-900">{{ avgDailyEvents ?? '-' }}</div>
            <div class="text-xs text-gray-500">Gem. events/dag</div>
          </div>
        </div>

        <!-- Gemiddeld uurpatroon -->
        <div class="flex items-end gap-px h-24">
          <div
            v-for="(count, hour) in averageHourlyPattern"
            :key="hour"
            class="flex-1 flex flex-col items-center group relative"
          >
            <div
              class="w-full rounded-t transition-all"
              :class="count > 0 ? 'bg-emerald-400 group-hover:bg-emerald-500' : 'bg-gray-100'"
              :style="{ height: `${Math.max(2, (count / maxHourlyAvg) * 100)}%` }"
            ></div>
            <div v-if="hour % 3 === 0" class="text-[10px] text-gray-400 mt-1">{{ String(hour).padStart(2, '0') }}</div>
            <div v-else class="h-3 mt-1"></div>

            <!-- Tooltip -->
            <div class="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
              {{ String(hour).padStart(2, '0') }}:00 - {{ count }} events
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== -->
      <!-- VANDAAG VS NORMAAL -->
      <!-- ==================== -->
      <div v-if="comparisonMetrics && comparisonMetrics.length > 0" class="bg-white border border-gray-200 rounded-lg p-5">
        <h2 class="text-base font-semibold text-gray-900 mb-1">Vandaag vs normaal</h2>
        <p class="text-sm text-gray-500 mb-4">Vergelijking met het gemiddelde van de afgelopen {{ historicalData.length }} dagen</p>

        <div class="space-y-3">
          <div
            v-for="metric in comparisonMetrics"
            :key="metric.label"
            class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
          >
            <div class="flex-1">
              <div class="text-sm font-medium text-gray-900">{{ metric.label }}</div>
              <div class="text-xs text-gray-500">normaal: {{ metric.average }}</div>
            </div>
            <div class="flex items-center gap-3">
              <div class="text-sm font-mono font-medium text-gray-900">{{ metric.today }}</div>
              <div
                class="text-xs font-medium px-2 py-0.5 rounded-full"
                :class="{
                  'bg-emerald-100 text-emerald-700': metric.severity === 'low',
                  'bg-amber-100 text-amber-700': metric.severity === 'medium',
                  'bg-red-100 text-red-700': metric.severity === 'high'
                }"
              >
                {{ metric.diffText }}
              </div>
            </div>
          </div>
        </div>

        <!-- Uurvergelijking chart -->
        <div v-if="todayVsAvgHourly" class="mt-6">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Uurverdeling: vandaag vs gemiddeld</h3>
          <div class="flex items-end gap-px h-20">
            <div
              v-for="hour in 24"
              :key="hour - 1"
              class="flex-1 flex flex-col items-center gap-px"
            >
              <!-- Vandaag bar -->
              <div class="w-full flex flex-col items-center gap-px" :style="{ height: '100%' }">
                <div class="w-full flex items-end gap-px" style="height: 80px;">
                  <!-- Gemiddeld (achtergrond) -->
                  <div
                    class="flex-1 bg-gray-200 rounded-t"
                    :style="{ height: `${Math.max(1, (todayVsAvgHourly.avg[hour - 1] / maxComparisonHourly) * 100)}%` }"
                  ></div>
                  <!-- Vandaag (voorgrond) -->
                  <div
                    class="flex-1 rounded-t"
                    :class="todayVsAvgHourly.today[hour - 1] > 0 ? 'bg-emerald-500' : 'bg-gray-100'"
                    :style="{ height: `${Math.max(1, (todayVsAvgHourly.today[hour - 1] / maxComparisonHourly) * 100)}%` }"
                  ></div>
                </div>
              </div>
              <div v-if="(hour - 1) % 6 === 0" class="text-[10px] text-gray-400">{{ String(hour - 1).padStart(2, '0') }}</div>
              <div v-else class="h-3"></div>
            </div>
          </div>
          <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span class="flex items-center gap-1">
              <span class="w-3 h-2 bg-gray-200 rounded"></span> Gemiddeld
            </span>
            <span class="flex items-center gap-1">
              <span class="w-3 h-2 bg-emerald-500 rounded"></span> Vandaag
            </span>
          </div>
        </div>
      </div>

      <!-- Geen data vandaag -->
      <div v-else-if="!todayStats" class="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div class="flex items-center gap-3">
          <svg class="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p class="text-sm text-amber-800">Nog geen data voor vandaag. De vergelijking verschijnt zodra er activiteit is.</p>
        </div>
      </div>

      <!-- ==================== -->
      <!-- WEEKDAG ANALYSE -->
      <!-- ==================== -->
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
              :class="day.avg > 0 ? 'bg-emerald-400 group-hover:bg-emerald-500' : 'bg-gray-100'"
              :style="{ height: `${Math.max(4, (day.avg / maxWeekdayAvg) * 100)}%` }"
            ></div>
            <div class="text-xs font-medium text-gray-500 mt-1">{{ day.day }}</div>

            <!-- Tooltip -->
            <div class="absolute bottom-full mb-6 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
              {{ day.fullDay }}: gem. {{ day.avg }} events ({{ day.count }}x)
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== -->
      <!-- TRENDS -->
      <!-- ==================== -->
      <div class="bg-white border border-gray-200 rounded-lg p-5">
        <h2 class="text-base font-semibold text-gray-900 mb-1">Trends</h2>
        <p class="text-sm text-gray-500 mb-4">Activiteitsontwikkeling over {{ allDataSorted.length }} dagen</p>

        <!-- Totaal events trend -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-700">Totaal events per dag</span>
            <span class="text-xs text-gray-500">{{ trendEvents[trendEvents.length - 1] || 0 }} vandaag</span>
          </div>
          <div class="h-16 relative">
            <svg viewBox="0 0 400 60" class="w-full h-full" preserveAspectRatio="none">
              <!-- Achtergrond grid -->
              <line x1="0" y1="30" x2="400" y2="30" stroke="#f3f4f6" stroke-width="1" />
              <!-- Lijn -->
              <path
                :d="trendPath(trendEvents)"
                fill="none"
                stroke="#10b981"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <div class="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>{{ trendDates[0] || '' }}</span>
            <span>{{ trendDates[trendDates.length - 1] || '' }}</span>
          </div>
        </div>

        <!-- Actieve uren trend -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-700">Actieve uren per dag</span>
            <span class="text-xs text-gray-500">{{ trendActiveHours[trendActiveHours.length - 1] || 0 }}u vandaag</span>
          </div>
          <div class="h-16 relative">
            <svg viewBox="0 0 400 60" class="w-full h-full" preserveAspectRatio="none">
              <line x1="0" y1="30" x2="400" y2="30" stroke="#f3f4f6" stroke-width="1" />
              <path
                :d="trendPath(trendActiveHours)"
                fill="none"
                stroke="#3b82f6"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <div class="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>{{ trendDates[0] || '' }}</span>
            <span>{{ trendDates[trendDates.length - 1] || '' }}</span>
          </div>
        </div>

        <!-- Nacht events trend -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-700">Nachtactiviteit</span>
            <span class="text-xs text-gray-500">{{ trendNightEvents[trendNightEvents.length - 1] || 0 }} events vannacht</span>
          </div>
          <div class="h-16 relative">
            <svg viewBox="0 0 400 60" class="w-full h-full" preserveAspectRatio="none">
              <line x1="0" y1="30" x2="400" y2="30" stroke="#f3f4f6" stroke-width="1" />
              <path
                :d="trendPath(trendNightEvents)"
                fill="none"
                stroke="#8b5cf6"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <div class="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>{{ trendDates[0] || '' }}</span>
            <span>{{ trendDates[trendDates.length - 1] || '' }}</span>
          </div>
        </div>
      </div>

      <!-- Data info footer -->
      <div class="text-xs text-gray-400 text-center">
        Gebaseerd op {{ historicalData.length }} dagen met activiteit
      </div>
    </template>
  </div>
</template>
