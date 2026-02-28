<script setup>
defineProps({
  events: { type: Array, required: true },
  activeHours: { type: Array, required: true },
  nightEvents: { type: Array, required: true },
  longestGap: { type: Array, required: true },
  awakeDuration: { type: Array, required: true },
  dates: { type: Array, required: true },
  totalDays: { type: Number, required: true },
})

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
</script>

<template>
  <div class="bg-white border border-gray-200 rounded-lg p-5">
    <h2 class="text-base font-semibold text-gray-900 mb-1">Trends</h2>
    <p class="text-sm text-gray-500 mb-4">Activiteitsontwikkeling over {{ totalDays }} dagen</p>

    <!-- Totaal events -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-gray-700">Totaal events per dag</span>
        <span class="text-xs text-gray-500">{{ events[events.length - 1] || 0 }} vandaag</span>
      </div>
      <div class="h-16 relative">
        <svg viewBox="0 0 400 60" class="w-full h-full" preserveAspectRatio="none">
          <line x1="0" y1="30" x2="400" y2="30" stroke="#f3f4f6" stroke-width="1" />
          <path :d="trendPath(events)" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <div class="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{{ dates[0] || '' }}</span>
        <span>{{ dates[dates.length - 1] || '' }}</span>
      </div>
    </div>

    <!-- Actieve uren -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-gray-700">Actieve uren per dag</span>
        <span class="text-xs text-gray-500">{{ activeHours[activeHours.length - 1] || 0 }}u vandaag</span>
      </div>
      <div class="h-16 relative">
        <svg viewBox="0 0 400 60" class="w-full h-full" preserveAspectRatio="none">
          <line x1="0" y1="30" x2="400" y2="30" stroke="#f3f4f6" stroke-width="1" />
          <path :d="trendPath(activeHours)" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <div class="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{{ dates[0] || '' }}</span>
        <span>{{ dates[dates.length - 1] || '' }}</span>
      </div>
    </div>

    <!-- Nacht events -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-gray-700">Nachtactiviteit</span>
        <span class="text-xs text-gray-500">{{ nightEvents[nightEvents.length - 1] || 0 }} events vannacht</span>
      </div>
      <div class="h-16 relative">
        <svg viewBox="0 0 400 60" class="w-full h-full" preserveAspectRatio="none">
          <line x1="0" y1="30" x2="400" y2="30" stroke="#f3f4f6" stroke-width="1" />
          <path :d="trendPath(nightEvents)" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <div class="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{{ dates[0] || '' }}</span>
        <span>{{ dates[dates.length - 1] || '' }}</span>
      </div>
    </div>

    <!-- Langste gap -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-gray-700">Langste rustperiode</span>
        <span class="text-xs text-gray-500">{{ longestGap[longestGap.length - 1] || 0 }} min vandaag</span>
      </div>
      <div class="h-16 relative">
        <svg viewBox="0 0 400 60" class="w-full h-full" preserveAspectRatio="none">
          <line x1="0" y1="30" x2="400" y2="30" stroke="#f3f4f6" stroke-width="1" />
          <path :d="trendPath(longestGap)" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <div class="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{{ dates[0] || '' }}</span>
        <span>{{ dates[dates.length - 1] || '' }}</span>
      </div>
    </div>

    <!-- Wakkere duur -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-gray-700">Wakkere duur</span>
        <span class="text-xs text-gray-500">
          {{ awakeDuration[awakeDuration.length - 1] ? Math.floor(awakeDuration[awakeDuration.length - 1] / 60) + 'u' : '-' }} vandaag
        </span>
      </div>
      <div class="h-16 relative">
        <svg viewBox="0 0 400 60" class="w-full h-full" preserveAspectRatio="none">
          <line x1="0" y1="30" x2="400" y2="30" stroke="#f3f4f6" stroke-width="1" />
          <path :d="trendPath(awakeDuration)" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <div class="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{{ dates[0] || '' }}</span>
        <span>{{ dates[dates.length - 1] || '' }}</span>
      </div>
    </div>
  </div>
</template>
