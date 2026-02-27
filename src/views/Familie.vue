<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import {
  supabase,
  userState,
  isAdmin,
  getCurrentHouseholdId,
  getResident,
  getHouseholdMembers,
  getFamilyBoardMessages,
  postFamilyBoardMessage,
  inviteToHousehold,
} from '../services/supabase'

const resident = ref(null)
const members = ref([])
const boardMessages = ref([])
const newMessage = ref('')
const inviteEmail = ref('')
const showInviteForm = ref(false)
const loading = ref(true)
const postingMessage = ref(false)
const sendingInvite = ref(false)
const error = ref(null)
let realtimeChannel = null

function formatDagdeel(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const h = date.getHours()
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  let dagdeel
  if (h < 6) dagdeel = 'nacht'
  else if (h < 12) dagdeel = 'ochtend'
  else if (h < 18) dagdeel = 'middag'
  else dagdeel = 'avond'

  if (isToday) return `Vandaag ${dagdeel}`
  if (isYesterday) return `Gisteren ${dagdeel}`
  return date.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }) + ` ${dagdeel}`
}

function roleLabel(role) {
  if (role === 'admin') return 'Beheerder'
  if (role === 'viewer') return 'Meekijker'
  return role || ''
}

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const [res, mem, msgs] = await Promise.all([
      getResident(),
      getHouseholdMembers(getCurrentHouseholdId()),
      getFamilyBoardMessages(30),
    ])
    resident.value = res
    members.value = mem
    boardMessages.value = msgs
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function handlePostMessage() {
  const msg = newMessage.value.trim()
  if (!msg) return
  postingMessage.value = true
  try {
    await postFamilyBoardMessage(msg)
    newMessage.value = ''
    // Realtime will update, but also refresh manually as fallback
    const msgs = await getFamilyBoardMessages(30)
    boardMessages.value = msgs
  } catch (e) {
    error.value = e.message
  } finally {
    postingMessage.value = false
  }
}

async function handleInvite() {
  const email = inviteEmail.value.trim()
  if (!email) return
  sendingInvite.value = true
  try {
    await inviteToHousehold(getCurrentHouseholdId(), email, 'viewer')
    inviteEmail.value = ''
    showInviteForm.value = false
  } catch (e) {
    error.value = e.message
  } finally {
    sendingInvite.value = false
  }
}

function subscribeRealtime() {
  const householdId = getCurrentHouseholdId()
  if (!householdId) return

  realtimeChannel = supabase
    .channel(`family-board-${householdId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'family_board_messages',
      filter: `household_id=eq.${householdId}`,
    }, async () => {
      const msgs = await getFamilyBoardMessages(30)
      boardMessages.value = msgs
    })
    .subscribe()
}

onMounted(async () => {
  await loadData()
  subscribeRealtime()
})

onUnmounted(() => {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)
})
</script>

<template>
  <div class="familie-page">
    <!-- Bewoner banner -->
    <div v-if="resident" class="resident-banner">
      <div class="resident-avatar">
        <img v-if="resident.foto_url" :src="resident.foto_url" :alt="resident.naam" />
        <span v-else class="resident-initials">{{ resident.naam?.charAt(0)?.toUpperCase() || '?' }}</span>
      </div>
      <div>
        <h1 class="resident-name">{{ resident.naam }}</h1>
        <p class="resident-relation">{{ resident.relationship }}</p>
      </div>
    </div>

    <div v-else-if="!loading" class="resident-banner resident-banner--empty">
      <div class="resident-avatar">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <div>
        <h1 class="resident-name">Bewoner</h1>
        <p class="resident-relation">Nog geen bewoner ingesteld</p>
      </div>
    </div>

    <!-- Familieleden -->
    <section class="section">
      <div class="section-header">
        <h2>Familieleden</h2>
        <button v-if="isAdmin()" @click="showInviteForm = !showInviteForm" class="btn-invite">
          + Uitnodigen
        </button>
      </div>

      <!-- Invite form -->
      <div v-if="showInviteForm" class="invite-form">
        <input
          v-model="inviteEmail"
          type="email"
          placeholder="e-mailadres"
          class="invite-input"
          @keyup.enter="handleInvite"
        />
        <button @click="handleInvite" :disabled="sendingInvite || !inviteEmail.trim()" class="btn-primary btn-sm">
          {{ sendingInvite ? 'Versturen…' : 'Verstuur uitnodiging' }}
        </button>
      </div>

      <div v-if="loading" class="skeleton-list">
        <div v-for="i in 3" :key="i" class="skeleton-member"></div>
      </div>

      <div v-else-if="members.length === 0" class="empty-state">
        Nog geen familieleden gekoppeld.
      </div>

      <ul v-else class="member-list">
        <li v-for="member in members" :key="member.id" class="member-item">
          <div class="member-avatar">
            {{ (member.display_name || member.email || '?').charAt(0).toUpperCase() }}
          </div>
          <div class="member-info">
            <span class="member-name">{{ member.display_name || member.email }}</span>
            <span class="member-role">{{ roleLabel(member.role) }}</span>
          </div>
        </li>
      </ul>
    </section>

    <!-- Familiegroep / Board -->
    <section class="section">
      <h2 class="section-title">Familiegroep</h2>

      <div v-if="loading" class="skeleton-list">
        <div v-for="i in 4" :key="i" class="skeleton-message"></div>
      </div>

      <div v-else>
        <!-- Messages -->
        <div v-if="boardMessages.length === 0" class="empty-state">
          Nog geen berichten. Schrijf het eerste bericht!
        </div>

        <div v-else class="message-list">
          <div
            v-for="msg in boardMessages"
            :key="msg.id"
            class="message-item"
            :class="{ 'message-item--own': msg.author?.id === userState.profile?.id }"
          >
            <div class="message-bubble">
              <p class="message-text">{{ msg.message }}</p>
              <p class="message-meta">{{ msg.author_name }} · {{ formatDagdeel(msg.created_at) }}</p>
            </div>
          </div>
        </div>

        <!-- New message -->
        <div class="message-input-area">
          <input
            v-model="newMessage"
            type="text"
            placeholder="Schrijf een bericht…"
            class="message-input"
            @keyup.enter="handlePostMessage"
          />
          <button
            @click="handlePostMessage"
            :disabled="postingMessage || !newMessage.trim()"
            class="btn-send"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </section>

    <!-- Error -->
    <div v-if="error" class="error-banner">{{ error }}</div>
  </div>
</template>

<style scoped>
.familie-page {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 600px;
  margin: 0 auto;
}

/* Resident banner */
.resident-banner {
  background: linear-gradient(135deg, #dbeafe 0%, #ede9fe 100%);
  border-radius: 16px;
  padding: 1.25rem 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.resident-banner--empty {
  background: #f3f4f6;
  opacity: 0.7;
}

.resident-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  font-size: 1.5rem;
  font-weight: 700;
  color: #2563eb;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}

.resident-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.resident-name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e3a5f;
}

.resident-relation {
  margin: 0.2rem 0 0;
  font-size: 0.85rem;
  color: #4b6a8a;
}

/* Section */
.section {
  background: white;
  border-radius: 16px;
  padding: 1rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.section-header h2,
.section-title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
}

/* Invite form */
.invite-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.invite-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.9rem;
  outline: none;
}

.invite-input:focus {
  border-color: #2563eb;
}

/* Buttons */
.btn-invite {
  font-size: 0.8rem;
  font-weight: 500;
  color: #2563eb;
  background: none;
  border: 1px solid #2563eb;
  border-radius: 8px;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
}

.btn-primary {
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 0.4rem 0.75rem;
  font-size: 0.8rem;
  white-space: nowrap;
}

/* Member list */
.member-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.member-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #dbeafe;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.member-info {
  display: flex;
  flex-direction: column;
}

.member-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: #1f2937;
}

.member-role {
  font-size: 0.75rem;
  color: #6b7280;
}

/* Messages */
.message-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
  max-height: 320px;
  overflow-y: auto;
}

.message-item {
  display: flex;
}

.message-item--own {
  justify-content: flex-end;
}

.message-bubble {
  background: #f3f4f6;
  border-radius: 12px;
  padding: 0.6rem 0.9rem;
  max-width: 80%;
}

.message-item--own .message-bubble {
  background: #dbeafe;
}

.message-text {
  margin: 0;
  font-size: 0.9rem;
  color: #1f2937;
  word-break: break-word;
}

.message-meta {
  margin: 0.25rem 0 0;
  font-size: 0.7rem;
  color: #9ca3af;
}

.message-input-area {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.message-input {
  flex: 1;
  padding: 0.6rem 0.9rem;
  border: 1px solid #e5e7eb;
  border-radius: 24px;
  font-size: 0.9rem;
  outline: none;
}

.message-input:focus {
  border-color: #2563eb;
}

.btn-send {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #2563eb;
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.btn-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Skeletons */
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skeleton-member,
.skeleton-message {
  height: 40px;
  background: #f3f4f6;
  border-radius: 8px;
  animation: pulse 1.5s ease-in-out infinite;
}

.skeleton-message {
  height: 52px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Empty & error */
.empty-state {
  text-align: center;
  color: #9ca3af;
  font-size: 0.875rem;
  padding: 1rem 0;
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
