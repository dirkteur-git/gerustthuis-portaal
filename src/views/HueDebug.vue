<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../services/supabase'

// State
const loading = ref(true)
const error = ref(null)
const hueConfig = ref(null)

// Raw API responses
const lightsRaw = ref({})
const sensorsRaw = ref({})
const groupsRaw = ref({})
const devicesV2Raw = ref([])
const roomsV2Raw = ref([])
const contactSensorsV2Raw = ref([])

// Selected tab
const activeTab = ref('lights')

const tabs = [
  { id: 'lights', label: 'Lampen', icon: '💡' },
  { id: 'sensors', label: 'Sensoren', icon: '📡' },
  { id: 'groups', label: 'Kamers/Groups', icon: '🏠' },
  { id: 'devicesV2', label: 'Devices V2', icon: '📱' },
  { id: 'roomsV2', label: 'Rooms V2', icon: '🚪' },
  { id: 'contactV2', label: 'Contact V2', icon: '🚨' },
]

// Computed: Sensoren per type
const sensorsByType = computed(() => {
  const byType = {
    motion: [],
    button: [],
    temperature: [],
    lightlevel: [],
    contact: [],
    other: []
  }

  for (const [id, sensor] of Object.entries(sensorsRaw.value)) {
    const type = sensor.type || 'unknown'
    const entry = { id, ...sensor }

    if (type.includes('Presence') || type.includes('Motion')) {
      byType.motion.push(entry)
    } else if (type.includes('Switch') || type.includes('Button')) {
      byType.button.push(entry)
    } else if (type.includes('Temperature')) {
      byType.temperature.push(entry)
    } else if (type.includes('LightLevel')) {
      byType.lightlevel.push(entry)
    } else if (type.includes('OpenClose') || type.includes('Contact')) {
      byType.contact.push(entry)
    } else {
      byType.other.push(entry)
    }
  }

  return byType
})

// Computed: Groups per type
const groupsByType = computed(() => {
  const byType = {
    room: [],
    zone: [],
    other: []
  }

  for (const [id, group] of Object.entries(groupsRaw.value)) {
    const entry = { id, ...group }
    const type = (group.type || '').toLowerCase()

    if (type === 'room') {
      byType.room.push(entry)
    } else if (type === 'zone') {
      byType.zone.push(entry)
    } else {
      byType.other.push(entry)
    }
  }

  return byType
})

// Load all data via Edge Function
async function loadData() {
  loading.value = true
  error.value = null

  try {
    // Get current user email
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      error.value = 'Niet ingelogd'
      loading.value = false
      return
    }

    const { data, error: fetchError } = await supabase.functions.invoke('hue-debug', {
      body: { user_email: user.email }
    })

    if (fetchError) {
      error.value = fetchError.message || 'Failed to fetch'
      loading.value = false
      return
    }

    if (!data?.success) {
      error.value = data?.error || 'Unknown error'
      loading.value = false
      return
    }

    hueConfig.value = data.config
    lightsRaw.value = data.data.lights
    sensorsRaw.value = data.data.sensors
    groupsRaw.value = data.data.groups
    devicesV2Raw.value = data.data.devicesV2
    roomsV2Raw.value = data.data.roomsV2
    contactSensorsV2Raw.value = data.data.contactV2

  } catch (err) {
    console.error('Load error:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

// Format JSON
function formatJson(obj) {
  return JSON.stringify(obj, null, 2)
}

// Count items
function countItems(obj) {
  if (Array.isArray(obj)) return obj.length
  return Object.keys(obj).length
}

onMounted(loadData)
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Hue Debug - JSON Inspector</h1>
        <p class="text-gray-600">Bekijk de ruwe JSON responses van de Hue API per device type</p>
        <router-link to="/" class="text-emerald-600 hover:underline text-sm">← Terug naar dashboard</router-link>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        <span class="ml-3 text-gray-600">Data ophalen van Hue Bridge...</span>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-700">{{ error }}</p>
        <button @click="loadData" class="mt-2 text-red-600 hover:underline">Opnieuw proberen</button>
      </div>

      <!-- Data -->
      <div v-else>
        <!-- Config info -->
        <div class="bg-white rounded-lg shadow p-4 mb-6">
          <h2 class="font-semibold text-gray-700 mb-2">Hue Config</h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span class="text-gray-500">User:</span>
              <span class="ml-2 font-mono">{{ hueConfig?.user_email }}</span>
            </div>
            <div>
              <span class="text-gray-500">Bridge:</span>
              <span class="ml-2 font-mono">{{ hueConfig?.bridge_username?.substring(0, 10) }}...</span>
            </div>
            <div>
              <span class="text-gray-500">Status:</span>
              <span class="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">{{ hueConfig?.status }}</span>
            </div>
            <div>
              <button @click="loadData" class="px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700">
                Refresh
              </button>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="bg-white rounded-lg shadow">
          <!-- Tab headers -->
          <div class="border-b flex flex-wrap">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              :class="[
                'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              ]"
            >
              <span class="mr-2">{{ tab.icon }}</span>
              {{ tab.label }}
              <span class="ml-2 text-xs text-gray-400">
                ({{ tab.id === 'lights' ? countItems(lightsRaw) :
                    tab.id === 'sensors' ? countItems(sensorsRaw) :
                    tab.id === 'groups' ? countItems(groupsRaw) :
                    tab.id === 'devicesV2' ? countItems(devicesV2Raw) :
                    tab.id === 'roomsV2' ? countItems(roomsV2Raw) :
                    countItems(contactSensorsV2Raw) }})
              </span>
            </button>
          </div>

          <!-- Tab content -->
          <div class="p-4">

            <!-- Lights -->
            <div v-if="activeTab === 'lights'">
              <h3 class="text-lg font-semibold mb-4">Lampen ({{ countItems(lightsRaw) }})</h3>
              <div class="space-y-4">
                <div v-for="(light, id) in lightsRaw" :key="id" class="border rounded-lg p-4">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-semibold text-emerald-700">
                      {{ light.name }}
                      <span class="text-gray-400 text-sm">(ID: {{ id }})</span>
                    </span>
                    <span :class="light.state?.on ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'" class="px-2 py-0.5 rounded text-xs">
                      {{ light.state?.on ? 'AAN' : 'UIT' }}
                    </span>
                  </div>
                  <div class="text-xs text-gray-500 mb-2">
                    Type: {{ light.type }} | UniqueID: {{ light.uniqueid }}
                  </div>
                  <details>
                    <summary class="cursor-pointer text-sm text-emerald-600 hover:underline">Toon JSON</summary>
                    <pre class="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded overflow-x-auto">{{ formatJson(light) }}</pre>
                  </details>
                </div>
              </div>
            </div>

            <!-- Sensors -->
            <div v-if="activeTab === 'sensors'">
              <h3 class="text-lg font-semibold mb-4">Sensoren ({{ countItems(sensorsRaw) }})</h3>

              <!-- Motion sensors -->
              <div v-if="sensorsByType.motion.length" class="mb-6">
                <h4 class="font-medium text-gray-700 mb-2 flex items-center">
                  <span class="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                  Motion Sensors ({{ sensorsByType.motion.length }})
                </h4>
                <div class="space-y-3">
                  <div v-for="sensor in sensorsByType.motion" :key="sensor.id" class="border rounded-lg p-4 border-blue-200 bg-blue-50">
                    <div class="flex items-center justify-between mb-2">
                      <span class="font-semibold text-blue-700">
                        {{ sensor.name }}
                        <span class="text-gray-400 text-sm">(ID: {{ sensor.id }})</span>
                      </span>
                      <span :class="sensor.state?.presence ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'" class="px-2 py-0.5 rounded text-xs">
                        {{ sensor.state?.presence ? 'BEWEGING' : 'Geen beweging' }}
                      </span>
                    </div>
                    <div class="text-xs text-gray-600 mb-2">
                      Type: {{ sensor.type }} | Battery: {{ sensor.config?.battery }}% | UniqueID: {{ sensor.uniqueid }}
                    </div>
                    <div class="text-xs text-gray-500 mb-2">
                      Lastupdated: <span class="font-mono">{{ sensor.state?.lastupdated }}</span>
                    </div>
                    <details>
                      <summary class="cursor-pointer text-sm text-blue-600 hover:underline">Toon JSON</summary>
                      <pre class="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded overflow-x-auto">{{ formatJson(sensor) }}</pre>
                    </details>
                  </div>
                </div>
              </div>

              <!-- Buttons/Switches -->
              <div v-if="sensorsByType.button.length" class="mb-6">
                <h4 class="font-medium text-gray-700 mb-2 flex items-center">
                  <span class="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
                  Schakelaars/Buttons ({{ sensorsByType.button.length }})
                </h4>
                <div class="space-y-3">
                  <div v-for="sensor in sensorsByType.button" :key="sensor.id" class="border rounded-lg p-4 border-purple-200 bg-purple-50">
                    <div class="flex items-center justify-between mb-2">
                      <span class="font-semibold text-purple-700">
                        {{ sensor.name }}
                        <span class="text-gray-400 text-sm">(ID: {{ sensor.id }})</span>
                      </span>
                      <span class="bg-purple-200 text-purple-700 px-2 py-0.5 rounded text-xs">
                        Event: {{ sensor.state?.buttonevent || '-' }}
                      </span>
                    </div>
                    <div class="text-xs text-gray-600 mb-2">
                      Type: {{ sensor.type }} | Battery: {{ sensor.config?.battery ?? 'N/A' }}% | UniqueID: {{ sensor.uniqueid }}
                    </div>
                    <div class="text-xs text-gray-500 mb-2">
                      Lastupdated: <span class="font-mono">{{ sensor.state?.lastupdated }}</span>
                    </div>
                    <details>
                      <summary class="cursor-pointer text-sm text-purple-600 hover:underline">Toon JSON</summary>
                      <pre class="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded overflow-x-auto">{{ formatJson(sensor) }}</pre>
                    </details>
                  </div>
                </div>
              </div>

              <!-- Temperature sensors -->
              <div v-if="sensorsByType.temperature.length" class="mb-6">
                <h4 class="font-medium text-gray-700 mb-2 flex items-center">
                  <span class="w-3 h-3 bg-orange-500 rounded-full mr-2"></span>
                  Temperatuur Sensors ({{ sensorsByType.temperature.length }})
                </h4>
                <div class="space-y-3">
                  <div v-for="sensor in sensorsByType.temperature" :key="sensor.id" class="border rounded-lg p-4 border-orange-200 bg-orange-50">
                    <div class="flex items-center justify-between mb-2">
                      <span class="font-semibold text-orange-700">
                        {{ sensor.name }}
                        <span class="text-gray-400 text-sm">(ID: {{ sensor.id }})</span>
                      </span>
                      <span class="bg-orange-200 text-orange-700 px-2 py-0.5 rounded text-xs">
                        {{ (sensor.state?.temperature / 100).toFixed(1) }}°C
                      </span>
                    </div>
                    <div class="text-xs text-gray-600 mb-2">
                      Type: {{ sensor.type }} | Battery: {{ sensor.config?.battery }}% | UniqueID: {{ sensor.uniqueid }}
                    </div>
                    <details>
                      <summary class="cursor-pointer text-sm text-orange-600 hover:underline">Toon JSON</summary>
                      <pre class="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded overflow-x-auto">{{ formatJson(sensor) }}</pre>
                    </details>
                  </div>
                </div>
              </div>

              <!-- Light level sensors -->
              <div v-if="sensorsByType.lightlevel.length" class="mb-6">
                <h4 class="font-medium text-gray-700 mb-2 flex items-center">
                  <span class="w-3 h-3 bg-amber-500 rounded-full mr-2"></span>
                  Lichtsterkte Sensors ({{ sensorsByType.lightlevel.length }})
                </h4>
                <div class="space-y-3">
                  <div v-for="sensor in sensorsByType.lightlevel" :key="sensor.id" class="border rounded-lg p-4 border-amber-200 bg-amber-50">
                    <div class="flex items-center justify-between mb-2">
                      <span class="font-semibold text-amber-700">
                        {{ sensor.name }}
                        <span class="text-gray-400 text-sm">(ID: {{ sensor.id }})</span>
                      </span>
                      <span class="bg-amber-200 text-amber-700 px-2 py-0.5 rounded text-xs">
                        Level: {{ sensor.state?.lightlevel }} | {{ sensor.state?.dark ? 'Donker' : 'Licht' }}
                      </span>
                    </div>
                    <div class="text-xs text-gray-600 mb-2">
                      Type: {{ sensor.type }} | Battery: {{ sensor.config?.battery }}% | UniqueID: {{ sensor.uniqueid }}
                    </div>
                    <details>
                      <summary class="cursor-pointer text-sm text-amber-600 hover:underline">Toon JSON</summary>
                      <pre class="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded overflow-x-auto">{{ formatJson(sensor) }}</pre>
                    </details>
                  </div>
                </div>
              </div>

              <!-- Contact sensors -->
              <div v-if="sensorsByType.contact.length" class="mb-6">
                <h4 class="font-medium text-gray-700 mb-2 flex items-center">
                  <span class="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                  Contact Sensors ({{ sensorsByType.contact.length }})
                </h4>
                <div class="space-y-3">
                  <div v-for="sensor in sensorsByType.contact" :key="sensor.id" class="border rounded-lg p-4 border-red-200 bg-red-50">
                    <div class="flex items-center justify-between mb-2">
                      <span class="font-semibold text-red-700">
                        {{ sensor.name }}
                        <span class="text-gray-400 text-sm">(ID: {{ sensor.id }})</span>
                      </span>
                      <span :class="sensor.state?.open ? 'bg-red-500 text-white' : 'bg-green-200 text-green-700'" class="px-2 py-0.5 rounded text-xs">
                        {{ sensor.state?.open ? 'OPEN' : 'Dicht' }}
                      </span>
                    </div>
                    <div class="text-xs text-gray-600 mb-2">
                      Type: {{ sensor.type }} | UniqueID: {{ sensor.uniqueid }}
                    </div>
                    <details>
                      <summary class="cursor-pointer text-sm text-red-600 hover:underline">Toon JSON</summary>
                      <pre class="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded overflow-x-auto">{{ formatJson(sensor) }}</pre>
                    </details>
                  </div>
                </div>
              </div>

              <!-- Other sensors -->
              <div v-if="sensorsByType.other.length" class="mb-6">
                <h4 class="font-medium text-gray-700 mb-2 flex items-center">
                  <span class="w-3 h-3 bg-gray-500 rounded-full mr-2"></span>
                  Overige Sensors ({{ sensorsByType.other.length }})
                </h4>
                <div class="space-y-3">
                  <div v-for="sensor in sensorsByType.other" :key="sensor.id" class="border rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                      <span class="font-semibold text-gray-700">
                        {{ sensor.name }}
                        <span class="text-gray-400 text-sm">(ID: {{ sensor.id }})</span>
                      </span>
                      <span class="bg-gray-200 text-gray-600 px-2 py-0.5 rounded text-xs">
                        {{ sensor.type }}
                      </span>
                    </div>
                    <div class="text-xs text-gray-600 mb-2">
                      UniqueID: {{ sensor.uniqueid }}
                    </div>
                    <details>
                      <summary class="cursor-pointer text-sm text-gray-600 hover:underline">Toon JSON</summary>
                      <pre class="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded overflow-x-auto">{{ formatJson(sensor) }}</pre>
                    </details>
                  </div>
                </div>
              </div>
            </div>

            <!-- Groups -->
            <div v-if="activeTab === 'groups'">
              <h3 class="text-lg font-semibold mb-4">Groups ({{ countItems(groupsRaw) }})</h3>

              <!-- Rooms -->
              <div v-if="groupsByType.room.length" class="mb-6">
                <h4 class="font-medium text-gray-700 mb-2 flex items-center">
                  <span class="w-3 h-3 bg-emerald-500 rounded-full mr-2"></span>
                  Kamers ({{ groupsByType.room.length }})
                </h4>
                <div class="space-y-3">
                  <div v-for="group in groupsByType.room" :key="group.id" class="border rounded-lg p-4 border-emerald-200 bg-emerald-50">
                    <div class="flex items-center justify-between mb-2">
                      <span class="font-semibold text-emerald-700">
                        {{ group.name }}
                        <span class="text-gray-400 text-sm">(ID: {{ group.id }})</span>
                      </span>
                      <span class="bg-emerald-200 text-emerald-700 px-2 py-0.5 rounded text-xs">
                        {{ group.lights?.length || 0 }} lampen
                      </span>
                    </div>
                    <div class="text-xs text-gray-600 mb-2">
                      Type: {{ group.type }} | Class: {{ group.class }} | Lights: {{ group.lights?.join(', ') }}
                    </div>
                    <details>
                      <summary class="cursor-pointer text-sm text-emerald-600 hover:underline">Toon JSON</summary>
                      <pre class="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded overflow-x-auto">{{ formatJson(group) }}</pre>
                    </details>
                  </div>
                </div>
              </div>

              <!-- Zones -->
              <div v-if="groupsByType.zone.length" class="mb-6">
                <h4 class="font-medium text-gray-700 mb-2 flex items-center">
                  <span class="w-3 h-3 bg-cyan-500 rounded-full mr-2"></span>
                  Zones ({{ groupsByType.zone.length }})
                </h4>
                <div class="space-y-3">
                  <div v-for="group in groupsByType.zone" :key="group.id" class="border rounded-lg p-4 border-cyan-200 bg-cyan-50">
                    <div class="flex items-center justify-between mb-2">
                      <span class="font-semibold text-cyan-700">
                        {{ group.name }}
                        <span class="text-gray-400 text-sm">(ID: {{ group.id }})</span>
                      </span>
                    </div>
                    <details>
                      <summary class="cursor-pointer text-sm text-cyan-600 hover:underline">Toon JSON</summary>
                      <pre class="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded overflow-x-auto">{{ formatJson(group) }}</pre>
                    </details>
                  </div>
                </div>
              </div>

              <!-- Other groups -->
              <div v-if="groupsByType.other.length" class="mb-6">
                <h4 class="font-medium text-gray-700 mb-2 flex items-center">
                  <span class="w-3 h-3 bg-gray-500 rounded-full mr-2"></span>
                  Overige ({{ groupsByType.other.length }})
                </h4>
                <div class="space-y-3">
                  <div v-for="group in groupsByType.other" :key="group.id" class="border rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                      <span class="font-semibold text-gray-700">
                        {{ group.name }}
                        <span class="text-gray-400 text-sm">(ID: {{ group.id }})</span>
                      </span>
                      <span class="bg-gray-200 text-gray-600 px-2 py-0.5 rounded text-xs">
                        {{ group.type }}
                      </span>
                    </div>
                    <details>
                      <summary class="cursor-pointer text-sm text-gray-600 hover:underline">Toon JSON</summary>
                      <pre class="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded overflow-x-auto">{{ formatJson(group) }}</pre>
                    </details>
                  </div>
                </div>
              </div>
            </div>

            <!-- Devices V2 -->
            <div v-if="activeTab === 'devicesV2'">
              <h3 class="text-lg font-semibold mb-4">Devices V2 API ({{ countItems(devicesV2Raw) }})</h3>
              <div class="space-y-3">
                <div v-for="device in devicesV2Raw" :key="device.id" class="border rounded-lg p-4">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-semibold text-gray-700">
                      {{ device.metadata?.name || 'Unnamed' }}
                      <span class="text-gray-400 text-sm">({{ device.id?.substring(0, 8) }}...)</span>
                    </span>
                    <span class="bg-gray-200 text-gray-600 px-2 py-0.5 rounded text-xs">
                      {{ device.product_data?.product_name || 'Unknown' }}
                    </span>
                  </div>
                  <div class="text-xs text-gray-600 mb-2">
                    Archetype: {{ device.metadata?.archetype }} | Model: {{ device.product_data?.model_id }}
                  </div>
                  <details>
                    <summary class="cursor-pointer text-sm text-gray-600 hover:underline">Toon JSON</summary>
                    <pre class="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded overflow-x-auto">{{ formatJson(device) }}</pre>
                  </details>
                </div>
              </div>
            </div>

            <!-- Rooms V2 -->
            <div v-if="activeTab === 'roomsV2'">
              <h3 class="text-lg font-semibold mb-4">Rooms V2 API ({{ countItems(roomsV2Raw) }})</h3>
              <div class="space-y-3">
                <div v-for="room in roomsV2Raw" :key="room.id" class="border rounded-lg p-4 border-emerald-200 bg-emerald-50">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-semibold text-emerald-700">
                      {{ room.metadata?.name || 'Unnamed' }}
                      <span class="text-gray-400 text-sm">({{ room.id?.substring(0, 8) }}...)</span>
                    </span>
                    <span class="bg-emerald-200 text-emerald-700 px-2 py-0.5 rounded text-xs">
                      {{ room.children?.length || 0 }} devices
                    </span>
                  </div>
                  <div class="text-xs text-gray-600 mb-2">
                    Archetype: {{ room.metadata?.archetype }}
                  </div>
                  <details>
                    <summary class="cursor-pointer text-sm text-emerald-600 hover:underline">Toon JSON</summary>
                    <pre class="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded overflow-x-auto">{{ formatJson(room) }}</pre>
                  </details>
                </div>
              </div>
            </div>

            <!-- Contact Sensors V2 -->
            <div v-if="activeTab === 'contactV2'">
              <h3 class="text-lg font-semibold mb-4">Contact Sensors V2 API ({{ countItems(contactSensorsV2Raw) }})</h3>
              <div v-if="contactSensorsV2Raw.length === 0" class="text-gray-500 text-center py-8">
                Geen contact sensors gevonden
              </div>
              <div class="space-y-3">
                <div v-for="contact in contactSensorsV2Raw" :key="contact.id" class="border rounded-lg p-4 border-red-200 bg-red-50">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-semibold text-red-700">
                      Contact Sensor
                      <span class="text-gray-400 text-sm">({{ contact.id?.substring(0, 8) }}...)</span>
                    </span>
                    <span :class="contact.contact_report?.state === 'no_contact' ? 'bg-red-500 text-white' : 'bg-green-200 text-green-700'" class="px-2 py-0.5 rounded text-xs">
                      {{ contact.contact_report?.state === 'no_contact' ? 'OPEN' : 'Dicht' }}
                    </span>
                  </div>
                  <div class="text-xs text-gray-600 mb-2">
                    State: {{ contact.contact_report?.state }} | Changed: {{ contact.contact_report?.changed }}
                  </div>
                  <details>
                    <summary class="cursor-pointer text-sm text-red-600 hover:underline">Toon JSON</summary>
                    <pre class="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded overflow-x-auto">{{ formatJson(contact) }}</pre>
                  </details>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>
</template>
