<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  heatmapData: { type: Array, default: () => [] },
})

const heatmapHover = ref(null)

const maxCount = computed(() => {
  let max = 0
  props.heatmapData.forEach(day => day.hours.forEach(hour => { if (hour.count > max) max = hour.count }))
  return max || 1
})

function formatDayLabel(dateStr) {
  const days = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
  return days[new Date(dateStr).getDay()]
}

function getHeatmapColor(count) {
  if (count === 0) return 'bg-gray-100'
  const intensity = count / maxCount.value
  if (intensity < 0.25) return 'bg-primary-100'
  if (intensity < 0.5) return 'bg-primary-300'
  if (intensity < 0.75) return 'bg-primary-500'
  return 'bg-primary-700'
}

function formatHoverDate(dateStr, hourNum) {
  const d = new Date(dateStr)
  const days = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}, ${String(hourNum).padStart(2, '0')}:00`
}

function handleHeatmapHover(event, day, hour) {
  const roomEntries = Object.entries(hour.rooms || {}).sort((a, b) => b[1] - a[1]).slice(0, 5)

  function getBarWidth(count) {
    if (count === 0) return 0
    if (count <= 2) return 17
    if (count <= 4) return 33
    if (count <= 6) return 50
    if (count <= 8) return 67
    if (count <= 10) return 83
    return 100
  }

  const clientX = event.touches ? event.touches[0].clientX : event.clientX
  const clientY = event.touches ? event.touches[0].clientY : event.clientY
  const tooltipWidth = 200
  const tooltipHeight = 120
  let x = clientX + 12
  let y = clientY - 10
  if (x + tooltipWidth > window.innerWidth) x = clientX - tooltipWidth - 12
  if (y + tooltipHeight > window.innerHeight) y = window.innerHeight - tooltipHeight - 10
  if (y < 10) y = 10

  heatmapHover.value = {
    dateLabel: formatHoverDate(day.date, hour.hour),
    rooms: roomEntries.map(([name, count]) => ({ name, count, barWidth: getBarWidth(count) })),
    x,
    y,
  }
}

function handleHeatmapLeave() {
  heatmapHover.value = null
}
</script>

<template>
  <div class="bg-white border border-gray-200 rounded-lg p-5">
    <div class="mb-4">
      <h2 class="text-base font-semibold text-gray-900">Activiteit</h2>
      <p class="text-sm text-gray-500">Afgelopen 7 dagen</p>
    </div>

    <div v-if="heatmapData.length === 0" class="text-center py-8 text-gray-400">
      Nog geen data beschikbaar
    </div>
    <div v-else>
      <div class="space-y-1">
        <div v-for="day in heatmapData" :key="day.date" class="flex items-center gap-2">
          <div class="w-8 text-xs text-gray-400 text-right">{{ formatDayLabel(day.date) }}</div>
          <div class="flex-1 flex gap-0.5">
            <div
              v-for="hour in day.hours"
              :key="hour.hour"
              :class="[
                'flex-1 h-6 md:h-4 rounded-sm cursor-pointer hover:ring-2 hover:ring-primary-400 hover:ring-offset-1',
                getHeatmapColor(hour.count)
              ]"
              @mouseenter="handleHeatmapHover($event, day, hour)"
              @mouseleave="handleHeatmapLeave"
              @touchstart.passive="handleHeatmapHover($event, day, hour)"
              @touchend="handleHeatmapLeave"
            ></div>
          </div>
        </div>
      </div>

      <div class="flex justify-end items-center gap-1.5 mt-4 text-xs text-gray-400">
        <span>Rustig</span>
        <div class="flex gap-0.5">
          <div class="w-3 h-3 rounded-sm bg-gray-100"></div>
          <div class="w-3 h-3 rounded-sm bg-primary-100"></div>
          <div class="w-3 h-3 rounded-sm bg-primary-300"></div>
          <div class="w-3 h-3 rounded-sm bg-primary-500"></div>
          <div class="w-3 h-3 rounded-sm bg-primary-700"></div>
        </div>
        <span>Actief</span>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="heatmapHover"
      class="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg pointer-events-none p-3 min-w-48"
      :style="{ left: heatmapHover.x + 12 + 'px', top: heatmapHover.y - 10 + 'px' }"
    >
      <div class="text-sm font-medium text-gray-900 mb-2">{{ heatmapHover.dateLabel }}</div>
      <div v-if="heatmapHover.rooms.length === 0" class="text-sm text-gray-400">Geen activiteit</div>
      <div v-else class="space-y-1.5">
        <div v-for="room in heatmapHover.rooms" :key="room.name" class="flex items-center gap-2">
          <span class="text-xs text-gray-600 w-20 truncate">{{ room.name }}</span>
          <div class="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div class="h-full bg-primary-500 rounded-full" :style="{ width: room.barWidth + '%' }"></div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
