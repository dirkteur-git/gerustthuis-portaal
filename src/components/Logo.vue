<script setup>
import { computed } from 'vue'

const props = defineProps({
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v)
  },
  showText: {
    type: Boolean,
    default: true
  }
})

const iconSize = computed(() => {
  const sizes = { sm: 28, md: 36, lg: 48 }
  return sizes[props.size]
})

const textSize = computed(() => {
  const sizes = { sm: 'text-base', md: 'text-xl', lg: 'text-2xl' }
  return sizes[props.size]
})

// Calculate proportional values based on 64x64 reference
const s = computed(() => iconSize.value / 64)
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- Logo Icon - Shelter + Signal -->
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :viewBox="`0 0 ${iconSize} ${iconSize}`"
      :width="iconSize"
      :height="iconSize"
    >
      <!-- Green background with rounded corners -->
      <rect :width="iconSize" :height="iconSize" :rx="iconSize * 0.22" fill="#10b981"/>

      <!-- Protective roof -->
      <path
        :d="`M${10 * s} ${34 * s} L${32 * s} ${14 * s} L${54 * s} ${34 * s}`"
        fill="none"
        stroke="#ffffff"
        :stroke-width="3.5 * s"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- Person dot -->
      <circle :cx="32 * s" :cy="44 * s" :r="4 * s" fill="#ffffff"/>

      <!-- Signal rings around person -->
      <circle :cx="32 * s" :cy="44 * s" :r="8 * s" fill="none" stroke="#ffffff" :stroke-width="1.5 * s" opacity="0.5"/>
      <circle :cx="32 * s" :cy="44 * s" :r="13 * s" fill="none" stroke="#ffffff" :stroke-width="1.5 * s" opacity="0.25"/>
    </svg>

    <!-- Wordmark -->
    <div v-if="showText">
      <span :class="['font-semibold', textSize]">
        <span class="text-emerald-500">Gerust</span><span class="text-gray-900">Thuis</span>
      </span>
    </div>
  </div>
</template>
