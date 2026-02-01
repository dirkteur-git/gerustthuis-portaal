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
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- Logo Icon - Heartbeat Home -->
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :viewBox="`0 0 ${iconSize} ${iconSize}`"
      :width="iconSize"
      :height="iconSize"
    >
      <rect :width="iconSize" :height="iconSize" :rx="iconSize * 0.22" fill="#10b981"/>

      <!-- House outline -->
      <path
        :d="`M${iconSize/2} ${iconSize * 0.1875} L${iconSize * 0.8125} ${iconSize * 0.4375} L${iconSize * 0.8125} ${iconSize * 0.8125} L${iconSize * 0.1875} ${iconSize * 0.8125} L${iconSize * 0.1875} ${iconSize * 0.4375} Z`"
        fill="none"
        stroke="#ffffff"
        :stroke-width="iconSize * 0.04"
        stroke-linejoin="round"
      />

      <!-- Calm heartbeat line -->
      <path
        :d="`M${iconSize * 0.28125} ${iconSize * 0.59375} L${iconSize * 0.40625} ${iconSize * 0.59375} L${iconSize * 0.453125} ${iconSize * 0.5} L${iconSize * 0.5} ${iconSize * 0.65625} L${iconSize * 0.546875} ${iconSize * 0.5} L${iconSize * 0.59375} ${iconSize * 0.59375} L${iconSize * 0.71875} ${iconSize * 0.59375}`"
        fill="none"
        stroke="#ffffff"
        :stroke-width="iconSize * 0.04"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>

    <!-- Wordmark -->
    <div v-if="showText">
      <span :class="['font-bold', textSize]">
        <span class="text-emerald-600">Gerust</span><span class="text-gray-900">Thuis</span>
      </span>
    </div>
  </div>
</template>
