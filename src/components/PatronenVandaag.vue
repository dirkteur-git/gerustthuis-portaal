<script setup>
import { computed } from 'vue'
import {
  MINIMUM_DAYS_REQUIRED,
  calculateDayStart,
  formatMinutesToTime,
  avg,
  stddev,
  sumEventsInRange,
  getDayEventsUntilHour,
  getActiveDayHoursUntilHour,
} from '../composables/useDataQuality'

const props = defineProps({
  todayStats: { type: Object, default: null },
  historicalData: { type: Array, required: true },
  averageHourlyPattern: { type: Array, required: true },
  currentHour: { type: Number, required: true },
})

function zScoreSeverity(todayValue, historicalValues) {
  if (todayValue === null || !historicalValues || historicalValues.length < 2) return 'low'
  const mean = avg(historicalValues)
  const std = stddev(historicalValues)
  if (mean === null || std === 0) return 'low'
  const z = Math.abs((todayValue - mean) / std)
  if (z >= 2) return 'high'
  if (z >= 1) return 'medium'
  return 'low'
}

const comparisonMetrics = computed(() => {
  if (!props.todayStats || props.historicalData.length < MINIMUM_DAYS_REQUIRED) return null

  const metrics = []
  const hist = props.historicalData
  const ch = props.currentHour

  // 1. Opstaan
  const todayWake = calculateDayStart(props.todayStats.events_per_hour)
  const histWake = hist.map(d => calculateDayStart(d.events_per_hour)).filter(t => t !== null)
  if (todayWake !== null && histWake.length > 0) {
    const avgVal = Math.round(avg(histWake))
    const diff = todayWake - avgVal
    metrics.push({
      label: 'Opgestaan',
      today: formatMinutesToTime(todayWake),
      average: formatMinutesToTime(avgVal),
      diff,
      diffText: diff === 0 ? 'normaal' : `${Math.abs(diff)} min ${diff > 0 ? 'later' : 'eerder'}`,
      severity: zScoreSeverity(todayWake, histWake),
    })
  }

  // 2. Nacht events
  const todayNight = props.todayStats.night_events || 0
  const histNight = hist.map(d => d.night_events).filter(v => v != null)
  if (histNight.length > 0) {
    const avgVal = Math.round(avg(histNight))
    const diff = todayNight - avgVal
    metrics.push({
      label: 'Nachtactiviteit',
      today: `${todayNight}`,
      average: `${avgVal}`,
      diff,
      diffText: Math.abs(diff) < 2 ? 'normaal' : `${Math.abs(diff)} ${diff > 0 ? 'meer' : 'minder'}`,
      severity: zScoreSeverity(todayNight, histNight),
    })
  }

  // 3. Activiteit tot nu (rolling)
  const todayEventsUntilNow = getDayEventsUntilHour(props.todayStats.events_per_hour, ch)
  const histEventsUntilNow = hist.map(d => getDayEventsUntilHour(d.events_per_hour, ch)).filter(v => v != null)
  if (histEventsUntilNow.length > 0) {
    const avgVal = Math.round(avg(histEventsUntilNow))
    const pct = avgVal > 0 ? Math.round(((todayEventsUntilNow - avgVal) / avgVal) * 100) : 0
    metrics.push({
      label: `Activiteit (tot ${String(ch).padStart(2, '0')}:00)`,
      today: `${todayEventsUntilNow}`,
      average: `${avgVal}`,
      diff: pct,
      diffText: pct === 0 ? 'normaal' : `${Math.abs(pct)}% ${pct > 0 ? 'meer' : 'minder'}`,
      severity: zScoreSeverity(todayEventsUntilNow, histEventsUntilNow),
    })
  }

  // 4. Actieve uren tot nu (rolling)
  const todayActiveUntilNow = getActiveDayHoursUntilHour(props.todayStats.events_per_hour, ch)
  const histActiveUntilNow = hist.map(d => getActiveDayHoursUntilHour(d.events_per_hour, ch)).filter(v => v != null)
  if (histActiveUntilNow.length > 0) {
    const avgVal = avg(histActiveUntilNow)
    const diff = todayActiveUntilNow - avgVal
    metrics.push({
      label: `Actieve uren (tot ${String(ch).padStart(2, '0')}:00)`,
      today: `${todayActiveUntilNow}u`,
      average: `${avgVal.toFixed(1)}u`,
      diff,
      diffText: Math.abs(diff) < 0.5 ? 'normaal' : `${Math.abs(diff).toFixed(1)}u ${diff > 0 ? 'meer' : 'minder'}`,
      severity: zScoreSeverity(todayActiveUntilNow, histActiveUntilNow),
    })
  }

  // 5-7. Dagdeel events (rolling)
  const dayParts = [
    { label: 'Ochtend', start: 6, end: 11 },
    { label: 'Middag', start: 12, end: 17 },
    { label: 'Avond', start: 18, end: 22 },
  ]
  for (const part of dayParts) {
    if (ch < part.start) continue
    const effectiveEnd = Math.min(part.end, ch - 1)
    if (effectiveEnd < part.start) continue

    const todayPartEvents = sumEventsInRange(props.todayStats.events_per_hour, part.start, effectiveEnd)
    const histPartEvents = hist.map(d => sumEventsInRange(d.events_per_hour, part.start, effectiveEnd)).filter(v => v != null)
    if (histPartEvents.length > 0) {
      const avgVal = Math.round(avg(histPartEvents))
      const pct = avgVal > 0 ? Math.round(((todayPartEvents - avgVal) / avgVal) * 100) : 0
      const isPartial = ch <= part.end
      const timeLabel = isPartial
        ? `${part.label} (${String(part.start).padStart(2, '0')}-${String(ch).padStart(2, '0')})`
        : `${part.label} (${String(part.start).padStart(2, '0')}-${String(part.end + 1).padStart(2, '0')})`
      metrics.push({
        label: timeLabel,
        today: `${todayPartEvents}`,
        average: `${avgVal}`,
        diff: pct,
        diffText: pct === 0 ? 'normaal' : `${Math.abs(pct)}% ${pct > 0 ? 'meer' : 'minder'}`,
        severity: zScoreSeverity(todayPartEvents, histPartEvents),
      })
    }
  }

  return metrics
})

function computeDayPartDistribution(eventsPerHour, untilHour = 23) {
  if (!eventsPerHour || eventsPerHour.length < 24) return null
  const morningEnd = Math.min(11, untilHour - 1)
  const afternoonEnd = Math.min(17, untilHour - 1)
  const eveningEnd = Math.min(22, untilHour - 1)
  const morning = morningEnd >= 6 ? sumEventsInRange(eventsPerHour, 6, morningEnd) : 0
  const afternoon = afternoonEnd >= 12 ? sumEventsInRange(eventsPerHour, 12, afternoonEnd) : 0
  const evening = eveningEnd >= 18 ? sumEventsInRange(eventsPerHour, 18, eveningEnd) : 0
  const night = sumEventsInRange(eventsPerHour, 23, 23) + sumEventsInRange(eventsPerHour, 0, 5)
  const total = morning + afternoon + evening + night
  if (total === 0) return null
  return {
    morning: { count: morning, pct: Math.round((morning / total) * 100) },
    afternoon: { count: afternoon, pct: Math.round((afternoon / total) * 100) },
    evening: { count: evening, pct: Math.round((evening / total) * 100) },
    night: { count: night, pct: Math.round((night / total) * 100) },
  }
}

const todayDayParts = computed(() => {
  if (!props.todayStats?.events_per_hour) return null
  return computeDayPartDistribution(props.todayStats.events_per_hour, props.currentHour)
})

const avgDayParts = computed(() => {
  if (props.historicalData.length < MINIMUM_DAYS_REQUIRED) return null
  return computeDayPartDistribution(props.averageHourlyPattern, props.currentHour)
})

const todayVsAvgHourly = computed(() => {
  if (!props.todayStats?.events_per_hour || props.historicalData.length < MINIMUM_DAYS_REQUIRED) return null
  return { today: props.todayStats.events_per_hour, avg: props.averageHourlyPattern }
})

const maxComparisonHourly = computed(() => {
  if (!todayVsAvgHourly.value) return 1
  return Math.max(...todayVsAvgHourly.value.today, ...todayVsAvgHourly.value.avg, 1)
})
</script>

<template>
  <!-- Vandaag vs normaal -->
  <div v-if="comparisonMetrics && comparisonMetrics.length > 0" class="bg-white border border-gray-200 rounded-lg p-5">
    <h2 class="text-base font-semibold text-gray-900 mb-1">Vandaag vs normaal</h2>
    <p class="text-sm text-gray-500 mb-4">
      Rolling vergelijking tot {{ String(currentHour).padStart(2, '0') }}:00 met {{ historicalData.length }} dagen
    </p>

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
              'bg-primary-100 text-primary-700': metric.severity === 'low',
              'bg-amber-100 text-amber-700': metric.severity === 'medium',
              'bg-red-100 text-red-700': metric.severity === 'high',
            }"
          >
            {{ metric.diffText }}
          </div>
        </div>
      </div>
    </div>

    <!-- Dagdeel verdeling -->
    <div v-if="todayDayParts && avgDayParts" class="mt-6">
      <h3 class="text-sm font-medium text-gray-700 mb-3">Dagdeel verdeling</h3>

      <div class="mb-2">
        <div class="text-xs text-gray-500 mb-1">Vandaag</div>
        <div class="flex h-5 rounded-full overflow-hidden">
          <div v-if="todayDayParts.morning.pct > 0" class="bg-blue-400 flex items-center justify-center" :style="{ width: `${todayDayParts.morning.pct}%` }">
            <span v-if="todayDayParts.morning.pct > 12" class="text-[10px] text-white font-medium">{{ todayDayParts.morning.pct }}%</span>
          </div>
          <div v-if="todayDayParts.afternoon.pct > 0" class="bg-primary-400 flex items-center justify-center" :style="{ width: `${todayDayParts.afternoon.pct}%` }">
            <span v-if="todayDayParts.afternoon.pct > 12" class="text-[10px] text-white font-medium">{{ todayDayParts.afternoon.pct }}%</span>
          </div>
          <div v-if="todayDayParts.evening.pct > 0" class="bg-amber-400 flex items-center justify-center" :style="{ width: `${todayDayParts.evening.pct}%` }">
            <span v-if="todayDayParts.evening.pct > 12" class="text-[10px] text-white font-medium">{{ todayDayParts.evening.pct }}%</span>
          </div>
          <div v-if="todayDayParts.night.pct > 0" class="bg-purple-400 flex items-center justify-center" :style="{ width: `${todayDayParts.night.pct}%` }">
            <span v-if="todayDayParts.night.pct > 12" class="text-[10px] text-white font-medium">{{ todayDayParts.night.pct }}%</span>
          </div>
        </div>
      </div>

      <div class="mb-3">
        <div class="text-xs text-gray-500 mb-1">Normaal</div>
        <div class="flex h-5 rounded-full overflow-hidden">
          <div v-if="avgDayParts.morning.pct > 0" class="bg-blue-200 flex items-center justify-center" :style="{ width: `${avgDayParts.morning.pct}%` }">
            <span v-if="avgDayParts.morning.pct > 12" class="text-[10px] text-blue-700 font-medium">{{ avgDayParts.morning.pct }}%</span>
          </div>
          <div v-if="avgDayParts.afternoon.pct > 0" class="bg-primary-200 flex items-center justify-center" :style="{ width: `${avgDayParts.afternoon.pct}%` }">
            <span v-if="avgDayParts.afternoon.pct > 12" class="text-[10px] text-primary-700 font-medium">{{ avgDayParts.afternoon.pct }}%</span>
          </div>
          <div v-if="avgDayParts.evening.pct > 0" class="bg-amber-200 flex items-center justify-center" :style="{ width: `${avgDayParts.evening.pct}%` }">
            <span v-if="avgDayParts.evening.pct > 12" class="text-[10px] text-amber-700 font-medium">{{ avgDayParts.evening.pct }}%</span>
          </div>
          <div v-if="avgDayParts.night.pct > 0" class="bg-purple-200 flex items-center justify-center" :style="{ width: `${avgDayParts.night.pct}%` }">
            <span v-if="avgDayParts.night.pct > 12" class="text-[10px] text-purple-700 font-medium">{{ avgDayParts.night.pct }}%</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-4 text-xs text-gray-500">
        <span class="flex items-center gap-1"><span class="w-3 h-2 bg-blue-400 rounded"></span> Ochtend</span>
        <span class="flex items-center gap-1"><span class="w-3 h-2 bg-primary-400 rounded"></span> Middag</span>
        <span class="flex items-center gap-1"><span class="w-3 h-2 bg-amber-400 rounded"></span> Avond</span>
        <span class="flex items-center gap-1"><span class="w-3 h-2 bg-purple-400 rounded"></span> Nacht</span>
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
          :class="{ 'opacity-30': hour - 1 >= currentHour }"
        >
          <div class="w-full flex items-end gap-px" style="height: 80px;">
            <div class="flex-1 bg-gray-200 rounded-t" :style="{ height: `${Math.max(1, (todayVsAvgHourly.avg[hour - 1] / maxComparisonHourly) * 100)}%` }"></div>
            <div
              class="flex-1 rounded-t"
              :class="todayVsAvgHourly.today[hour - 1] > 0 ? 'bg-primary-500' : 'bg-gray-100'"
              :style="{ height: `${Math.max(1, (todayVsAvgHourly.today[hour - 1] / maxComparisonHourly) * 100)}%` }"
            ></div>
          </div>
          <div v-if="(hour - 1) % 6 === 0" class="text-[10px] text-gray-400">{{ String(hour - 1).padStart(2, '0') }}</div>
          <div v-else class="h-3"></div>
        </div>
      </div>
      <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
        <span class="flex items-center gap-1"><span class="w-3 h-2 bg-gray-200 rounded"></span> Gemiddeld</span>
        <span class="flex items-center gap-1"><span class="w-3 h-2 bg-primary-500 rounded"></span> Vandaag</span>
        <span class="flex items-center gap-1 opacity-30"><span class="w-3 h-2 bg-gray-300 rounded"></span> Nog te komen</span>
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
</template>
