<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '../services/supabase'

// State
const loading = ref(true)
const selectedDate = ref(toLocalDateKey(new Date()))
const dayStats = ref(null)
const baselineStats = ref(null)
const dataQuality = ref(null)

// Datum helpers
function toLocalDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateDisplay(dateStr) {
  const d = new Date(dateStr)
  const days = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}

// Navigeer naar vorige/volgende dag
function prevDay() {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() - 1)
  selectedDate.value = toLocalDateKey(d)
}

function nextDay() {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() + 1)
  const today = new Date()
  if (d <= today) {
    selectedDate.value = toLocalDateKey(d)
  }
}

const isToday = computed(() => selectedDate.value === toLocalDateKey(new Date()))

// Anomaly score features
const features = [
  { key: 'total_events', label: 'Totaal events', unit: '' },
  { key: 'first_activity', label: 'Eerste activiteit', unit: 'min', isTime: true },
  { key: 'last_activity', label: 'Laatste activiteit', unit: 'min', isTime: true },
  { key: 'active_hours', label: 'Actieve uren', unit: 'u' },
  { key: 'longest_gap_minutes', label: 'Langste gap', unit: 'min' },
  { key: 'night_events', label: 'Nacht events', unit: '' },
]

// Time to minutes helper
function timeToMinutes(time) {
  if (!time) return null
  const parts = time.split(':')
  return parseInt(parts[0]) * 60 + parseInt(parts[1])
}

function minutesToTime(minutes) {
  if (minutes === null || minutes === undefined) return '-'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Bereken z-score
function calculateZScore(value, mean, stddev) {
  if (stddev === 0 || stddev === null || value === null || mean === null) return 0
  return (value - mean) / stddev
}

// Score breakdown computed
const scoreBreakdown = computed(() => {
  if (!dayStats.value || !baselineStats.value) return []

  return features.map(feature => {
    let todayValue = dayStats.value[feature.key]
    let baselineValue = baselineStats.value[`avg_${feature.key}`]
    let stddev = baselineStats.value[`std_${feature.key}`]

    // Convert time fields to minutes
    if (feature.isTime) {
      todayValue = timeToMinutes(todayValue)
      baselineValue = baselineStats.value[`avg_${feature.key}_minutes`]
      stddev = baselineStats.value[`std_${feature.key}_minutes`]
    }

    const zScore = calculateZScore(todayValue, baselineValue, stddev)
    const absZ = Math.abs(zScore)

    return {
      label: feature.label,
      todayValue: feature.isTime ? minutesToTime(todayValue) : (todayValue ?? '-'),
      baselineValue: feature.isTime ? minutesToTime(baselineValue) : (baselineValue?.toFixed(1) ?? '-'),
      stddev: stddev?.toFixed(2) ?? '-',
      zScore: zScore,
      zScoreDisplay: zScore.toFixed(2),
      severity: absZ > 2 ? 'high' : absZ > 1 ? 'medium' : 'low'
    }
  })
})

// Anomaly score (max absolute z-score, genormaliseerd naar 0-1)
const anomalyScore = computed(() => {
  if (scoreBreakdown.value.length === 0) return 0
  const maxAbsZ = Math.max(...scoreBreakdown.value.map(s => Math.abs(s.zScore)))
  // Normaliseer: z=3 = score 1.0
  return Math.min(1, maxAbsZ / 3)
})

const anomalyLabel = computed(() => {
  const score = anomalyScore.value
  if (score < 0.33) return { text: 'Normaal', color: 'emerald' }
  if (score < 0.66) return { text: 'Afwijkend', color: 'amber' }
  return { text: 'Sterk afwijkend', color: 'red' }
})

// Load data for selected date
async function loadDayStats() {
  const { data, error } = await supabase
    .from('daily_activity_stats')
    .select('*')
    .eq('date', selectedDate.value)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error loading day stats:', error)
  }

  dayStats.value = data || null
}

// Load baseline stats (last 14 days excluding selected date)
async function loadBaselineStats() {
  const selected = new Date(selectedDate.value)
  const fourteenDaysAgo = new Date(selected)
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const { data, error } = await supabase
    .from('daily_activity_stats')
    .select('*')
    .gte('date', toLocalDateKey(fourteenDaysAgo))
    .lt('date', selectedDate.value)

  if (error) {
    console.error('Error loading baseline stats:', error)
    return
  }

  if (!data || data.length === 0) {
    baselineStats.value = null
    return
  }

  // Bereken gemiddelden en standaarddeviaties
  const stats = {}

  features.forEach(feature => {
    let values = data.map(d => d[feature.key]).filter(v => v !== null && v !== undefined)

    if (feature.isTime) {
      // Convert times to minutes
      values = values.map(timeToMinutes).filter(v => v !== null)
    }

    if (values.length > 0) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length
      const std = Math.sqrt(variance)

      if (feature.isTime) {
        stats[`avg_${feature.key}_minutes`] = avg
        stats[`std_${feature.key}_minutes`] = std
        stats[`min_${feature.key}_minutes`] = Math.min(...values)
        stats[`max_${feature.key}_minutes`] = Math.max(...values)
      } else {
        stats[`avg_${feature.key}`] = avg
        stats[`std_${feature.key}`] = std
        stats[`min_${feature.key}`] = Math.min(...values)
        stats[`max_${feature.key}`] = Math.max(...values)
      }
    }
  })

  stats.daysCount = data.length
  baselineStats.value = stats
}

// Load data quality info
async function loadDataQuality() {
  // Check hoeveel dagen we data hebben
  const { data: allDays, error: daysError } = await supabase
    .from('daily_activity_stats')
    .select('date, total_events')
    .order('date', { ascending: false })
    .limit(30)

  if (daysError) {
    console.error('Error loading data quality:', daysError)
    return
  }

  // Check sensor status
  const { data: sensors, error: sensorsError } = await supabase
    .from('hue_devices')
    .select('id, name, room_name, device_type, last_state_at')
    .in('device_type', ['motion_sensor', 'contact_sensor'])

  if (sensorsError) {
    console.error('Error loading sensors:', sensorsError)
    return
  }

  const now = new Date()
  const ninetyMinutesAgo = new Date(now.getTime() - 90 * 60 * 1000)

  const offlineSensors = sensors.filter(s => {
    if (!s.last_state_at) return true
    return new Date(s.last_state_at) < ninetyMinutesAgo
  })

  // Check events vandaag
  const today = toLocalDateKey(new Date())
  const { data: todayEvents, error: todayError } = await supabase
    .from('activity_events')
    .select('id', { count: 'exact', head: true })
    .gte('recorded_at', `${today}T00:00:00`)

  dataQuality.value = {
    totalDaysWithData: allDays?.length || 0,
    daysWithLowActivity: allDays?.filter(d => d.total_events < 10).length || 0,
    totalSensors: sensors?.length || 0,
    offlineSensors: offlineSensors?.length || 0,
    offlineSensorsList: offlineSensors?.map(s => s.room_name || s.name) || [],
    todayEventsCount: todayEvents?.length || 0
  }
}

async function loadAllData() {
  loading.value = true
  try {
    await Promise.all([
      loadDayStats(),
      loadBaselineStats(),
      loadDataQuality()
    ])
  } finally {
    loading.value = false
  }
}

// Watch for date changes
watch(selectedDate, () => {
  loadAllData()
})

onMounted(() => {
  loadAllData()
})
</script>

<template>
  <div class="space-y-6" style="max-width: 1400px;">
    <!-- Header met developer badge -->
    <div class="flex items-center justify-between">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold text-gray-900">Analyse</h1>
          <span class="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
            Developer
          </span>
        </div>
        <p class="text-gray-500">Debug tools voor anomaly detection</p>
      </div>
    </div>

    <!-- Date Selector -->
    <div class="bg-white border border-gray-200 rounded-lg p-4">
      <div class="flex items-center justify-between">
        <button
          @click="prevDay"
          class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div class="text-center">
          <div class="text-lg font-semibold text-gray-900">
            {{ formatDateDisplay(selectedDate) }}
          </div>
          <div class="text-sm text-gray-500">
            {{ selectedDate }}
          </div>
        </div>

        <button
          @click="nextDay"
          :disabled="isToday"
          class="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-lg border p-12 text-center">
      <div class="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
      <p class="text-gray-500">Data laden...</p>
    </div>

    <template v-else>
      <!-- No data warning -->
      <div v-if="!dayStats" class="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div class="flex items-center gap-3">
          <svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p class="text-amber-800">Geen data beschikbaar voor deze datum</p>
        </div>
      </div>

      <template v-else>
        <!-- Anomaly Score Card -->
        <div class="bg-white border border-gray-200 rounded-lg p-5">
          <h2 class="text-base font-semibold text-gray-900 mb-4">Anomaly Score</h2>

          <!-- Score display -->
          <div class="flex items-center gap-4 mb-4">
            <div class="text-4xl font-bold" :class="{
              'text-emerald-600': anomalyLabel.color === 'emerald',
              'text-amber-600': anomalyLabel.color === 'amber',
              'text-red-600': anomalyLabel.color === 'red'
            }">
              {{ (anomalyScore * 100).toFixed(0) }}%
            </div>
            <div>
              <div class="font-medium" :class="{
                'text-emerald-700': anomalyLabel.color === 'emerald',
                'text-amber-700': anomalyLabel.color === 'amber',
                'text-red-700': anomalyLabel.color === 'red'
              }">
                {{ anomalyLabel.text }}
              </div>
              <div class="text-sm text-gray-500">
                Gebaseerd op {{ baselineStats?.daysCount || 0 }} dagen baseline
              </div>
            </div>
          </div>

          <!-- Progress bar -->
          <div class="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="{
                'bg-emerald-500': anomalyLabel.color === 'emerald',
                'bg-amber-500': anomalyLabel.color === 'amber',
                'bg-red-500': anomalyLabel.color === 'red'
              }"
              :style="{ width: `${anomalyScore * 100}%` }"
            ></div>
          </div>

          <!-- Scale labels -->
          <div class="flex justify-between text-xs text-gray-400 mt-1">
            <span>0 (normaal)</span>
            <span>0.33</span>
            <span>0.66</span>
            <span>1.0 (afwijkend)</span>
          </div>
        </div>

        <!-- Score Breakdown Table -->
        <div class="bg-white border border-gray-200 rounded-lg p-5">
          <h2 class="text-base font-semibold text-gray-900 mb-4">Score Breakdown</h2>

          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-gray-500 border-b">
                  <th class="pb-2 font-medium">Feature</th>
                  <th class="pb-2 font-medium text-right">Vandaag</th>
                  <th class="pb-2 font-medium text-right">Baseline (μ)</th>
                  <th class="pb-2 font-medium text-right">Std (σ)</th>
                  <th class="pb-2 font-medium text-right">Z-score</th>
                  <th class="pb-2 font-medium w-32"></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in scoreBreakdown"
                  :key="row.label"
                  class="border-b border-gray-100 last:border-0"
                >
                  <td class="py-3 font-medium text-gray-900">{{ row.label }}</td>
                  <td class="py-3 text-right font-mono">{{ row.todayValue }}</td>
                  <td class="py-3 text-right font-mono text-gray-500">{{ row.baselineValue }}</td>
                  <td class="py-3 text-right font-mono text-gray-400">{{ row.stddev }}</td>
                  <td class="py-3 text-right font-mono" :class="{
                    'text-emerald-600': row.severity === 'low',
                    'text-amber-600': row.severity === 'medium',
                    'text-red-600': row.severity === 'high'
                  }">
                    {{ row.zScoreDisplay }}
                  </td>
                  <td class="py-3 pl-4">
                    <!-- Z-score visual bar -->
                    <div class="h-2 bg-gray-100 rounded-full overflow-hidden relative">
                      <!-- Center line -->
                      <div class="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300"></div>
                      <!-- Z-score indicator -->
                      <div
                        class="absolute top-0 bottom-0 rounded-full"
                        :class="{
                          'bg-emerald-500': row.severity === 'low',
                          'bg-amber-500': row.severity === 'medium',
                          'bg-red-500': row.severity === 'high'
                        }"
                        :style="{
                          left: `${50 + Math.max(-50, Math.min(50, row.zScore * 16.67))}%`,
                          width: '8px',
                          marginLeft: '-4px'
                        }"
                      ></div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="mt-4 text-xs text-gray-400">
            Z-score interpretatie: |z| &lt; 1 = normaal, 1-2 = afwijkend, &gt; 2 = sterk afwijkend
          </div>
        </div>

        <!-- Baseline Statistics -->
        <div class="bg-white border border-gray-200 rounded-lg p-5">
          <h2 class="text-base font-semibold text-gray-900 mb-4">Baseline Statistieken</h2>

          <div v-if="!baselineStats" class="text-gray-500 text-center py-4">
            Onvoldoende historische data voor baseline
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-gray-500 border-b">
                  <th class="pb-2 font-medium">Feature</th>
                  <th class="pb-2 font-medium text-right">Gemiddelde (μ)</th>
                  <th class="pb-2 font-medium text-right">Std (σ)</th>
                  <th class="pb-2 font-medium text-right">Min</th>
                  <th class="pb-2 font-medium text-right">Max</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="feature in features"
                  :key="feature.key"
                  class="border-b border-gray-100 last:border-0"
                >
                  <td class="py-3 font-medium text-gray-900">{{ feature.label }}</td>
                  <template v-if="feature.isTime">
                    <td class="py-3 text-right font-mono">{{ minutesToTime(baselineStats[`avg_${feature.key}_minutes`]) }}</td>
                    <td class="py-3 text-right font-mono text-gray-400">{{ baselineStats[`std_${feature.key}_minutes`]?.toFixed(0) || '-' }} min</td>
                    <td class="py-3 text-right font-mono text-gray-500">{{ minutesToTime(baselineStats[`min_${feature.key}_minutes`]) }}</td>
                    <td class="py-3 text-right font-mono text-gray-500">{{ minutesToTime(baselineStats[`max_${feature.key}_minutes`]) }}</td>
                  </template>
                  <template v-else>
                    <td class="py-3 text-right font-mono">{{ baselineStats[`avg_${feature.key}`]?.toFixed(1) || '-' }}</td>
                    <td class="py-3 text-right font-mono text-gray-400">{{ baselineStats[`std_${feature.key}`]?.toFixed(2) || '-' }}</td>
                    <td class="py-3 text-right font-mono text-gray-500">{{ baselineStats[`min_${feature.key}`] ?? '-' }}</td>
                    <td class="py-3 text-right font-mono text-gray-500">{{ baselineStats[`max_${feature.key}`] ?? '-' }}</td>
                  </template>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="mt-4 text-xs text-gray-400">
            Baseline periode: laatste 14 dagen ({{ baselineStats?.daysCount || 0 }} dagen met data)
          </div>
        </div>

        <!-- Data Quality -->
        <div class="bg-white border border-gray-200 rounded-lg p-5">
          <h2 class="text-base font-semibold text-gray-900 mb-4">Data Quality</h2>

          <div v-if="dataQuality" class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-gray-50 rounded-lg p-4">
              <div class="text-2xl font-bold text-gray-900">{{ dataQuality.totalDaysWithData }}</div>
              <div class="text-sm text-gray-500">Dagen met data</div>
            </div>

            <div class="bg-gray-50 rounded-lg p-4">
              <div class="text-2xl font-bold" :class="dataQuality.daysWithLowActivity > 3 ? 'text-amber-600' : 'text-gray-900'">
                {{ dataQuality.daysWithLowActivity }}
              </div>
              <div class="text-sm text-gray-500">Dagen lage activiteit (&lt;10)</div>
            </div>

            <div class="bg-gray-50 rounded-lg p-4">
              <div class="text-2xl font-bold text-gray-900">{{ dataQuality.totalSensors }}</div>
              <div class="text-sm text-gray-500">Totaal sensoren</div>
            </div>

            <div class="bg-gray-50 rounded-lg p-4">
              <div class="text-2xl font-bold" :class="dataQuality.offlineSensors > 0 ? 'text-red-600' : 'text-emerald-600'">
                {{ dataQuality.offlineSensors }}
              </div>
              <div class="text-sm text-gray-500">Offline sensoren</div>
            </div>
          </div>

          <!-- Offline sensors list -->
          <div v-if="dataQuality?.offlineSensors > 0" class="mt-4 p-3 bg-red-50 rounded-lg">
            <div class="text-sm text-red-700">
              <span class="font-medium">Offline:</span>
              {{ dataQuality.offlineSensorsList.join(', ') }}
            </div>
          </div>
        </div>

        <!-- Raw Data -->
        <div class="bg-white border border-gray-200 rounded-lg p-5">
          <h2 class="text-base font-semibold text-gray-900 mb-4">Raw Data</h2>

          <div class="bg-gray-900 rounded-lg p-4 overflow-x-auto">
            <pre class="text-sm text-green-400 font-mono whitespace-pre-wrap">{{ JSON.stringify(dayStats, null, 2) }}</pre>
          </div>
        </div>

        <!-- Events per hour bar chart -->
        <div class="bg-white border border-gray-200 rounded-lg p-5">
          <h2 class="text-base font-semibold text-gray-900 mb-4">Events per uur</h2>

          <div v-if="dayStats?.events_per_hour" class="flex items-end gap-1 h-32">
            <div
              v-for="(count, hour) in dayStats.events_per_hour"
              :key="hour"
              class="flex-1 flex flex-col items-center"
            >
              <div
                class="w-full rounded-t transition-all"
                :class="count > 0 ? 'bg-purple-500' : 'bg-gray-200'"
                :style="{
                  height: `${Math.max(2, (count / Math.max(...dayStats.events_per_hour, 1)) * 100)}%`
                }"
              ></div>
              <div class="text-xs text-gray-400 mt-1">{{ hour }}</div>
            </div>
          </div>
          <div v-else class="text-gray-500 text-center py-4">
            Geen events_per_hour data
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
