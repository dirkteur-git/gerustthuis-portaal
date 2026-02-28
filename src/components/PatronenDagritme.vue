<script setup>
import { formatMinutesToTime } from '../composables/useDataQuality'

const props = defineProps({
  averageHourlyPattern: { type: Array, required: true },
  maxHourlyAvg: { type: Number, required: true },
  historicalCount: { type: Number, required: true },
  stats: {
    type: Object,
    required: true,
    // { avgWakeUp, avgBedTime, avgAwakeDuration, avgActiveHours, avgDailyEvents, avgLongestGap }
  },
})
</script>

<template>
  <div class="bg-white border border-gray-200 rounded-lg p-5">
    <h2 class="text-base font-semibold text-gray-900 mb-1">Dagritme</h2>
    <p class="text-sm text-gray-500 mb-4">Gemiddeld activiteitspatroon over {{ historicalCount }} dagen</p>

    <!-- Kerngetallen -->
    <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
      <div class="bg-gray-50 rounded-lg p-3">
        <div class="text-lg font-bold text-gray-900">{{ stats.avgWakeUp ? formatMinutesToTime(stats.avgWakeUp) : '-' }}</div>
        <div class="text-xs text-gray-500">Gem. opstaan</div>
      </div>
      <div class="bg-gray-50 rounded-lg p-3">
        <div class="text-lg font-bold text-gray-900">{{ stats.avgBedTime ? formatMinutesToTime(stats.avgBedTime) : '-' }}</div>
        <div class="text-xs text-gray-500">Gem. laatste activiteit</div>
      </div>
      <div class="bg-gray-50 rounded-lg p-3">
        <div class="text-lg font-bold text-gray-900">{{ stats.avgAwakeDuration ? `${Math.floor(stats.avgAwakeDuration / 60)}u${stats.avgAwakeDuration % 60}m` : '-' }}</div>
        <div class="text-xs text-gray-500">Gem. wakkere duur</div>
      </div>
      <div class="bg-gray-50 rounded-lg p-3">
        <div class="text-lg font-bold text-gray-900">{{ stats.avgActiveHours ? stats.avgActiveHours.toFixed(1) + 'u' : '-' }}</div>
        <div class="text-xs text-gray-500">Gem. actieve uren</div>
      </div>
      <div class="bg-gray-50 rounded-lg p-3">
        <div class="text-lg font-bold text-gray-900">{{ stats.avgDailyEvents ?? '-' }}</div>
        <div class="text-xs text-gray-500">Gem. events/dag</div>
      </div>
      <div class="bg-gray-50 rounded-lg p-3">
        <div class="text-lg font-bold text-gray-900">{{ stats.avgLongestGap ? `${Math.floor(stats.avgLongestGap / 60)}u${stats.avgLongestGap % 60}m` : '-' }}</div>
        <div class="text-xs text-gray-500">Gem. langste rust</div>
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
          :class="count > 0 ? 'bg-primary-400 group-hover:bg-primary-500' : 'bg-gray-100'"
          :style="{ height: `${Math.max(2, (count / maxHourlyAvg) * 100)}%` }"
        ></div>
        <div v-if="hour % 3 === 0" class="text-[10px] text-gray-400 mt-1">{{ String(hour).padStart(2, '0') }}</div>
        <div v-else class="h-3 mt-1"></div>

        <div class="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
          {{ String(hour).padStart(2, '0') }}:00 — {{ count }} events
        </div>
      </div>
    </div>
  </div>
</template>
