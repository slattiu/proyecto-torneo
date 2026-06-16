import { getTournament, activateTournament } from '@/lib/actions/tournaments'
import { exportTournamentDataCsv } from '@/lib/actions/export'
import { DeleteTournamentButton } from './DeleteTournamentButton'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Tournament } from '@/types'

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Tournament['status'] }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
        bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">
        <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
        Activo
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
        bg-neon-purple/10 text-neon-purple border border-neon-purple/20">
        <span className="w-1.5 h-1.5 rounded-full bg-neon-purple animate-pulse" />
        Anunciado
      </span>
    )
  }
  if (status === 'finished') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
        bg-gold/10 text-gold border border-gold/20">
        Finalizado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
      bg-white/5 text-white/40 border border-white/10">
      Borrador
    </span>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'cyan' | 'purple' | 'gold'
}) {
  const accentClass = {
    cyan: 'text-neon-cyan',
    purple: 'text-neon-purple',
    gold: 'text-gold',
    undefined: 'text-white',
  }[accent ?? 'undefined']

  return (
    <div className="bg-dark-card border border-white/5 rounded-2xl p-5">
      <p className="text-xs text-white/30 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold font-orbitron ${accentClass}`}>{value}</p>
      {sub && <p className="text-xs text-white/25 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Quick action link ────────────────────────────────────────────────────────

function QuickAction({
  href,
  icon,
  label,
  desc,
}: {
  href: string
  icon: React.ReactNode
  label: string
  desc: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 px-5 py-4 rounded-xl bg-white/[0.03] border border-white/5
        hover:border-neon-purple/30 hover:bg-white/[0.05] transition-all duration-150 group"
    >
      <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center
        group-hover:border-neon-purple/30 transition-colors duration-150 shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors duration-150">
          {label}
        </p>
        <p className="text-xs text-white/30">{desc}</p>
      </div>
      <svg className="w-4 h-4 text-white/20 ml-auto group-hover:text-white/40 transition-colors duration-150"
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

// ─── Activate button (Client Component) ─────────────────────────────────────────
import { ActivateTournamentButton } from './ActivateTournamentButton'
import { FinishTournamentButton } from './FinishTournamentButton'
import { PublishTournamentButton } from './PublishTournamentButton'
import { TournamentBranding } from './TournamentBranding'
import { VisibilityToggle } from './VisibilityToggle'


// ─── Export & Reports Component (Client Wrap) ──────────────────────────────────

import { ExportButton } from './ExportButton'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TournamentOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getTournament(id)

  if ('error' in result) notFound()

  const { scoringRule, ...tournament } = result.data

  const FORMAT_LABELS: Record<Tournament['format'], string> = {
    battle_royale_clasico: 'Battle Royale Clásico',
    kill_race: 'Kill Race',
    custom_rooms: 'Custom Rooms',
    eliminacion_directa: 'Eliminación Directa',
    fase_de_grupos: 'Fase de Grupos',
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <Link
        href="/tournaments"
        className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60
          transition-colors duration-150 mb-6"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Mis Torneos
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <StatusBadge status={tournament.status} />
            <VisibilityToggle id={tournament.id} isPrivate={tournament.isPrivate || false} />
            <span className="text-xs text-white/30 border border-white/10 px-2.5 py-1 rounded-full">
              {FORMAT_LABELS[tournament.format]}
            </span>
          </div>

          <h1 className="font-orbitron text-2xl font-bold text-white tracking-wide">
            {tournament.name}
          </h1>
          {tournament.description && (
            <p className="text-white/40 text-sm mt-2 max-w-xl">{tournament.description}</p>
          )}
        </div>

        {/* Public link */}
        <Link
          href={`/t/${tournament.slug}`}
          target="_blank"
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium
            text-white/50 border border-white/10 hover:border-neon-cyan/30 hover:text-neon-cyan
            transition-all duration-150"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Ver público
        </Link>
      </div>

      {/* Corporate Branding */}
      <TournamentBranding 
        id={id} 
        initialLogoUrl={tournament.logoUrl} 
        tournamentName={tournament.name} 
        initialHideLogoInLeaderboard={tournament.hideLogoInLeaderboard}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Partidas"
          value={`${tournament.matchesCompleted}/${tournament.totalMatches}`}
          sub="completadas / total"
          accent="cyan"
        />
        <StatCard
          label="Nivel"
          value={tournament.level === 'profesional' ? 'Pro' : 'Casual'}
          sub={tournament.level === 'profesional' ? '6–12 partidas' : 'Hasta 3 partidas'}
          accent="purple"
        />
        <StatCard
          label="Modalidad"
          value={tournament.mode.charAt(0).toUpperCase() + tournament.mode.slice(1)}
          sub={['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate'].includes(tournament.discipline) ? '1v1' : 'por equipo'}
        />
        {scoringRule && !['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate', 'league_of_legends', 'valorant'].includes(tournament.discipline) && (
          <StatCard
            label="Kill Points"
            value={scoringRule.killPoints}
            sub="puntos por kill"
            accent="gold"
          />
        )}
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">
          Gestión
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(tournament.status === 'draft' || tournament.status === 'pending') && (
            <QuickAction
              href={`/tournaments/${id}/edit`}
              label="Editar Ajustes"
              desc="Cambia modalidad, puntos, reglas y más"
              icon={
                <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              }
            />
          )}
          <QuickAction
            href={`/tournaments/${id}/participants`}
            label="Participantes"
            desc="Gestiona equipos y jugadores"
            icon={
              <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
          {!['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate', 'league_of_legends', 'valorant'].includes(tournament.discipline) && (
            <QuickAction
              href={`/tournaments/${id}/submissions`}
              label="Submissions"
              desc="Revisa y aprueba registros de kills"
              icon={
                <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          )}
          <QuickAction
            href={`/tournaments/${id}/customize`}
            label="Personalizar"
            desc="Tema visual del leaderboard público"
            icon={
              <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            }
          />
          <QuickAction
            href={`/tournaments/${id}/matches`}
            label="Partidas"
            desc="Nombres de rondas y mapas"
            icon={
              <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            }
          />
          <QuickAction
            href={`/t/${tournament.slug}`}
            label="Ver leaderboard público"
            desc={`/t/${tournament.slug}`}
            icon={
              <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            }
          />
          <QuickAction
            href={`/tournaments/${id}/codes`}
            label="Códigos de Streamer"
            desc="Genera y gestiona códigos para ArenaCrypto"
            icon={
              <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            }
          />
        </div>
      </div>

      {/* Export & Reports */}
      <div className="mb-8 p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
        <h2 className="text-sm font-orbitron font-black text-white uppercase tracking-tighter mb-4">
          Reportes y Exportación
        </h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <ExportButton id={id} tournamentName={tournament.name} />
          <div className="flex-1 text-xs text-white/30 flex items-center">
            Genera un reporte oficial en formato CSV con los resultados finales, kills por equipo y estadísticas individuales (MVP).
          </div>
        </div>
      </div>

      {/* Active action (Finish) */}
      {tournament.status === 'active' && (
        <div className="bg-dark-card border border-gold/10 rounded-2xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-white mb-1">Finalizar Torneo</h2>
          <p className="text-xs text-white/30 mb-4">
            Al finalizar el torneo, se calculará el podio definitivo y se enviará a la Galería de Campeones.
          </p>
          <FinishTournamentButton id={id} />
        </div>
      )}

      {/* Publish button (draft → pending) */}
      {tournament.status === 'draft' && (
        <div className="bg-dark-card border border-neon-purple/10 rounded-2xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-white mb-1">Anunciar torneo</h2>
          <p className="text-xs text-white/30 mb-4">
            Publica el torneo para que ArenaCrypto abra las apuestas de campeón y MVP antes de que arranque.
            Podrás seguir editando participantes hasta activarlo.
          </p>
          <PublishTournamentButton id={id} />
        </div>
      )}

      {/* Activate button (draft or pending → active) */}
      {(tournament.status === 'draft' || tournament.status === 'pending') && (
        <div className="bg-dark-card border border-neon-cyan/10 rounded-2xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-white mb-1">¿Listo para comenzar?</h2>
          <p className="text-xs text-white/30 mb-4">
            Activar el torneo bloqueará la configuración. Asegúrate de haber agregado participantes y definido las reglas.
          </p>
          <ActivateTournamentButton id={id} />
        </div>
      )}

      {/* ── Danger Zone ──────────────────────────────────────────────── */}
      <div className="border border-red-500/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-red-400/80 mb-1">Zona de peligro</h2>
        <p className="text-xs text-white/30 mb-4">
          Eliminar este torneo borrará permanentemente todos sus equipos, partidas, estadísticas y puntuaciones.
          Esta acción no se puede deshacer.
        </p>
        <DeleteTournamentButton id={id} name={tournament.name} />
      </div>
    </div>
  )
}
