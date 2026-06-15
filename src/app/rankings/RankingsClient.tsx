'use client'

import React, { useState, useEffect, useMemo, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Orbitron } from 'next/font/google'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import { getPlayerDetails } from '@/lib/actions/profile'

const orbitron = Orbitron({ subsets: ['latin'] })

interface RankingsClientProps {
  communityRankings: any[]
  nationalRankings: any[]
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

const DISCIPLINES = [
  { value: 'warzone', label: 'Warzone' },
  { value: 'clash_royale', label: 'Clash Royale' },
  { value: 'fortnite', label: 'Fortnite' },
  { value: 'free_fire', label: 'Free Fire' },
  { value: 'call_of_duty_mobile', label: 'COD Mobile' },
  { value: 'street_fighter_6', label: 'SF6' },
  { value: 'super_smash_bros_ultimate', label: 'Smash Bros' },
  { value: 'league_of_legends', label: 'League of Legends' },
  { value: 'valorant', label: 'Valorant' },
]

export function RankingsClient({ communityRankings, nationalRankings }: RankingsClientProps) {
  const [rankingType, setRankingType] = useState<'community' | 'national'>('community')
  const [selectedDiscipline, setSelectedDiscipline] = useState('clash_royale')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null)
  const [playerDetails, setPlayerDetails] = useState<any | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Enforce correct selected discipline when switching ranking type
  useEffect(() => {
    if (rankingType === 'national') {
      const allowed = ['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate', 'free_fire', 'fortnite', 'call_of_duty_mobile']
      if (!allowed.includes(selectedDiscipline)) {
        setSelectedDiscipline('clash_royale')
      }
    }
  }, [rankingType, selectedDiscipline])

  // Filter visible disciplines tab list
  const visibleDisciplines = useMemo(() => {
    if (rankingType === 'national') {
      const allowed = ['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate', 'free_fire', 'fortnite', 'call_of_duty_mobile']
      return DISCIPLINES.filter(d => allowed.includes(d.value))
    }
    return DISCIPLINES
  }, [rankingType])

  // Filter rankings by discipline and search query
  const filteredRankings = useMemo(() => {
    const list = rankingType === 'community' ? communityRankings : nationalRankings
    return list
      .filter((r) => r.discipline === selectedDiscipline)
      .filter((r) => {
        const name = rankingType === 'community'
          ? (r.profiles?.username || '')
          : (r.display_name || '')
        return name.toLowerCase().includes(searchQuery.toLowerCase())
      })
      .map((r, index) => ({
        ...r,
        rank: index + 1,
      }))
  }, [rankingType, communityRankings, nationalRankings, selectedDiscipline, searchQuery])

  // Handle clicking on a player to view details
  const handlePlayerClick = async (player: any) => {
    setSelectedPlayer(player)
    if (rankingType === 'national') {
      setLoadingDetails(false)
      // For national players, details are stored directly inside the player national stats record
      setPlayerDetails({
        nationalPlayer: true,
        realName: player.real_name,
        tournamentsPlayed: player.tournaments_played,
        podiumsCount: player.podiums_count,
        winRate: player.win_rate,
        socialTwitch: player.social_twitch,
        socialTwitter: player.social_twitter,
        isNationalSelected: player.is_national_selected,
        avatarUrl: player.avatar_url
      })
      return
    }
    setLoadingDetails(true)
    setPlayerDetails(null)
    try {
      const details = await getPlayerDetails(player.user_id)
      setPlayerDetails(details)
    } catch (err) {
      console.error('Error fetching player details:', err)
    } finally {
      setLoadingDetails(false)
    }
  }

  // Chart data formatting
  const chartData = useMemo(() => {
    if (!playerDetails?.pointsHistory) return []
    let acc = 0
    return playerDetails.pointsHistory.map((h: any, i: number) => {
      acc += Number(h.points_awarded)
      return {
        name: `T${i + 1}`,
        puntos: acc,
      }
    })
  }, [playerDetails])

  const placementChartData = useMemo(() => {
    if (!playerDetails?.participations) return []
    const dist: Record<string, number> = { '1er': 0, '2do': 0, '3er': 0, 'Otro': 0 }
    playerDetails.participations.forEach((p: any) => {
      const standing = p.teams?.team_standings?.[0] || p.teams?.team_standings
      const rank = standing?.rank
      if (rank === 1) dist['1er']++
      else if (rank === 2) dist['2do']++
      else if (rank === 3) dist['3er']++
      else if (rank !== undefined) dist['Otro']++
    })
    return Object.entries(dist).map(([name, cantidad]) => ({ name, cantidad }))
  }, [playerDetails])

  return (
    <div className="space-y-8">
      {/* Ranking Type Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-px overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setRankingType('community')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${
            rankingType === 'community' ? 'border-neon-cyan text-white' : 'border-transparent text-white/40 hover:text-white/80'
          }`}
        >
          Ranking Kronix (Comunidad)
        </button>
        <button
          onClick={() => setRankingType('national')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${
            rankingType === 'national' ? 'border-neon-cyan text-white' : 'border-transparent text-white/40 hover:text-white/80'
          }`}
        >
          Rankings Nacionales (FED / Pro)
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 scrollbar-none">
          {visibleDisciplines.map((d) => (
            <button
              key={d.value}
              onClick={() => setSelectedDiscipline(d.value)}
              className={`px-4 py-2 rounded-xl text-xs uppercase font-bold tracking-widest border transition-all duration-150 shrink-0 ${
                selectedDiscipline === d.value
                  ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan font-black'
                  : 'border-white/5 bg-[#0d0d0f]/60 text-white/40 hover:text-white/60'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar jugador..."
            className="w-full bg-[#0d0d0f]/60 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon-cyan/50"
          />
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        {filteredRankings.length === 0 ? (
          <div className="text-center py-20 text-white/30 text-sm">
            Aún no hay puntuaciones en esta disciplina.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="text-white/40 text-[10px] uppercase font-black tracking-widest border-b border-white/5 bg-white/[0.01]">
                  <th className="px-6 py-5 text-center w-20">Rank</th>
                  <th className="px-6 py-5">Jugador</th>
                  {rankingType === 'national' && (
                    <>
                      <th className="px-6 py-5 text-center">Torneos</th>
                      <th className="px-6 py-5 text-center">Podios</th>
                      <th className="px-6 py-5 text-center">Win Rate</th>
                    </>
                  )}
                  <th className="px-6 py-5 text-right">Puntos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredRankings.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => handlePlayerClick(r)}
                    className="hover:bg-white/[0.02] cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-5 text-center font-orbitron font-black text-base">
                      <span className={r.rank === 1 ? 'text-gold' : r.rank === 2 ? 'text-white/80' : r.rank === 3 ? 'text-orange-400' : 'text-white/30'}>
                        #{r.rank}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs uppercase text-white/40">
                          {rankingType === 'community'
                            ? (r.profiles?.username?.[0] || '?')
                            : (r.display_name?.[0] || '?')}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white group-hover:text-neon-cyan transition-colors">
                              {rankingType === 'community' ? r.profiles?.username : r.display_name}
                            </span>
                            {rankingType === 'national' && r.is_national_selected && (
                              <span className="text-[8px] bg-neon-cyan/15 text-neon-cyan px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                                Selección Nacional 🇩🇴
                              </span>
                            )}
                          </div>
                          {rankingType === 'national' && r.real_name && (
                            <span className="text-[10px] text-white/30 block mt-0.5">{r.real_name}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    {rankingType === 'national' && (
                      <>
                        <td className="px-6 py-5 text-center font-orbitron text-white/60 font-bold">{r.tournaments_played}</td>
                        <td className="px-6 py-5 text-center font-orbitron text-yellow-500 font-bold">{r.podiums_count}</td>
                        <td className="px-6 py-5 text-center font-orbitron text-purple-400 font-bold">{r.win_rate}%</td>
                      </>
                    )}
                    <td className="px-6 py-5 text-right font-orbitron font-black text-neon-cyan text-base">
                      {Number(r.points).toFixed(1)} <span className="text-xs text-white/50">pts</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Player Detail Modal */}
      <AnimatePresence>
        {selectedPlayer && (
          <Fragment>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlayer(null)}
              className="fixed inset-0 bg-black z-50 cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-y-12 inset-x-6 md:inset-x-auto md:right-12 md:w-[500px] bg-[#0d0d0f] border border-white/5 rounded-3xl p-6 shadow-2xl z-50 overflow-y-auto space-y-6 scrollbar-none"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center font-bold font-orbitron text-xl text-neon-cyan shrink-0">
                    {rankingType === 'community'
                      ? (selectedPlayer.profiles?.username?.[0] || '?')
                      : (selectedPlayer.display_name?.[0] || '?')}
                  </div>
                  <div>
                    <h3 className="text-white font-orbitron font-bold text-lg uppercase tracking-wider">
                      {rankingType === 'community' ? selectedPlayer.profiles?.username : selectedPlayer.display_name}
                    </h3>
                    <p className="text-white/40 text-xs">Top #{selectedPlayer.rank} en {GAME_NAMES[selectedDiscipline]}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPlayer(null)}
                  className="w-8 h-8 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/40 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {loadingDetails ? (
                <div className="text-center py-20 text-white/30 text-sm animate-pulse">
                  Cargando estadísticas del jugador...
                </div>
              ) : (
                playerDetails && (
                  <div className="space-y-6">
                    {/* Stats Highlights */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                        <p className="text-white/40 text-[9px] uppercase tracking-widest font-bold">Puntos Totales</p>
                        <p className="text-2xl font-black font-orbitron text-neon-cyan mt-1">
                          {Number(selectedPlayer.points).toFixed(1)}
                        </p>
                      </div>
                      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                        <p className="text-white/40 text-[9px] uppercase tracking-widest font-bold">Torneos Jugados</p>
                        <p className="text-2xl font-black font-orbitron text-white mt-1">
                          {playerDetails.nationalPlayer ? playerDetails.tournamentsPlayed : (playerDetails.participations?.length || 0)}
                        </p>
                      </div>
                    </div>

                    {playerDetails.nationalPlayer ? (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                            <p className="text-white/40 text-[9px] uppercase tracking-widest font-bold">Podios Logrados</p>
                            <p className="text-2xl font-black font-orbitron text-yellow-500 mt-1">
                              {playerDetails.podiumsCount}
                            </p>
                          </div>
                          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                            <p className="text-white/40 text-[9px] uppercase tracking-widest font-bold">Porcentaje de Victoria</p>
                            <p className="text-2xl font-black font-orbitron text-purple-400 mt-1">
                              {playerDetails.winRate}%
                            </p>
                          </div>
                        </div>

                        {playerDetails.realName && (
                          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                            <p className="text-white/40 text-[9px] uppercase tracking-widest font-bold">Nombre Real</p>
                            <p className="text-sm font-semibold text-white mt-1">
                              {playerDetails.realName}
                            </p>
                          </div>
                        )}

                        {playerDetails.isNationalSelected && (
                          <div className="bg-neon-cyan/5 border border-neon-cyan/20 rounded-2xl p-4 text-center">
                            <p className="text-neon-cyan font-bold text-xs uppercase tracking-widest">Atleta de Selección Nacional 🇩🇴</p>
                            <p className="text-white/60 text-xs mt-1">Este jugador representa oficialmente al país en competencias internacionales.</p>
                          </div>
                        )}

                        {(playerDetails.socialTwitch || playerDetails.socialTwitter) && (
                          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2">
                            <p className="text-white/40 text-[9px] uppercase tracking-widest font-bold">Redes Sociales</p>
                            <div className="flex gap-4">
                              {playerDetails.socialTwitch && (
                                <a href={playerDetails.socialTwitch} target="_blank" rel="noreferrer" className="text-xs text-neon-cyan hover:underline">
                                  💜 Twitch
                                </a>
                              )}
                              {playerDetails.socialTwitter && (
                                <a href={playerDetails.socialTwitter} target="_blank" rel="noreferrer" className="text-xs text-neon-cyan hover:underline">
                                  🐦 Twitter / X
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Chart 1: Points progression */}
                        {chartData.length >= 2 && (
                          <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4">
                            <h4 className="text-white font-orbitron text-xs uppercase tracking-wider mb-3">Evolución de Puntos</h4>
                            <div className="h-40 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" />
                                  <XAxis dataKey="name" stroke="#ffffff20" style={{ fontSize: '9px' }} />
                                  <YAxis stroke="#ffffff20" style={{ fontSize: '9px' }} />
                                  <Tooltip contentStyle={{ backgroundColor: '#0d0d0f', border: 'none' }} />
                                  <Line type="monotone" dataKey="puntos" stroke="#00F5FF" strokeWidth={2.5} dot={{ fill: '#00F5FF', r: 3 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}

                        {/* Chart 2: Placement distribution */}
                        {playerDetails.participations?.length > 0 && (
                          <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4">
                            <h4 className="text-white font-orbitron text-xs uppercase tracking-wider mb-3">Distribución de Posiciones</h4>
                            <div className="h-40 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={placementChartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" />
                                  <XAxis dataKey="name" stroke="#ffffff20" style={{ fontSize: '9px' }} />
                                  <YAxis stroke="#ffffff20" style={{ fontSize: '9px' }} />
                                  <Tooltip contentStyle={{ backgroundColor: '#0d0d0f', border: 'none' }} />
                                  <Bar dataKey="cantidad" fill="#a855f7" radius={[4, 4, 0, 0]}>
                                    {placementChartData.map((entry: any, index: number) => (
                                      <Cell
                                        key={`cell-${index}`}
                                        fill={index === 0 ? '#E2C222' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#a855f7'}
                                      />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}

                        {/* Badges Cabinet */}
                        {playerDetails.badges && playerDetails.badges.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-white font-orbitron text-xs uppercase tracking-wider">Góndola de Medallas</h4>
                            <div className="grid grid-cols-3 gap-3">
                              {playerDetails.badges.map((b: any) => (
                                <div
                                  key={b.id}
                                  className="flex flex-col items-center text-center p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group"
                                >
                                  <img src={b.badge_url} alt={b.name} className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(0,245,255,0.1)] mb-2" />
                                  <span className="text-[10px] text-white font-medium truncate max-w-full">{b.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recent Tournaments History */}
                        {playerDetails.participations && playerDetails.participations.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-white font-orbitron text-xs uppercase tracking-wider">Últimas Participaciones</h4>
                            <div className="space-y-2">
                              {playerDetails.participations.slice(0, 3).map((p: any) => {
                                const standing = p.teams?.team_standings?.[0] || p.teams?.team_standings
                                const rank = standing?.rank
                                return (
                                  <div key={p.id} className="flex justify-between items-center bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3">
                                    <div>
                                      <p className="text-xs text-white font-bold">{p.tournaments?.name}</p>
                                      <p className="text-[9px] text-white/30 uppercase mt-0.5">{GAME_NAMES[p.tournaments?.discipline] || p.tournaments?.discipline}</p>
                                    </div>
                                    <div className="text-right">
                                      <span className={`text-xs font-black font-orbitron ${rank === 1 ? 'text-gold' : rank === 2 ? 'text-white/80' : rank === 3 ? 'text-orange-400' : 'text-white/30'}`}>
                                        #{rank || '?'}
                                      </span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              )}
            </motion.div>
          </Fragment>
        )}
      </AnimatePresence>
    </div>
  )
}
