import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/actions/auth-helpers'
import { redirect } from 'next/navigation'
import { updateProfile } from '@/lib/actions/profile'
import { SubscriptionUpload } from './SubscriptionUpload'
import { ProfileStatsClient } from './ProfileStatsClient'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getProfile()

  // 1. Fetch user tournament history
  const { data: participations } = await supabase
    .from('participants')
    .select(`
      id,
      tournament_id,
      team_id,
      total_kills,
      kd_ratio,
      avg_kills,
      br_avg_placement,
      tournaments (
        id,
        name,
        slug,
        discipline,
        start_date
      ),
      teams (
        id,
        name,
        team_standings (
          rank,
          total_points,
          total_kills
        )
      )
    `)
    .eq('user_id', user.id)

  // 2. Fetch badges
  const { data: badges } = await supabase
    .from('user_badges')
    .select('*')
    .eq('user_id', user.id)
    .order('awarded_at', { ascending: false })

  // 3. Fetch aggregate discipline rankings
  const { data: rankings } = await supabase
    .from('user_discipline_rankings')
    .select('*')
    .eq('user_id', user.id)
    .order('points', { ascending: false })

  // 4. Fetch points history
  const { data: pointsHistory } = await supabase
    .from('user_points_history')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  // Render components for forms
  const updateProfileForm = (
    <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6 space-y-4">
      <h2 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider mb-2">Editar perfil</h2>
      <form action={updateProfile} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-xs text-white/50 uppercase tracking-widest font-bold mb-1.5">
            Username / Nickname
          </label>
          <input
            id="username"
            name="username"
            type="text"
            defaultValue={profile?.username ?? ''}
            placeholder="Tu nombre de usuario"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-colors"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan text-xs uppercase font-bold tracking-widest rounded-xl hover:bg-neon-cyan/20 transition-colors"
        >
          Guardar cambios
        </button>
      </form>
    </div>
  )

  const subscriptionCard = (
    profile?.role !== 'ADMIN' && (
      <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider mb-2">Suscripción</h2>

        {profile?.subscriptionStatus === 'ACTIVE' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <p className="text-green-400 text-sm font-semibold">Suscripción activa</p>
            </div>
            {profile.subscriptionExpiry && (
              <p className="text-white/30 text-xs">
                Renovar antes del: {new Date(profile.subscriptionExpiry).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
            <p className="text-white/20 text-xs">
              Para renovar, sube un nuevo comprobante antes de que expire.
            </p>
          </div>
        ) : profile?.subscriptionStatus === 'PENDING' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <p className="text-yellow-400 text-sm font-semibold">Solicitud en revisión</p>
            </div>
            <p className="text-white/40 text-sm">
              Tu comprobante fue recibido. Te notificaremos cuando el administrador lo apruebe.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-neon-purple/5 border border-neon-purple/20 rounded-xl">
              <p className="text-neon-purple text-sm font-bold">Plan Streamer Pro — $15 / mes</p>
              <p className="text-white/40 text-xs mt-1">
                Torneos ilimitados · Leaderboard en vivo · Bridge ArenaCrypto · Streamer codes
              </p>
            </div>
            <div className="text-white/40 text-xs space-y-1">
              <p className="font-semibold text-white/60">Cómo activar:</p>
              <p>1. Realiza el pago de $15 a la cuenta indicada por el administrador.</p>
              <p>2. Toma un screenshot del comprobante y súbelo aquí.</p>
              <p>3. El administrador lo revisará y activará tu cuenta.</p>
            </div>
            <SubscriptionUpload />
          </div>
        )}
      </div>
    )
  )

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mi Perfil</h1>
        <p className="text-white/40 text-sm mt-1">Gestiona tu información personal y visualiza tu rendimiento</p>
      </div>

      <ProfileStatsClient
        profile={profile}
        user={user}
        participations={participations || []}
        badges={badges || []}
        rankings={rankings || []}
        pointsHistory={pointsHistory || []}
        updateProfileForm={updateProfileForm}
        subscriptionCard={subscriptionCard}
      />
    </div>
  )
}
