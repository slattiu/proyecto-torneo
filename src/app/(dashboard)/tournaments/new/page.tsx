import { getProfile } from '@/lib/actions/auth-helpers'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { redirect } from 'next/navigation'

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

export default async function NewTournamentPage() {
  const profile = await getProfile()
  if (profile?.role === 'USER') {
    redirect('/profile')
  }

  const canCreate = (profile?.role === 'ADMIN' || profile?.subscriptionStatus === 'ACTIVE') && profile?.role !== 'USER'

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors duration-150 mb-4"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Mis Torneos
        </Link>
        <h1 className="font-orbitron text-2xl font-bold text-white tracking-wide">Nuevo Torneo</h1>
        <p className="text-white/30 text-sm mt-1">Configura tu competencia desde cero</p>
      </div>

      {!canCreate ? (
        <div className="bg-dark-card border border-white/5 rounded-2xl p-10 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-neon-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">Se requiere suscripción activa</h2>
            <p className="text-white/40 text-sm mt-2 max-w-md mx-auto">
              Para crear torneos necesitas el <span className="text-neon-purple font-semibold">Plan Streamer Pro ($15/mes)</span>.
              Actívalo desde tu perfil subiendo el comprobante de pago.
            </p>
          </div>
          {profile?.subscriptionStatus === 'PENDING' ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-yellow-400 text-sm">Solicitud en revisión — te notificaremos pronto</span>
            </div>
          ) : (
            <Link
              href="/profile"
              className="inline-block px-6 py-3 bg-neon-purple text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              Activar suscripción →
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-dark-card border border-white/5 rounded-2xl p-8">
          <TournamentForm />
        </div>
      )}
    </div>
  )
}
