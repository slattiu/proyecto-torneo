import { getTournament } from '@/lib/actions/tournaments'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const TournamentForm = dynamic(
  () => import('@/components/dashboard/TournamentForm').then((mod) => mod.TournamentForm),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse space-y-8 py-4">
        <div className="space-y-3">
          <div className="h-4 bg-white/10 rounded w-1/4"></div>
          <div className="h-10 bg-white/5 rounded-lg"></div>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-white/10 rounded w-1/3"></div>
          <div className="h-24 bg-white/5 rounded-lg"></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-10 bg-white/5 rounded-lg"></div>
          <div className="h-10 bg-white/5 rounded-lg"></div>
        </div>
      </div>
    )
  }
)

interface EditTournamentPageProps {
  params: Promise<{ id: string }>
}

export default async function EditTournamentPage({ params }: EditTournamentPageProps) {
  const { id } = await params
  const result = await getTournament(id)

  if ('error' in result) {
    notFound()
  }

  const tournament = result.data

  if (tournament.status !== 'draft' && tournament.status !== 'pending') {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <Link
            href={`/tournaments/${id}`}
            className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors duration-150 mb-4"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver al torneo
          </Link>
          <h1 className="font-orbitron text-2xl font-bold text-white tracking-wide">Editar Torneo</h1>
        </div>

        <div className="bg-dark-card border border-red-500/10 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto text-red-500 font-bold text-xl">
            ⚠️
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">No se puede editar este torneo</h2>
            <p className="text-white/40 text-sm mt-2 max-w-md mx-auto">
              Solo se permiten modificaciones mientras el torneo se encuentre en estado de{' '}
              <span className="text-neon-purple font-semibold">Borrador</span> o{' '}
              <span className="text-neon-purple font-semibold">Anunciado</span>.
              Este torneo actualmente está {tournament.status === 'active' ? 'activo' : 'finalizado'}.
              {tournament.status === 'finished' && (
                <> Puedes <Link href={`/tournaments/${id}`} className="text-neon-cyan hover:underline">reactivarlo desde el resumen</Link> si necesitas reabrirlo.</>
              )}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <Link
          href={`/tournaments/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors duration-150 mb-4"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver al torneo
        </Link>
        <h1 className="font-orbitron text-2xl font-bold text-white tracking-wide">Editar Ajustes</h1>
        <p className="text-white/30 text-sm mt-1">Actualiza las reglas, modalidad o finanzas del torneo</p>
      </div>

      <div className="bg-dark-card border border-white/5 rounded-2xl p-8">
        <TournamentForm initialData={tournament} tournamentId={id} />
      </div>
    </div>
  )
}
