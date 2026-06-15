import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Orbitron } from 'next/font/google'
import Link from 'next/link'
import { getProfile } from '@/lib/actions/auth-helpers'
import { Navbar } from '@/components/navigation/Navbar'
import { HomeTracker } from '@/components/analytics/HomeTracker'
import { getOptimizedImageUrl } from '@/lib/utils'
import { PublicCountdown } from '@/components/tournaments/PublicCountdown'

const orbitron = Orbitron({ subsets: ['latin'] })

export const dynamic = 'force-dynamic'
export const revalidate = 0

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">
        <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
        En Curso
      </span>
    )
  }
  if (status === 'finished') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-gold/10 text-gold border border-gold/20">
        Finalizado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-neon-purple/10 text-neon-purple border border-neon-purple/20">
      <span className="w-1.5 h-1.5 rounded-full bg-neon-purple animate-pulse" />
      Inscripciones Abiertas
    </span>
  )
}

const DISCIPLINE_LABELS: Record<string, string> = {
  warzone: 'CoD: Warzone 🪂',
  clash_royale: 'Clash Royale 👑',
  fortnite: 'Fortnite ⛏️',
  free_fire: 'Free Fire 🔥',
  call_of_duty_mobile: 'CoD Mobile 🔫',
  street_fighter_6: 'Street Fighter 6 👊',
  super_smash_bros_ultimate: 'Super Smash Bros Ultimate 💥',
  league_of_legends: 'League of Legends 🏆',
  valorant: 'Valorant 🎯',
}

export default async function TorneosPublicosPage() {
  const supabase = await createClient()
  const adminSupabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user ? await getProfile() : null

  // Fetch all public tournaments (is_private = false or null) and not finished
  const { data: tournaments, error } = await adminSupabase
    .from('tournaments')
    .select('*, teams(id)')
    .or('is_private.eq.false,is_private.is.null')
    .neq('status', 'finished')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white selection:bg-neon-cyan/30 pb-24 relative overflow-hidden">
      <HomeTracker path="/torneos" />
      <Navbar user={user} profile={profile} />

      {/* Decorative gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[-10%] w-[40%] h-[40%] bg-neon-cyan/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] bg-neon-purple/5 blur-[120px] rounded-full" />
      </div>

      <main className="max-w-7xl mx-auto px-6 sm:px-8 pt-32 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-neon-cyan">Arena de Competición</span>
            <h1 className={`${orbitron.className} text-3xl sm:text-5xl font-black uppercase tracking-tighter text-white mt-2`}>
              Torneos Públicos
            </h1>
            <p className="text-white/40 text-xs sm:text-sm max-w-xl mt-1.5 leading-relaxed">
              Inscríbete en los torneos abiertos de la comunidad y compite contra los mejores streamers y jugadores.
            </p>
          </div>
        </div>

        {error || !tournaments || tournaments.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-white/5 rounded-3xl bg-white/[0.01] max-w-xl mx-auto">
            <div className="text-5xl mb-4">🏆</div>
            <h2 className="font-orbitron font-bold text-lg text-white/60 uppercase tracking-wide">No hay torneos disponibles</h2>
            <p className="text-white/30 text-xs mt-2">
              Pronto se publicarán nuevos torneos públicos aquí. ¡Mantente atento!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((t) => {
              const totalPrize = Number(t.prize_1st || 0) + Number(t.prize_2nd || 0) + Number(t.prize_3rd || 0) + Number(t.prize_mvp || 0)
              const hasLogo = !!t.logo_url
              const now = new Date()
              const regStart = t.registration_start_date ? new Date(t.registration_start_date) : null
              const regEnd = t.registration_end_date ? new Date(t.registration_end_date) : null
              const hasRegStarted = regStart ? now >= regStart : true
              const hasRegEnded = regEnd ? now > regEnd : false
              const isOpen = hasRegStarted && !hasRegEnded
              const totalTeamsRegistered = t.teams?.length || 0
              const maxTeams = t.max_teams
              const spotsLeft = maxTeams ? Math.max(0, maxTeams - totalTeamsRegistered) : null

              return (
                <div key={t.id} className="group relative rounded-2xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all p-5 flex flex-col justify-between overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />
                  
                  <div className="relative z-10">
                    {/* Upper row: Status & Mode */}
                    <div className="flex items-center justify-between mb-4">
                      <StatusBadge status={t.status} />
                      <span className="text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/60 font-bold uppercase tracking-wider">
                        {t.mode ? t.mode.toUpperCase() : 'TODOS'}
                      </span>
                    </div>

                    {/* Logo and title */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
                        {hasLogo ? (
                          <img src={getOptimizedImageUrl(t.logo_url, 120, 120)} alt={t.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl">🏆</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-orbitron font-bold text-sm text-white group-hover:text-neon-cyan transition-colors line-clamp-1">
                          {t.name}
                        </h3>
                        <p className="text-neon-cyan text-[10px] font-bold tracking-wider mt-1 uppercase">
                          {t.discipline ? (DISCIPLINE_LABELS[t.discipline] || t.discipline.replace(/_/g, ' ')) : 'Juego General'}
                        </p>
                        <p className="text-white/40 text-[9px] uppercase tracking-wide mt-0.5">
                          Formato: {t.format ? t.format.replace(/_/g, ' ') : 'Estándar'}
                        </p>
                      </div>
                    </div>

                    {/* Dates & Capacity */}
                    <div className="space-y-1.5 text-[10px] text-white/40 border-t border-white/5 pt-3 mb-4">
                      {t.registration_start_date && (
                        <div className="flex justify-between">
                          <span>Inscripción:</span>
                          <span className="text-white/60">
                            {new Date(t.registration_start_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      )}
                      {t.start_date && (
                        <div className="flex justify-between">
                          <span>Inicio Torneo:</span>
                          <span className="text-white/60">
                            {new Date(t.start_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      )}
                      {maxTeams !== undefined && maxTeams !== null && maxTeams > 0 ? (
                        <div className="flex justify-between border-t border-white/5 pt-1.5 mt-1.5">
                          <span>Cupos Libres:</span>
                          <span className={spotsLeft === 0 ? "text-red-400 font-bold" : "text-neon-cyan font-bold"}>
                            {spotsLeft === 0 ? 'Agotado' : `${spotsLeft} / ${maxTeams}`}
                          </span>
                        </div>
                      ) : (
                        <div className="flex justify-between border-t border-white/5 pt-1.5 mt-1.5">
                          <span>Equipos Inscritos:</span>
                          <span className="text-white/60">
                            {totalTeamsRegistered}
                          </span>
                        </div>
                      )}

                      <PublicCountdown 
                        registrationStartDate={t.registration_start_date}
                        registrationEndDate={t.registration_end_date}
                        startDate={t.start_date}
                        endDate={t.end_date}
                        status={t.status}
                      />
                    </div>
                  </div>

                  {/* Prize pool & CTA */}
                  <div className="relative z-10 pt-3 border-t border-white/5 flex items-center justify-between mt-auto">
                    <div>
                      <span className="text-[9px] text-white/30 uppercase block">Premio Total</span>
                      <span className="text-gold font-orbitron font-black text-sm">
                        {totalPrize > 0 ? `$${totalPrize.toLocaleString()}` : 'Medallas'}
                      </span>
                    </div>

                    <Link 
                      href={`/t/${t.slug}`} 
                      className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-wider text-white hover:bg-neon-cyan hover:text-black hover:border-neon-cyan transition-all"
                    >
                      Ver Torneo
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
