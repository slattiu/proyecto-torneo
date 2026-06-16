import { getLandingSettings } from '@/lib/actions/landing-settings'
import { isAdmin } from '@/lib/actions/auth-helpers'
import { redirect } from 'next/navigation'
import { SettingsClient } from './SettingsClient'
import { createAdminClient } from '@/lib/supabase/server'

export default async function AdminSettingsPage() {
  const admin = await isAdmin()
  if (!admin) redirect('/tournaments')

  const settings = await getLandingSettings()
  const adminSupabase = await createAdminClient()

  // Fetch real active tournament statistics
  const { data: activeTournaments } = await adminSupabase
    .from('tournaments')
    .select('total_live_viewers, status, is_private')
    .neq('status', 'draft')

  const publicActiveTournaments = activeTournaments?.filter((t: any) => !t.is_private) || []
  const activeCount = publicActiveTournaments.filter((t: any) => t.status === 'active' || t.status === 'pending').length || 0
  const totalViewers = publicActiveTournaments.reduce((acc: number, curr: any) => acc + (curr.total_live_viewers || 0), 0) || 0


  return (
    <SettingsClient 
      initialSettings={settings} 
      activeCount={activeCount} 
      totalViewers={totalViewers} 
    />
  )
}
