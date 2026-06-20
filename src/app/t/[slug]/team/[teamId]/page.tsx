export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TeamPortalClient } from './TeamPortalClient'

export default async function TeamPortalPage({
  params,
}: {
  params: Promise<{ slug: string; teamId: string }>
}) {
  const { slug, teamId } = await params
  const normalizedSlug = slug.trim().toLowerCase()
  const normalizedTeamId = teamId.trim().toLowerCase()
  const supabase = await createClient()

  // Fetch the tournament
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('id, name, status, kill_rate_enabled, pot_top_enabled, discipline, clash_royale_tag')
    .eq('slug', normalizedSlug)
    .single()

  if (tErr || !tournament) notFound()

  // Fetch the team
  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .select('*')
    .eq('id', normalizedTeamId)
    .eq('tournament_id', tournament.id)
    .single()

  if (teamErr || !team) notFound()

  // Fetch the team's participants
  const { data: participants } = await supabase
    .from('participants')
    .select('id, display_name, is_captain')
    .eq('team_id', teamId)
    .order('is_captain', { ascending: false })

  // Fetch all matches for the tournament
  const { data: matches } = await supabase
    .from('matches')
    .select('id, name, match_number, is_active, parent_match_id, round_number, map_name')
    .eq('tournament_id', tournament.id)
    .eq('is_completed', false)
    .order('match_number', { ascending: true })

  // Active check if tournament is running
  const isTournamentActive = tournament.status === 'active'
  const isAutoSynced = tournament.discipline === 'clash_royale' || !!tournament.clash_royale_tag

  return (
    <main className="min-h-screen bg-dark-bg text-white font-inter flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
           <h1 className="font-orbitron text-2xl font-bold text-neon-cyan uppercase tracking-widest">{tournament.name}</h1>
           <p className="text-white/40 uppercase tracking-widest text-xs mt-2">Portal de Equipo</p>
        </div>

        <div className="bg-dark-card border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-purple to-neon-cyan"></div>
          
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/5">
            {team.avatar_url ? (
               <img src={team.avatar_url} alt={team.name} className="w-16 h-16 rounded-xl object-cover border border-white/10" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">
                🎮
              </div>
            )}
            <div>
              <h2 className="text-2xl font-orbitron font-bold text-white">{team.name}</h2>
              <p className="text-sm text-white/50">{isAutoSynced ? 'Sincronización Automática' : 'Subida de Evidencia'}</p>
            </div>
          </div>

          {isAutoSynced ? (
            <div className="text-center py-8 px-4 space-y-4">
              <span className="text-5xl block animate-pulse">⚡</span>
              <h3 className="text-lg text-white font-orbitron font-bold uppercase tracking-wider">Marcador Sincronizado por API</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Este torneo se actualiza automáticamente a través de la API de Clash Royale.
              </p>
              <div className="p-3 bg-neon-cyan/5 border border-neon-cyan/25 rounded-xl text-xs text-neon-cyan/85 font-medium leading-relaxed">
                No necesitas subir capturas de pantalla ni reportar resultados manualmente. Juega tus partidas en el torneo dentro del juego y los resultados se reflejarán en el marcador general.
              </div>
            </div>
          ) : !isTournamentActive ? (
            <div className="text-center py-8">
              <span className="text-4xl mb-4 block">⏳</span>
              <h3 className="text-lg text-white font-medium mb-2">El torneo no está activo</h3>
              <p className="text-sm text-white/50">No puedes subir evidencia hasta que el organizador inicie el torneo.</p>
            </div>
          ) : (matches || []).length === 0 ? (
             <div className="text-center py-8">
              <h3 className="text-lg text-white font-medium mb-2">Sin partidas disponibles</h3>
              <p className="text-sm text-white/50">No hay rondas configuradas o ya finalizaron todas.</p>
            </div>
          ) : (
            <TeamPortalClient 
              tournament={tournament}
              team={team}
              participants={participants || []}
              matches={matches || []}
            />
          )}
        </div>
      </div>
    </main>
  )
}
