import { supabase } from './client'
import { getCurrentUser } from './auth'
import { getCurrentHouseholdId } from './household'

// ============================================================
// Family board (migration 032)
// ============================================================

export async function getFamilyBoardMessages(limit = 30) {
  const householdId = getCurrentHouseholdId()
  if (!householdId) return []

  const { data, error } = await supabase
    .from('family_board_messages')
    .select(`id, message, created_at, author:author_id(id)`)
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching family board messages:', error)
    return []
  }

  const messages = data || []
  const authorIds = [...new Set(messages.map(m => m.author?.id).filter(Boolean))]

  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, display_name')
      .in('id', authorIds)

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.display_name]))
    return messages.map(m => ({ ...m, author_name: profileMap[m.author?.id] || 'Onbekend' }))
  }

  return messages.map(m => ({ ...m, author_name: 'Onbekend' }))
}

export async function postFamilyBoardMessage(message) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  const householdId = getCurrentHouseholdId()
  if (!householdId) throw new Error('No household selected')

  const { data, error } = await supabase
    .from('family_board_messages')
    .insert({ household_id: householdId, author_id: user.id, message })
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================================
// Notifications (migration 033)
// ============================================================

export async function getNotifications(limit = 50) {
  const householdId = getCurrentHouseholdId()
  if (!householdId) return []

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, read, created_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching notifications:', error)
    return []
  }
  return data || []
}

export async function markNotificationRead(id) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead() {
  const householdId = getCurrentHouseholdId()
  if (!householdId) return

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('household_id', householdId)
    .eq('read', false)

  if (error) throw error
}
