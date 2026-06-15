'use client'

import React, { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'

interface ProfileStatsClientProps {
  profile: any
  user: any
  participations: any[]
  badges: any[]
  rankings: any[]
  pointsHistory: any[]
  updateProfileForm: React.ReactNode
  subscriptionCard: React.ReactNode
}

const GAME_NAMES: Record<string, string> = {
  warzone: 'Call of Duty: Warzone 🪂',
  clash_royale: 'Clash Royale 👑',
  fortnite: 'Fortnite ⛏️',
  free_fire: 'Free Fire 🔥',
  call_of_duty_mobile: 'Call of Duty Mobile 🔫',
  street_fighter_6: 'Street Fighter 6 👊',
  super_smash_bros_ultimate: 'Super Smash Bros Ultimate 💥',
  league_of_legends: 'League of Legends 🏆',
  valorant: 'Valorant 🎯',
}

export function ProfileStatsClient({
  profile,
  user,
  participations,
  badges,
  rankings,
  pointsHistory,
  updateProfileForm,
  subscriptionCard,
}: ProfileStatsClientProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'history' | 'badges' | 'stats'>('profile')

  const roleLabel = {
    ADMIN: { label: 'Administrador', color: 'text-neon-cyan border-neon-cyan/30 bg-neon-cyan/10' },
    STREAMER: { label: 'Streamer', color: 'text-neon-purple border-neon-purple/30 bg-neon-purple/10' },
    USER: { label: 'Usuario', color: 'text-white/40 border-white/10 bg-white/5' },
  }[profile?.role ?? 'USER']

  const subLabel = {
    ACTIVE: { label: 'Activa', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
    PENDING: { label: 'Pendiente', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
    NONE: { label: 'Free', color: 'text-white/30 border-white/10 bg-white/5' },
    EXPIRED: { label: 'Expirada', color: 'text-red-400 border-red-500/30 bg-red-500/10' },
  }[profile?.subscriptionStatus ?? 'NONE']

  // 1. Chart Data: Ranking Evolution (Cumulative Points)
  const rankingChartData = useMemo(() => {
    let accumulatedPoints = 0
    return (pointsHistory || []).map((h, index) => {
      accumulatedPoints += Number(h.points_awarded)
      return {
        name: `T${index + 1}`,
        puntos: accumulatedPoints,
        fecha: new Date(h.created_at).toLocaleDateString('es', { month: 'short', day: 'numeric' }),
      }
    })
  }, [pointsHistory])

  // 2. Chart Data: Placement distribution
  const placementChartData = useMemo(() => {
    const distribution: Record<string, number> = {
      '1er Lugar': 0,
      '2do Lugar': 0,
      '3er Lugar': 0,
      '4to/5to': 0,
      'Otro': 0,
    }

    participations.forEach((p) => {
      const standing = p.teams?.team_standings?.[0] || p.teams?.team_standings
      const rank = standing?.rank
      if (rank === 1) distribution['1er Lugar']++
      else if (rank === 2) distribution['2do Lugar']++
      else if (rank === 3) distribution['3er Lugar']++
      else if (rank === 4 || rank === 5) distribution['4to/5to']++
      else if (rank !== undefined) distribution['Otro']++
    })

    return Object.entries(distribution).map(([key, count]) => ({
      name: key,
      cantidad: count,
    }))
  }, [participations])

  // 3. Aggregate stats by game discipline
  const disciplineStats = useMemo(() => {
    const statsMap: Record<string, {
      discipline: string
      tournamentsPlayed: number
      totalKills: number
      totalPoints: number
      bestRank: number | null
      kdRatios: number[]
      avgKillsList: number[]
      brPlacements: number[]
    }> = {}

    participations.forEach((p) => {
      const disc = p.tournaments?.discipline
      if (!disc) return

      if (!statsMap[disc]) {
        statsMap[disc] = {
          discipline: disc,
          tournamentsPlayed: 0,
          totalKills: 0,
          totalPoints: 0,
          bestRank: null,
          kdRatios: [],
          avgKillsList: [],
          brPlacements: []
        }
      }

      const ds = statsMap[disc]
      ds.tournamentsPlayed++

      if (p.total_kills !== undefined && p.total_kills !== null) {
        ds.totalKills += Number(p.total_kills)
      }

      if (p.kd_ratio !== undefined && p.kd_ratio !== null && Number(p.kd_ratio) > 0) {
        ds.kdRatios.push(Number(p.kd_ratio))
      }

      if (p.avg_kills !== undefined && p.avg_kills !== null && Number(p.avg_kills) > 0) {
        ds.avgKillsList.push(Number(p.avg_kills))
      }

      if (p.br_avg_placement !== undefined && p.br_avg_placement !== null && Number(p.br_avg_placement) > 0) {
        ds.brPlacements.push(Number(p.br_avg_placement))
      }

      const standing = p.teams?.team_standings?.[0] || p.teams?.team_standings
      if (standing) {
        if (standing.total_points !== undefined && standing.total_points !== null) {
          ds.totalPoints += Number(standing.total_points)
        }
        const r = Number(standing.rank)
        if (r > 0) {
          if (ds.bestRank === null || r < ds.bestRank) {
            ds.bestRank = r
          }
        }
      }
    })

    return Object.values(statsMap).map((ds) => {
      const avgKd = ds.kdRatios.length > 0
        ? ds.kdRatios.reduce((a, b) => a + b, 0) / ds.kdRatios.length
        : null

      const avgKills = ds.avgKillsList.length > 0
        ? ds.avgKillsList.reduce((a, b) => a + b, 0) / ds.avgKillsList.length
        : ds.tournamentsPlayed > 0
          ? ds.totalKills / ds.tournamentsPlayed
          : 0

      const avgBrPlacement = ds.brPlacements.length > 0
        ? ds.brPlacements.reduce((a, b) => a + b, 0) / ds.brPlacements.length
        : null

      return {
        discipline: ds.discipline,
        tournamentsPlayed: ds.tournamentsPlayed,
        totalKills: ds.totalKills,
        totalPoints: ds.totalPoints,
        bestRank: ds.bestRank,
        avgKd,
        avgKills,
        avgBrPlacement
      }
    })
  }, [participations])

  return (
    <div className="space-y-6">
      {/* Account Info Card */}
      <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6 space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/20 flex items-center justify-center shrink-0">
            <span className="text-neon-cyan text-2xl font-black font-orbitron">
              {(profile?.username?.[0] || user.email?.[0] || '?').toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-lg font-bold font-orbitron truncate">
              {profile?.username || 'Usuario Sin Nickname'}
            </p>
            <p className="text-white/40 text-xs mt-0.5">{user.email}</p>
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <span className={`text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full border ${roleLabel.color}`}>
                {roleLabel.label}
              </span>
              <span className={`text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full border ${subLabel.color}`}>
                Membresía: {subLabel.label}
              </span>
            </div>
          </div>
        </div>

        {/* Platform points summary */}
        {rankings && rankings.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-white/5">
            {rankings.map((r) => (
              <div key={r.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5">
                <p className="text-white/40 text-[9px] uppercase font-black tracking-widest truncate">
                  {GAME_NAMES[r.discipline] || r.discipline}
                </p>
                <p className="text-xl font-bold font-orbitron text-neon-cyan mt-1">
                  {Number(r.points).toFixed(1)} <span className="text-xs text-white/50">pts</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-3 text-xs uppercase font-bold tracking-widest transition-colors border-b-2 ${
            activeTab === 'profile'
              ? 'text-neon-cyan border-neon-cyan font-black'
              : 'text-white/40 border-transparent hover:text-white/60'
          }`}
        >
          Ajustes
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 text-xs uppercase font-bold tracking-widest transition-colors border-b-2 ${
            activeTab === 'history'
              ? 'text-neon-cyan border-neon-cyan font-black'
              : 'text-white/40 border-transparent hover:text-white/60'
          }`}
        >
          Mis Torneos ({participations.length})
        </button>
        <button
          onClick={() => setActiveTab('badges')}
          className={`flex-1 py-3 text-xs uppercase font-bold tracking-widest transition-colors border-b-2 ${
            activeTab === 'badges'
              ? 'text-neon-cyan border-neon-cyan font-black'
              : 'text-white/40 border-transparent hover:text-white/60'
          }`}
        >
          Medallero ({badges.length})
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 py-3 text-xs uppercase font-bold tracking-widest transition-colors border-b-2 ${
            activeTab === 'stats'
              ? 'text-neon-cyan border-neon-cyan font-black'
              : 'text-white/40 border-transparent hover:text-white/60'
          }`}
        >
          Desempeño
        </button>
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        {activeTab === 'profile' && (
          <>
            {updateProfileForm}
            {subscriptionCard}
          </>
        )}

        {activeTab === 'history' && (
          <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6 overflow-hidden">
            <h3 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider mb-4">
              Historial de Torneos
            </h3>

            {participations.length === 0 ? (
              <div className="text-center py-10 text-white/30 text-sm">
                Aún no has participado en ningún torneo. ¡Inscríbete en uno para comenzar!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-white/40 text-[10px] uppercase font-black tracking-widest border-b border-white/5">
                      <th className="pb-3">Torneo</th>
                      <th className="pb-3">Juego</th>
                      <th className="pb-3">Equipo</th>
                      <th className="pb-3 text-right">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {participations.map((p) => {
                      const standing = p.teams?.team_standings?.[0] || p.teams?.team_standings
                      const rank = standing?.rank
                      return (
                        <tr key={p.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="py-3.5 font-bold text-white">
                            <a href={`/t/${p.tournaments?.slug}`} className="hover:text-neon-cyan transition-colors">
                              {p.tournaments?.name}
                            </a>
                          </td>
                          <td className="py-3.5 text-white/50 text-xs">
                            {GAME_NAMES[p.tournaments?.discipline] || p.tournaments?.discipline}
                          </td>
                          <td className="py-3.5 text-white/70 font-semibold">{p.teams?.name}</td>
                          <td className="py-3.5 text-right font-orbitron font-black">
                            {rank ? (
                              <span className={rank === 1 ? 'text-gold' : rank === 2 ? 'text-white/90' : rank === 3 ? 'text-orange-400' : 'text-white/40'}>
                                #{rank} {rank === 1 ? '🏆' : ''}
                              </span>
                            ) : (
                              <span className="text-white/20">En juego</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'badges' && (
          <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6">
            <h3 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider mb-6">
              Medallas Obtenidas
            </h3>

            {badges.length === 0 ? (
              <div className="text-center py-10 text-white/30 text-sm">
                Las medallas e insignias se desbloquean al quedar en el Podio (Top 3) de los torneos finalizados.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {badges.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-col items-center text-center p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group"
                  >
                    <div className="relative w-16 h-16 mb-3 flex items-center justify-center">
                      <div className="absolute inset-0 bg-neon-cyan/5 rounded-full blur-md group-hover:bg-neon-cyan/15 transition-colors" />
                      <img
                        src={b.badge_url}
                        alt={b.name}
                        className="w-14 h-14 object-contain relative z-10 drop-shadow-[0_0_10px_rgba(0,245,255,0.2)]"
                      />
                    </div>
                    <p className="text-white text-xs font-bold font-orbitron truncate max-w-full">{b.name}</p>
                    <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold mt-1">
                      Desbloqueado: {new Date(b.awarded_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6">
            {/* Resumen de Promedios por Juego */}
            <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6 space-y-4">
              <h3 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider">
                Desempeño Promedio por Juego
              </h3>
              {disciplineStats.length === 0 ? (
                <div className="text-center py-10 text-white/30 text-sm">
                  Participa en torneos para ver tus promedios por juego aquí.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {disciplineStats.map((ds) => {
                    const isShooter = ['warzone', 'fortnite', 'free_fire', 'call_of_duty_mobile'].includes(ds.discipline)
                    return (
                      <div
                        key={ds.discipline}
                        className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4 hover:border-white/10 transition-colors animate-fade-in"
                      >
                        <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                          <span className="font-orbitron font-black text-sm text-neon-cyan uppercase tracking-wider">
                            {GAME_NAMES[ds.discipline] || ds.discipline}
                          </span>
                          <span className="text-[10px] bg-white/5 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider text-white/50">
                            {ds.tournamentsPlayed} {ds.tournamentsPlayed === 1 ? 'Torneo' : 'Torneos'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <span className="text-[9px] text-white/40 uppercase tracking-wider block font-bold">Mejor Puesto</span>
                            <span className="text-white font-orbitron font-bold text-base">
                              {ds.bestRank ? `#${ds.bestRank}` : '—'}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] text-white/40 uppercase tracking-wider block font-bold">Puntos Totales</span>
                            <span className="text-white font-orbitron font-bold text-base">
                              {ds.totalPoints.toFixed(1)}
                            </span>
                          </div>

                          {isShooter ? (
                            <>
                              <div className="space-y-1">
                                <span className="text-[9px] text-white/40 uppercase tracking-wider block font-bold">Promedio K/D</span>
                                <span className="text-neon-purple font-orbitron font-bold text-base">
                                  {ds.avgKd !== null ? ds.avgKd.toFixed(2) : '—'}
                                </span>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[9px] text-white/40 uppercase tracking-wider block font-bold">Kills Promedio</span>
                                <span className="text-white font-orbitron font-bold text-base">
                                  {ds.avgKills.toFixed(1)}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="col-span-2 space-y-1">
                              <span className="text-[9px] text-white/40 uppercase tracking-wider block font-bold">Asesinatos (Kills) Totales</span>
                              <span className="text-white font-orbitron font-bold text-base">
                                {ds.totalKills}
                              </span>
                            </div>
                          )}

                          {ds.avgBrPlacement !== null && (
                            <div className="col-span-2 space-y-1 border-t border-white/5 pt-2">
                              <span className="text-[9px] text-white/40 uppercase tracking-wider block font-bold">Puesto Promedio (BR)</span>
                              <span className="text-yellow-500 font-orbitron font-bold text-base">
                                #{ds.avgBrPlacement.toFixed(1)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Evolution chart */}
            <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6">
              <h3 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider mb-4">
                Progreso del Ranking (Puntos Totales)
              </h3>
              {rankingChartData.length < 2 ? (
                <div className="text-center py-10 text-white/30 text-sm">
                  Necesitas participar y puntuar en al menos 2 torneos para graficar tu evolución.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rankingChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                      <XAxis dataKey="name" stroke="#ffffff30" style={{ fontSize: '10px' }} />
                      <YAxis stroke="#ffffff30" style={{ fontSize: '10px' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0d0d0f', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}
                        labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase' }}
                      />
                      <Line type="monotone" dataKey="puntos" stroke="#00F5FF" strokeWidth={3} dot={{ fill: '#00F5FF', r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Placement Chart */}
            <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-6">
              <h3 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider mb-4">
                Distribución de Posiciones Obtenidas
              </h3>
              {participations.filter((p) => p.teams?.team_standings?.[0]?.rank || p.teams?.team_standings?.rank).length === 0 ? (
                <div className="text-center py-10 text-white/30 text-sm">
                  Aún no tienes posiciones registradas para graficar.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={placementChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                      <XAxis dataKey="name" stroke="#ffffff30" style={{ fontSize: '10px' }} />
                      <YAxis stroke="#ffffff30" style={{ fontSize: '10px' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0d0d0f', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}
                      />
                      <Bar dataKey="cantidad" fill="#a855f7" radius={[6, 6, 0, 0]}>
                        {placementChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index === 0 ? '#E2C222' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#a855f7'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
