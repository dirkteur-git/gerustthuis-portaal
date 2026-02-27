<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  supabase,
  getCurrentHouseholdId,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/supabase'

const notifications = ref([])
const loading = ref(true)
const error = ref(null)
let realtimeChannel = null

const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

// Group notifications by date
const groupedNotifications = computed(() => {
  const groups = {}
  for (const n of notifications.value) {
    const dateKey = new Date(n.created_at).toLocaleDateString('nl-NL', {
      weekday: 'long', day: 'numeric', month: 'long'
    })
    if (!groups[dateKey]) groups[dateKey] = []
    groups[dateKey].push(n)
  }
  return groups
})

function typeIcon(type) {
  const icons = {
    activity_low: 'alert',
    activity_normal: 'check',
    no_activity: 'warning',
    system: 'info',
  }
  return icons[type] || 'info'
}

function typeColor(type) {
  const colors = {
    activity_low: '#f59e0b',
    no_activity: '#ef4444',
    activity_normal: '#10b981',
    system: '#6b7280',
  }
  return colors[type] || '#6b7280'
}

function formatTime(isoString) {
  const date = new Date(isoString)
  const h = date.getHours()
  if (h < 6) return 'nacht'
  if (h < 12) return 'ochtend'
  if (h < 18) return 'middag'
  return 'avond'
}

async function loadNotifications() {
  loading.value = true
  error.value = null
  try {
    notifications.value = await getNotifications(50)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function handleMarkRead(id) {
  try {
    await markNotificationRead(id)
    const n = notifications.value.find(n => n.id === id)
    if (n) n.read = true
  } catch (e) {
    error.value = e.message
  }
}

async function handleMarkAllRead() {
  try {
    await markAllNotificationsRead()
    notifications.value.forEach(n => (n.read = true))
  } catch (e) {
    error.value = e.message
  }
}

function subscribeRealtime() {
  const householdId = getCurrentHouseholdId()
  if (!householdId) return

  realtimeChannel = supabase
    .channel(`notifications-${householdId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `household_id=eq.${householdId}`,
    }, async () => {
      notifications.value = await getNotifications(50)
    })
    .subscribe()
}

onMounted(async () => {
  await loadNotifications()
  subscribeRealtime()
})

onUnmounted(() => {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)
})
</script>

<template>
  <div class="meldingen-page">
    <!-- Header -->
    <div class="page-header">
      <h1>Meldingen</h1>
      <button
        v-if="unreadCount > 0"
        @click="handleMarkAllRead"
        class="btn-mark-all"
      >
        Alles gelezen
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="skeleton-list">
      <div v-for="i in 5" :key="i" class="skeleton-notification"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="notifications.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </div>
      <p class="empty-title">Geen meldingen</p>
      <p class="empty-sub">Alles goed — er zijn geen ongewone activiteiten.</p>
    </div>

    <!-- Grouped notifications -->
    <div v-else class="groups">
      <div v-for="(items, dateLabel) in groupedNotifications" :key="dateLabel" class="group">
        <p class="group-label">{{ dateLabel }}</p>

        <div class="notification-list">
          <button
            v-for="n in items"
            :key="n.id"
            class="notification-item"
            :class="{ 'notification-item--unread': !n.read }"
            @click="!n.read && handleMarkRead(n.id)"
          >
            <div class="notif-icon" :style="{ '--icon-color': typeColor(n.type) }">
              <!-- Warning -->
              <svg v-if="typeIcon(n.type) === 'warning'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <!-- Alert -->
              <svg v-else-if="typeIcon(n.type) === 'alert'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <!-- Check -->
              <svg v-else-if="typeIcon(n.type) === 'check'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <!-- Info -->
              <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </div>

            <div class="notif-content">
              <p class="notif-title">{{ n.title }}</p>
              <p v-if="n.body" class="notif-body">{{ n.body }}</p>
              <p class="notif-time">{{ formatTime(n.created_at) }}</p>
            </div>

            <div v-if="!n.read" class="unread-dot"></div>
          </button>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-banner">{{ error }}</div>
  </div>
</template>

<style scoped>
.meldingen-page {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 600px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0;
}

.page-header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
}

.btn-mark-all {
  font-size: 0.8rem;
  color: #2563eb;
  background: none;
  border: none;
  cursor: pointer;
  font-weight: 500;
  padding: 0.25rem 0;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem 1rem;
  gap: 0.5rem;
  text-align: center;
}

.empty-icon {
  color: #d1d5db;
  margin-bottom: 0.5rem;
}

.empty-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #6b7280;
}

.empty-sub {
  margin: 0;
  font-size: 0.875rem;
  color: #9ca3af;
}

/* Groups */
.groups {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.group-label {
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  background: white;
  border-radius: 12px;
  padding: 0.875rem;
  border: 1px solid #e5e7eb;
  text-align: left;
  cursor: default;
  width: 100%;
  position: relative;
  transition: background 0.15s;
}

.notification-item--unread {
  background: #eff6ff;
  border-color: #bfdbfe;
  cursor: pointer;
}

.notification-item--unread:hover {
  background: #dbeafe;
}

.notif-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--icon-color) 15%, white);
  color: var(--icon-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notif-content {
  flex: 1;
  min-width: 0;
}

.notif-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #1f2937;
}

.notif-body {
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
  color: #6b7280;
  word-break: break-word;
}

.notif-time {
  margin: 0.2rem 0 0;
  font-size: 0.7rem;
  color: #9ca3af;
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2563eb;
  flex-shrink: 0;
  margin-top: 4px;
}

/* Skeletons */
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skeleton-notification {
  height: 68px;
  background: #f3f4f6;
  border-radius: 12px;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.error-banner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
}
</style>
