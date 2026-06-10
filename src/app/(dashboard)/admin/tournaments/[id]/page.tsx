import { createClient } from '@/lib/supabase/server'
import { Orbitron } from 'next/font/google'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { StreamerCodeManager } from './StreamerCodeManager'
import { SanctionToggle } from './SanctionToggle'

const orbitron = Orbitron({ subsets: ['latin'] })

export default async function AdminTournamentDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Fetch Tournament with counts
  const { data: tournament } = await supabase
    .from('tournaments')
    .select(`
      *,
      creator:profiles!creator_id(username),
      teams(id, name, participants(id, display_name))
    `)
    .eq('id', id)
    .single()

  if (!tournament) notFound()

  // 2. Fetch Existing Codes
  const { data: codes } = await supabase
    .from('streamer_codes')
    .select('*')
    .eq('tournament_id', id)

  const totalParticipants = tournament.teams.reduce((acc: number, team: any) => acc + team.participants.length, 0)

  return (
    <div className="space-y-12">
      <Link 
        href="/admin/tournaments" 
        className="inline-flex items-center gap-2 text-white/40 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Lista de Torneos
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start gap-8">
        <header className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-0.5 bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 rounded text-[10px] font-black uppercase tracking-widest">
              Admin Mode
            </span>
            <span className="text-white/20 font-mono text-xs uppercase">{tournament.slug}</span>
          </div>
          <h1 className={`${orbitron.className} text-5xl font-black uppercase tracking-tighter text-white leading-none mb-4`}>
            {tournament.name}
          </h1>
          <div className="flex items-center gap-6 text-white/40 text-sm font-bold uppercase tracking-widest">
            <span>Organizador: <span className="text-white">{tournament.creator?.username || 'N/A'}</span></span>
            <span>Equipos: <span className="text-white">{tournament.teams.length}</span></span>
            <span>Jugadores: <span className="text-white">{totalParticipants}</span></span>
          </div>
        </header>

        <div className="w-full md:w-auto flex flex-wrap items-center gap-4">
             <SanctionToggle tournamentId={id} initialSanctioned={tournament.is_sanctioned} />
             <Link 
                href={`/t/${tournament.slug}`} 
                target="_blank"
                className="bg-white/5 hover:bg-white/10 px-6 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Ver Leaderboard Público
              </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Participants Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#121219] border border-white/5 rounded-2xl overflow-hidden">
             <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                <h3 className="text-xs font-black uppercase tracking-widest">Roster de Participantes</h3>
             </div>
             <table className="w-full text-left">
               <thead>
                 <tr className="border-b border-white/5 text-[9px] uppercase font-bold text-white/20 tracking-tighter">
                   <th className="px-6 py-3">Equipo</th>
                   <th className="px-6 py-3">Jugador / Streamer</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                 {tournament.teams.map((team: any) => (
                    <tr key={team.id} className="text-sm">
                       <td className="px-6 py-4 font-bold text-white/60">{team.name}</td>
                       <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {team.participants.map((p: any) => (
                               <span key={p.id} className="px-2 py-1 bg-white/5 rounded text-[11px] text-white/80">
                                 {p.display_name}
                               </span>
                            ))}
                          </div>
                       </td>
                    </tr>
                 ))}
               </tbody>
             </table>
          </div>
        </div>

        {/* Streamer Codes Management */}
        <div className="space-y-6">
           <StreamerCodeManager tournamentId={id} existingCodes={codes || []} />
        </div>
      </div>
    </div>
  )
}
