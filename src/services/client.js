import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Schema-scoped helpers voor tabellen buiten public
export const activityDb = () => supabase.schema('activity')
export const integrationsDb = () => supabase.schema('integrations')
