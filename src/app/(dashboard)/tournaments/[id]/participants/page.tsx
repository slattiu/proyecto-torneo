import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTournament } from '@/lib/actions/tournaments'
import { getTeamsWithParticipants } from '@/lib/actions/participants'
import { ParticipantsManager } from './ParticipantsManager'

export default async function ParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  
  const [tournamentResult, participantsResult] = await Promise.all([
    getTournament(id),
    getTeamsWithParticipants(id)
  ])

  if ('error' in tournamentResult) notFound()
  if ('error' in participantsResult) {
    return <div className="p-8 max-w-4xl mx-auto text-red-500">Error: {participantsResult.error}</div>
  }

  const { data: tournament } = tournamentResult
  const { teams, participants } = participantsResult

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-white/30 mb-8">
        <Link href="/tournaments" className="hover:text-white/60 transition-colors">
          Mis Torneos
        </Link>
        <span>/</span>
        <Link href={`/tournaments/${id}`} className="hover:text-white/60 transition-colors truncate max-w-[200px]">
          {tournament.name}
        </Link>
        <span>/</span>
        <span className="text-white/50">Participantes</span>
      </div>

      <div className="mb-8">
        <h1 className="font-orbitron text-2xl font-bold text-white tracking-wide mb-2">
          Gestión de Participantes
        </h1>
        <p className="text-sm text-white/40">
          Modalidad del torneo: <span className="text-white/70 font-medium capitalize">{tournament.mode}</span>
        </p>
      </div>

      <ParticipantsManager 
        tournamentId={id}
        tournamentSlug={tournament.slug}
        tournamentMode={tournament.mode} 
        tournamentDiscipline={tournament.discipline}
        tournamentStatus={tournament.status}
        initialTeams={teams} 
        initialParticipants={participants} 
      />
    </div>
  )
}
