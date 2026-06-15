import Link from 'next/link'
import { getTournaments } from '@/lib/actions/tournaments'
import { TournamentCard } from './TournamentCard'
import { getProfile } from '@/lib/actions/auth-helpers'
import { redirect } from 'next/navigation'

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="col-span-full bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-neon-purple/10 border border-neon-purple/20
        flex items-center justify-center mx-auto mb-5">
        <svg className="w-7 h-7 text-neon-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      </div>
      <p className="text-white/60 text-sm font-medium mb-1">Sin torneos todavía</p>
      <p className="text-white/25 text-xs mb-6">Crea tu primer torneo y empieza a competir</p>
      <Link
        href="/tournaments/new"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
          bg-gradient-to-r from-neon-cyan to-neon-purple hover:opacity-90 active:scale-[0.97]
          transition-all duration-150"
      >
        + Crear torneo
      </Link>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TournamentsPage() {
  const profile = await getProfile()
  if (profile?.role === 'USER') {
    redirect('/profile')
  }

  const result = await getTournaments()
  const tournaments = 'data' in result ? result.data : []

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <h1 className="font-orbitron text-xl sm:text-2xl font-bold text-white tracking-wide">
            Mis Torneos
          </h1>
          <p className="text-white/30 text-xs sm:text-sm mt-1">
            {tournaments.length > 0
              ? `${tournaments.length} torneo${tournaments.length !== 1 ? 's' : ''}`
              : 'Gestiona tus competencias'}
          </p>
        </div>
        <Link
          href="/tournaments/new"
          className="shrink-0 inline-flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white
            bg-gradient-to-r from-neon-cyan to-neon-purple hover:opacity-90 active:scale-[0.97]
            transition-all duration-150 shadow-lg shadow-neon-cyan/10"
        >
          + <span className="hidden sm:inline">Nuevo </span>Torneo
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tournaments.length === 0 ? (
          <EmptyState />
        ) : (
          tournaments.map((t) => <TournamentCard key={t.id} tournament={t} />)
        )}
      </div>
    </div>
  )
}
