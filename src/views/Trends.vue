<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../services/supabase'
import {
  MINIMUM_DAYS_REQUIRED,
  toLocalDateKey,
  timeToMinutes,
  sumEventsInRange,
  cosineSimilarity,
  awakeDuration,
  avg,
  stddev
} from '../composables/useDataQuality'

// State
const loading = ref(true)
const historicalData = ref([]) // 14 dagen daily_activity_stats
const alerts = ref([]) // Lijst met gedetecteerde alerts

// Alle 18 features (zoals in ANOMALY_DETECTION.md)
const features = [
  // Groep 1: Tijdstip
  { key: 'first_activity', label: 'Eerste Activiteit', group: 'Tijdstip', weight: 1.0, unit: 'tijd', isTime: true },
  { key: 'last_activity', label: 'Laatste Activiteit', group: 'Tijdstip', weight: 1.0, unit: 'tijd', isTime: true },
  { key: 'awake_duration', label: 'Wakkere Duur', group: 'Tijdstip', weight: 0.8, unit: 'min', isDerived: true },

  // Groep 2: Volume
  { key: 'total_events', label: 'Totaal Events', group: 'Volume', weight: 1.0, unit: '' },
  { key: 'active_hours', label: 'Actieve Uren', group: 'Volume', weight: 1.0, unit: 'u' },
  { key: 'morning_events', label: 'Ochtend Events (06-12)', group: 'Volume', weight: 0.8, unit: '', isDerived: true },
  { key: 'afternoon_events', label: 'Middag Events (12-18)', group: 'Volume', weight: 0.8, unit: '', isDerived: true },
  { key: 'evening_events', label: 'Avond Events (18-23)', group: 'Volume', weight: 0.8, unit: '', isDerived: true },

  // Groep 3: Rust & Nacht
  { key: 'longest_gap_minutes', label: 'Langste Gap', group: 'Rust & Nacht', weight: 1.2, unit: 'min' },
  { key: 'night_events', label: 'Nacht Events', group: 'Rust & Nacht', weight: 1.0, unit: '' },
  { key: 'night_active_hours', label: 'Nacht Actieve Uren', group: 'Rust & Nacht', weight: 0.8, unit: 'u' },

  // Groep 4: Ruimte
  { key: 'rooms_active', label: 'Actieve Kamers', group: 'Ruimte', weight: 0.8, unit: '' },
  { key: 'room_ratio', label: 'Kamer Ratio', group: 'Ruimte', weight: 0.6, unit: '%', isDerived: true },
  { key: 'main_room_pct', label: 'Hoofdkamer %', group: 'Ruimte', weight: 0.6, unit: '%', isDerived: true },

  // Groep 5: Sensor Type
  { key: 'motion_events', label: 'Beweging Events', group: 'Sensor Type', weight: 0.8, unit: '' },
  { key: 'door_events', label: 'Deur Events', group: 'Sensor Type', weight: 0.8, unit: '' },

  // Groep 6: Patroon
  { key: 'transition_count', label: 'Kamerwisselingen', group: 'Patroon', weight: 0.6, unit: '', isDerived: true },
  { key: 'activity_regularity', label: 'Regelmaat', group: 'Patroon', weight: 0.6, unit: '%', isDerived: true },
]

// Z-score berekening
function calcZScore(value, mean, std) {
  if (value === null || mean === null || std === null || std === 0) return 0
  return (value - mean) / std
}

// Bereken derived features
function calculateDerivedFeature(feature, day) {
  if (feature.key === 'awake_duration') {
    if (day.first_activity && day.last_activity) {
      return awakeDuration(day.first_activity, day.last_activity)
    }
  }
  if (feature.key === 'morning_events') {
    return sumEventsInRange(day.events_per_hour || [], 6, 11)
  }
  if (feature.key === 'afternoon_events') {
    return sumEventsInRange(day.events_per_hour || [], 12, 17)
  }
  if (feature.key === 'evening_events') {
    return sumEventsInRange(day.events_per_hour || [], 18, 22)
  }
  if (feature.key === 'room_ratio') {
    return day.rooms_available > 0 ? (day.rooms_active / day.rooms_available) * 100 : null
  }
  // main_room_pct, transition_count, activity_regularity vereisen room_activity_hourly data
  // Voor nu skip ik die
  return null
}

// Bereken z-scores en detecteer alerts
const processedData = computed(() => {
  if (historicalData.value.length < MINIMUM_DAYS_REQUIRED) return []

  alerts.value = [] // Reset alerts
  const result = []

  // Voor elke feature
  for (const feature of features) {
    // Skip complex derived features die room data nodig hebben
    if (['main_room_pct', 'transition_count', 'activity_regularity'].includes(feature.key)) {
      continue
    }

    const values = []

    // Verzamel waarden voor baseline (eerste 10 dagen)
    const baselineDays = historicalData.value.slice(0, -4)
    const baselineValues = baselineDays
      .map(d => {
        let val = feature.isDerived ? calculateDerivedFeature(feature, d) : d[feature.key]
        if (feature.isTime && val) {
          val = timeToMinutes(val)
        }
        return val
      })
      .filter(v => v !== null && v !== undefined)

    if (baselineValues.length < 2) continue

    const mean = avg(baselineValues)
    const std = stddev(baselineValues)

    // Voor elke dag, bereken z-score
    for (const day of historicalData.value) {
      let value = feature.isDerived ? calculateDerivedFeature(feature, day) : day[feature.key]
      const displayValue = value

      if (feature.isTime && value) {
        value = timeToMinutes(value)
      }

      const zScore = calcZScore(value, mean, std)
      const absZ = Math.abs(zScore)

      values.push({
        date: day.date,
        value: displayValue,
        zScore,
        absZ,
        severity: absZ >= 2 ? 'high' : absZ >= 1 ? 'medium' : 'low'
      })

      // Detecteer alert
      if (absZ >= 1) {
        alerts.value.push({
          date: day.date,
          feature: feature.label,
          group: feature.group,
          value: displayValue,
          zScore,
          severity: absZ >= 2 ? 'high' : 'medium',
          unit: feature.unit,
          isTime: feature.isTime
        })
      }
    }

    result.push({
      feature: feature.label,
      key: feature.key,
      group: feature.group,
      unit: feature.unit,
      isTime: feature.isTime,
      mean,
      std,
      values
    })
  }

  return result
})

// Groepeer alerts per dag
const alertsByDate = computed(() => {
  const grouped = {}
  for (const alert of alerts.value) {
    if (!grouped[alert.date]) {
      grouped[alert.date] = []
    }
    grouped[alert.date].push(alert)
  }
  return Object.entries(grouped)
    .map(([date, items]) => ({
      date,
      count: items.length,
      highCount: items.filter(a => a.severity === 'high').length,
      mediumCount: items.filter(a => a.severity === 'medium').length,
      alerts: items.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
})

// Format helpers
function formatTime(timeStr) {
  if (!timeStr) return '-'
  const parts = String(timeStr).split(':')
  return `${parts[0]}:${parts[1]}`
}

function formatValue(value, unit, isTime) {
  if (value === null || value === undefined) return '-'
  if (isTime) return formatTime(value)
  if (unit === 'min') return `${Math.round(value)}m`
  if (unit === 'u') return `${value}u`
  if (unit === '%') return `${Math.round(value)}%`
  return Math.round(value).toString()
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  const days = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
  return `${days[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`
}

// Data laden
async function loadData() {
  loading.value = true

  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13)
  fourteenDaysAgo.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('daily_activity_stats')
    .select('*')
    .gte('date', fourteenDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: true })

  if (error) {
    console.error('Error loading historical data:', error)
    loading.value = false
    return
  }

  historicalData.value = data || []
  loading.value = false
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Trends & Alert Geschiedenis</h1>
        <p class="text-gray-500">Historische analyse van 15 metrics over 14 dagen (3 features vereisen room data)</p>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <div class="text-gray-500">Data laden...</div>
      </div>

      <template v-else-if="historicalData.length < MINIMUM_DAYS_REQUIRED">
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p class="text-amber-900">
            Minimaal {{ MINIMUM_DAYS_REQUIRED }} dagen data nodig voor betrouwbare analyse.
            Momenteel: {{ historicalData.length }} dagen.
          </p>
        </div>
      </template>

      <template v-else>
        <!-- Alert Samenvatting -->
        <div class="bg-white border border-gray-200 rounded-lg p-5 mb-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Alert Samenvatting (Laatste 14 Dagen)</h2>

          <div v-if="alerts.length === 0" class="text-gray-500 text-center py-4">
            🎉 Geen alerts gedetecteerd - alles normaal!
          </div>

          <div v-else class="space-y-3">
            <div v-for="day in alertsByDate" :key="day.date" class="border border-gray-100 rounded p-3">
              <div class="flex items-center justify-between mb-2">
                <div class="font-medium text-gray-900">{{ formatDate(day.date) }}</div>
                <div class="flex items-center gap-2 text-sm">
                  <span v-if="day.highCount > 0" class="px-2 py-0.5 bg-red-100 text-red-700 rounded font-medium">
                    {{ day.highCount }} hoog
                  </span>
                  <span v-if="day.mediumCount > 0" class="px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                    {{ day.mediumCount }} gemiddeld
                  </span>
                </div>
              </div>
              <div class="space-y-1 text-sm">
                <div v-for="(alert, idx) in day.alerts.slice(0, 5)" :key="idx" class="text-gray-600 flex justify-between">
                  <span>
                    <span class="font-medium">{{ alert.feature }}:</span>
                    <span :class="{
                      'text-red-600 font-semibold': alert.severity === 'high',
                      'text-amber-600 font-semibold': alert.severity === 'medium'
                    }">
                      z={{ alert.zScore.toFixed(2) }}
                    </span>
                  </span>
                  <span class="text-gray-400">
                    {{ formatValue(alert.value, alert.unit, alert.isTime) }}
                  </span>
                </div>
                <div v-if="day.alerts.length > 5" class="text-gray-400 text-xs pt-1">
                  + {{ day.alerts.length - 5 }} meer
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Feature Charts -->
        <div class="space-y-6">
          <div v-for="metric in processedData" :key="metric.key" class="bg-white border border-gray-200 rounded-lg p-5">
            <div class="mb-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-semibold text-gray-900">{{ metric.feature }}</h3>
                  <p class="text-sm text-gray-500">
                    {{ metric.group }} • Baseline: {{ formatValue(metric.mean, metric.unit, metric.isTime) }} ± {{ formatValue(metric.std, metric.unit, false) }}
                  </p>
                </div>
                <div class="text-right text-sm text-gray-500">
                  {{ metric.values.filter(v => v.absZ >= 2).length }} hoge,
                  {{ metric.values.filter(v => v.absZ >= 1 && v.absZ < 2).length }} gemiddelde alerts
                </div>
              </div>
            </div>

            <!-- Simple Chart (SVG) -->
            <div class="relative h-32 border border-gray-100 rounded bg-gray-50">
              <svg class="w-full h-full" viewBox="0 0 1000 100" preserveAspectRatio="none">
                <!-- Grid lines -->
                <line x1="0" y1="50" x2="1000" y2="50" stroke="#d1d5db" stroke-width="1" />
                <line x1="0" y1="25" x2="1000" y2="25" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4" />
                <line x1="0" y1="75" x2="1000" y2="75" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4" />

                <!-- Data line -->
                <polyline
                  :points="metric.values.map((v, i) => {
                    const x = (i / (metric.values.length - 1)) * 1000
                    const y = 50 - (v.zScore * 20) // Scale z-scores
                    return `${x},${Math.max(5, Math.min(95, y))}`
                  }).join(' ')"
                  fill="none"
                  stroke="#4A7B58"
                  stroke-width="2.5"
                />

                <!-- Alert markers -->
                <circle
                  v-for="(v, i) in metric.values.filter(v => v.absZ >= 1)"
                  :key="i"
                  :cx="(metric.values.indexOf(v) / (metric.values.length - 1)) * 1000"
                  :cy="Math.max(5, Math.min(95, 50 - (v.zScore * 20)))"
                  :r="v.severity === 'high' ? 6 : 4"
                  :fill="v.severity === 'high' ? '#ef4444' : '#f59e0b'"
                />
              </svg>

              <!-- X-axis labels -->
              <div class="absolute -bottom-5 left-0 right-0 flex justify-between text-xs text-gray-400 px-2">
                <span>{{ formatDate(metric.values[0]?.date) }}</span>
                <span>{{ formatDate(metric.values[Math.floor(metric.values.length / 2)]?.date) }}</span>
                <span>{{ formatDate(metric.values[metric.values.length - 1]?.date) }}</span>
              </div>
            </div>

            <!-- Legend -->
            <div class="mt-6 flex items-center gap-4 text-xs text-gray-500">
              <div class="flex items-center gap-1.5">
                <div class="w-3 h-3 rounded-full bg-red-500"></div>
                <span>|z| ≥ 2 (sterk afwijkend)</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="w-3 h-3 rounded-full bg-amber-500"></div>
                <span>|z| ≥ 1 (afwijkend)</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="w-6 h-0.5 bg-primary-500"></div>
                <span>Trend lijn</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Info -->
        <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
          <strong>💡 Hoe werkt dit?</strong> Elke metric wordt vergeleken met de baseline (gemiddelde ± standaarddeviatie) van de eerste 10 dagen.
          Een z-score van |z| ≥ 1 betekent dat de waarde meer dan 1 standaarddeviatie afwijkt van normaal.
          |z| ≥ 2 is een sterke afwijking die mogelijk aandacht verdient.
          <br><br>
          <strong>📊 18 Features totaal:</strong> 15 worden getoond (3 vereisen room_activity_hourly data: main_room_pct, transition_count, activity_regularity)
        </div>
      </template>
    </div>
  </div>
</template>
