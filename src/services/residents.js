import { supabase } from './client'
import { getCurrentHouseholdId } from './household'

export async function getResident() {
  const householdId = getCurrentHouseholdId()
  if (!householdId) return null

  const { data, error } = await supabase
    .from('residents')
    .select('id, naam, relationship, foto_url, geboortedatum')
    .eq('household_id', householdId)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (error) console.error('Error fetching resident:', error)
  return data
}
