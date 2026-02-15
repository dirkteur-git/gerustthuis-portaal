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
    <!-- Logo Icon - Hartje-Huis (Brandbook v2) -->
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :viewBox="`0 0 ${iconSize} ${iconSize}`"
      :width="iconSize"
      :height="iconSize"
    >
      <!-- Warm green background with rounded corners -->
      <rect :width="iconSize" :height="iconSize" :rx="iconSize * 0.25" fill="#4A7B58"/>

      <!-- Protective roof -->
      <path
        :d="`M${12 * s} ${34 * s} L${32 * s} ${16 * s} L${52 * s} ${34 * s}`"
        fill="none"
        stroke="#ffffff"
        :stroke-width="3.5 * s"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- Heart shape (home comfort) -->
      <path
        :d="`M${24 * s} ${39 * s} C${24 * s} ${35.5 * s}, ${28 * s} ${32 * s}, ${32 * s} ${35.5 * s} C${36 * s} ${32 * s}, ${40 * s} ${35.5 * s}, ${40 * s} ${39 * s} C${40 * s} ${44.5 * s}, ${32 * s} ${50 * s}, ${32 * s} ${50 * s} C${32 * s} ${50 * s}, ${24 * s} ${44.5 * s}, ${24 * s} ${39 * s}Z`"
        fill="#F0C896"
      />
    </svg>

    <!-- Wordmark -->
    <div v-if="showText">
      <span :class="['font-semibold', textSize]" style="font-family: 'DM Serif Display', Georgia, serif;">
        <span style="color: #4A7B58;">Gerust</span><span class="text-gray-900">Thuis</span>
      </span>
    </div>
  </div>
</template>
