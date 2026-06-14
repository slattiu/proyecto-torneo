'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts'
import { motion, AnimatePresence, animate } from 'framer-motion'
import { Match, Submission, ScoringRule, Participant } from '@/types'

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: v => setDisplay(v),
    })
    return controls.stop
  }, [value])
  return <>{display.toFixed(decimals)}</>
}

interface TeamDetailsProps {
  teamId: string
  teamName: string
  matches: Match[]
  submissions: Submission[]
  scoringRule: ScoringRule
  participants: Participant[]
  primaryColor: string
  discipline?: string
}

export function TeamDetails({
  teamId,
  teamName,
  matches,
  submissions,
  scoringRule,
  participants,
  primaryColor,
  discipline = 'warzone',
}: TeamDetailsProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // 1. Filter approved submissions for this team
  const teamSubmissions = useMemo(
    () => submissions.filter((s) => s.teamId === teamId && s.status === 'approved'),
    [submissions, teamId]
  )

  // 2. Filter participants for this team
  const teamParticipants = useMemo(
    () => participants.filter((p) => p.teamId === teamId),
    [participants, teamId]
  )

  const selectedPlayer = useMemo(
    () => teamParticipants.find(p => p.id === selectedPlayerId),
    [teamParticipants, selectedPlayerId]
  )

  // NUEVO: Mapa de bajas calculado desde los envíos actuales (Fuente de Verdad)
  const calculatedPlayerKillsMap = useMemo(() => {
    const map: Record<string, number> = {}
    teamSubmissions.forEach(sub => {
      const breakdown = sub.playerKills as any || {}
      Object.entries(breakdown).forEach(([pId, k]) => {
        map[pId] = (map[pId] || 0) + (Number(k) || 0)
      })
    })
    return map
  }, [teamSubmissions])

  // 3. Prepare Chart Data (Cumulative for Team, Per-Round for Player)
  const chartData = useMemo(() => {
    const sortedMatches = [...matches].sort((a, b) => a.matchNumber - b.matchNumber)
    
    let cumulativePoints = 0
    let cumulativeKills = 0

    return sortedMatches.map((m) => {
      const sub = teamSubmissions.find((s) => String(s.matchId) === String(m.id))
      const kills = sub?.killCount || 0
      
      // Individual player kills for this match
      let playerKillsInMatch = 0
      if (selectedPlayerId && sub?.playerKills) {
        playerKillsInMatch = (sub.playerKills as any)[selectedPlayerId] || 0
      }
      
      // Points calculation
      const killPoints = kills * (scoringRule?.killPoints || 0)
      
      // NEW: Use rank for placement points
      const pos = sub?.rank || (sub?.potTop ? 1 : 0)
      const placementPoints = pos > 0 ? (scoringRule?.placementPoints?.[String(pos)] || 0) : 0
      
      const roundPoints = killPoints + placementPoints

      cumulativePoints += roundPoints
      cumulativeKills += kills

      return {
        name: m.mapName || `Match ${m.matchNumber}`,
        points: cumulativePoints,
        kills: cumulativeKills,
        roundPoints: roundPoints,
        roundKills: kills,
        playerKills: playerKillsInMatch
      }
    })
  }, [matches, teamSubmissions, scoringRule, selectedPlayerId])

  // 4. Calculate Metrics
  const teamKD = useMemo(() => {
    const totalKills = teamSubmissions.reduce((acc, sub) => acc + (sub.killCount || 0), 0)
    // KD in this context is AVG Kills per match
    const matchesWithData = teamSubmissions.length || 1
    return (totalKills / matchesWithData).toFixed(2)
  }, [teamSubmissions])

  const kd = useMemo(() => {
    if (!selectedPlayer) return "0.00"
    // Calculate AVG kills for this specific player across all team submissions
    const playerKillsTotal = teamSubmissions.reduce((acc, sub) => {
      const breakdown = sub.playerKills as any || {}
      return acc + (breakdown[selectedPlayer.id] || 0)
    }, 0)
    const matchesPlayed = teamSubmissions.length || 1
    return (playerKillsTotal / matchesPlayed).toFixed(2)
  }, [selectedPlayer, teamSubmissions])

  const avgPlacement = useMemo(() => {
    const subsWithRank = teamSubmissions.filter(s => s.rank || s.potTop)
    if (subsWithRank.length === 0) return '—'
    const sum = subsWithRank.reduce((acc, s) => acc + (s.rank || 1), 0)
    return (sum / subsWithRank.length).toFixed(1)
  }, [teamSubmissions])

  const bestPlacement = useMemo(() => {
    const ranks = teamSubmissions.map(s => s.rank || (s.potTop ? 1 : Infinity)).filter(r => r !== Infinity)
    if (ranks.length === 0) return '—'
    return Math.min(...ranks)
  }, [teamSubmissions])

  const playerColor = useMemo(() => {
    return (selectedPlayer && selectedPlayer.color) ? selectedPlayer.color : primaryColor
  }, [primaryColor, selectedPlayer])

  const rgbColor = useMemo(() => {
    const cleanHex = playerColor.replace('#', '')
    const r = parseInt(cleanHex.substring(0, 2), 16)
    const g = parseInt(cleanHex.substring(2, 4), 16)
    const b = parseInt(cleanHex.substring(4, 6), 16)
    return isNaN(r) || isNaN(g) || isNaN(b) ? '0, 245, 255' : `${r}, ${g}, ${b}`
  }, [playerColor])

  const primaryGlowHex = useMemo(() => {
    return playerColor.replace('#', '%23')
  }, [playerColor])

  if (!isMounted) {
    return (
      <div className="p-4 sm:p-8 bg-white/[0.01] border-t border-white/5 h-[600px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/10 border-t-neon-cyan rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 bg-white/[0.01] border-t border-white/5 space-y-8">
      {/* Analytics Grid */}
      <AnimatePresence mode="wait">
      {selectedPlayerId && selectedPlayer ? (
        /* ── COMBAT PLAYER SHOWCASE ─────────────────────────────────────── */
        <motion.div
          key={`showcase-${selectedPlayer.id}`}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden"
          style={{
            minHeight: '420px',
            background: 'linear-gradient(135deg, #0a0a0c 0%, #0d0d10 50%, #0a0c0a 100%)',
            border: `1px solid rgba(${rgbColor}, 0.2)`,
            borderRadius: '4px',
          }}
        >
          {/* Hex grid background */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.04,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0 L40 10 L40 30 L20 40 L0 30 L0 10 Z' fill='none' stroke='${primaryGlowHex}' stroke-width='0.5'/%3E%3C/svg%3E")`,
            backgroundSize: '40px 40px',
          }} />
          {/* Theme-colored radial behind player */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            style={{
              position: 'absolute', top: 0, left: 0, width: '55%', height: '100%',
              background: `radial-gradient(ellipse 70% 90% at 30% 60%, rgba(${rgbColor}, 0.12) 0%, rgba(${rgbColor}, 0.06) 40%, transparent 70%)`,
              pointerEvents: 'none',
            }}
          />
          {/* Diagonal slash accent */}
          <div style={{
            position: 'absolute', top: 0, left: '38%', width: '3px', height: '100%',
            background: `linear-gradient(180deg, transparent, rgba(${rgbColor}, 0.4) 30%, rgba(${rgbColor}, 0.6) 50%, rgba(${rgbColor}, 0.4) 70%, transparent)`,
            transform: 'skewX(-8deg)', pointerEvents: 'none',
          }} />

          {/* Top bar */}
          <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-0">
            <button
              onClick={() => setSelectedPlayerId(null)}
              className="flex items-center gap-2 transition-colors text-[9px] font-black uppercase tracking-[0.25em]"
              style={{ color: `rgba(${rgbColor}, 0.6)` }}
              onMouseEnter={e => (e.currentTarget.style.color = playerColor)}
              onMouseLeave={e => (e.currentTarget.style.color = `rgba(${rgbColor}, 0.6)`)}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </button>
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{ width: '6px', height: '6px', borderRadius: '50%', background: playerColor }}
              />
              <span style={{ fontSize: '0.55rem', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.2)' }}>
                {teamName.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Main layout */}
          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end gap-0 px-4 sm:px-5 pb-5 pt-1">

            {/* ── LEFT: Player image with tactical frame ── */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex-shrink-0 flex items-center justify-center"
              style={{ width: '210px', height: '290px' }}
            >
              {/* Ground glow */}
              <div style={{
                position: 'absolute', bottom: '0px', left: '50%', transform: 'translateX(-50%)',
                width: '180px', height: '50px',
                background: `radial-gradient(ellipse, rgba(${rgbColor}, 0.4) 0%, transparent 70%)`,
                filter: 'blur(14px)', pointerEvents: 'none',
              }} />
              {/* Tactical corner brackets */}
              {[
                { top: 12, left: 12, borderTop: `2px solid ${playerColor}`, borderLeft: `2px solid ${playerColor}`, w: 20, h: 20 },
                { top: 12, right: 12, borderTop: `2px solid ${playerColor}`, borderRight: `2px solid ${playerColor}`, w: 20, h: 20 },
                { bottom: 12, left: 12, borderBottom: `2px solid ${playerColor}`, borderLeft: `2px solid ${playerColor}`, w: 20, h: 20 },
                { bottom: 12, right: 12, borderBottom: `2px solid ${playerColor}`, borderRight: `2px solid ${playerColor}`, w: 20, h: 20 },
              ].map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 1.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.06, duration: 0.4 }}
                  style={{
                    position: 'absolute',
                    top: s.top, left: s.left, right: s.right, bottom: s.bottom,
                    width: s.w, height: s.h,
                    borderTop: s.borderTop, borderLeft: s.borderLeft,
                    borderBottom: s.borderBottom, borderRight: s.borderRight,
                    pointerEvents: 'none',
                  }}
                />
              ))}
              {/* Scan line */}
              <motion.div
                animate={{ top: ['15%', '85%', '15%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                style={{
                  position: 'absolute', left: '10%', right: '10%', height: '1px',
                  background: `linear-gradient(90deg, transparent, rgba(${rgbColor}, 0.6), transparent)`,
                  pointerEvents: 'none', zIndex: 3,
                }}
              />
              {/* Player image */}
              {selectedPlayer.avatarUrl ? (
                <motion.img
                  src={selectedPlayer.avatarUrl}
                  alt={selectedPlayer.displayName}
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    width: '170px', height: '250px', objectFit: 'contain',
                    filter: `drop-shadow(0 0 20px rgba(${rgbColor}, 0.7)) drop-shadow(0 10px 40px rgba(0,0,0,0.95))`,
                    position: 'relative', zIndex: 2,
                  }}
                />
              ) : (
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    position: 'relative', zIndex: 2, width: '150px', height: '210px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem',
                    background: `linear-gradient(135deg, rgba(${rgbColor}, 0.1), rgba(0,0,0,0.4))`,
                    border: `1px solid rgba(${rgbColor}, 0.2)`,
                  }}
                >👤</motion.div>
              )}
            </motion.div>

            {/* ── RIGHT: Combat stats ── */}
            <div className="flex-1 flex flex-col justify-end pl-0 sm:pl-6 pb-1">
              {/* Role badge */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-2 mb-2"
              >
                {selectedPlayer.isCaptain && (
                  <span style={{
                    background: `rgba(${rgbColor}, 0.15)`, border: `1px solid rgba(${rgbColor}, 0.5)`,
                    color: playerColor, fontSize: '0.45rem',
                    fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.25em',
                    padding: '3px 10px', clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
                  }}>▲ CAPITÁN</span>
                )}
                <span style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.2em' }}>
                  ID:{selectedPlayer.id.slice(0, 8).toUpperCase()}
                </span>
              </motion.div>

              {/* Player name with glitch */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15, duration: 0.5 }}
              >
                <h2 style={{
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: 'clamp(2rem, 5vw, 3.2rem)',
                  fontWeight: 900, color: '#fff', lineHeight: 0.9,
                  letterSpacing: '-0.02em',
                  textShadow: `0 0 30px rgba(${rgbColor}, 0.5), 2px 0 0 rgba(${rgbColor}, 0.3), -2px 0 0 rgba(0,200,255,0.15)`,
                }}>
                  {selectedPlayer.displayName.toUpperCase()}
                </h2>
              </motion.div>

              {/* Theme divider */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, delay: 0.28 }}
                style={{
                  height: '2px', marginTop: '0.75rem', marginBottom: '0.75rem',
                  background: `linear-gradient(90deg, ${playerColor}, rgba(${rgbColor}, 0.3), transparent)`,
                  transformOrigin: 'left',
                }}
              />

              {/* Live tournament stats */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.32 }}
                className="flex gap-5 mb-4"
              >
                {(['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate', 'league_of_legends', 'valorant'].includes(discipline) ? [
                  { label: 'PUNTOS', value: chartData.length > 0 ? chartData[chartData.length - 1].points : 0, dec: 0, color: playerColor },
                  { label: 'PARTIDAS', value: teamSubmissions.length, dec: 0, color: playerColor },
                ] : [
                  { label: 'KD TORNEO', value: Number(kd), dec: 2, color: playerColor },
                  { label: 'BAJAS CONF.', value: calculatedPlayerKillsMap[selectedPlayer.id] || 0, dec: 0, color: playerColor },
                ]).map(s => (
                  <div key={s.label}>
                    <p style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.2em', marginBottom: '2px' }}>{s.label}</p>
                    <p style={{ fontSize: '2rem', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, color: s.color, lineHeight: 1, textShadow: `0 0 20px ${s.color}66` }}>
                      <AnimatedNumber value={s.value} decimals={s.dec} />
                    </p>
                  </div>
                ))}
              </motion.div>

              {/* Pre-tournament stats */}
              {!['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate', 'league_of_legends', 'valorant'].includes(discipline) && (selectedPlayer.kdRatio != null || selectedPlayer.avgKills != null || selectedPlayer.classificationRank || selectedPlayer.brAvgPlacement != null) && (
                <div>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.38 }}
                    style={{ fontSize: '0.45rem', color: `rgba(${rgbColor}, 0.4)`, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.25em', marginBottom: '0.5rem' }}
                  >◆ HISTORIAL DE COMBATE</motion.p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      selectedPlayer.kdRatio != null && { label: 'K/D PROM.', value: Number(selectedPlayer.kdRatio).toFixed(2), color: playerColor, bar: Math.min(Number(selectedPlayer.kdRatio) / 5, 1) },
                      selectedPlayer.avgKills != null && { label: 'BAJAS/PARTIDA', value: Number(selectedPlayer.avgKills).toFixed(1), color: playerColor, bar: Math.min(Number(selectedPlayer.avgKills) / 15, 1) },
                      selectedPlayer.classificationRank && { label: 'RANGO MÁX', value: selectedPlayer.classificationRank, color: playerColor },
                      selectedPlayer.brAvgPlacement != null && { label: 'PUESTO MEDIO', value: `#${Number(selectedPlayer.brAvgPlacement).toFixed(0)}`, color: playerColor, bar: 1 - Math.min(Number(selectedPlayer.brAvgPlacement) / 100, 1) }
                    ].filter(Boolean).map((s: any, i) => (
                      <motion.div
                        key={s.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.42 + i * 0.07 }}
                        style={{
                          background: `linear-gradient(135deg, rgba(${rgbColor}, 0.06), rgba(0,0,0,0.4))`,
                          border: `1px solid rgba(${rgbColor}, 0.15)`,
                          borderLeft: `2px solid ${s.color}`,
                          padding: '0.6rem 0.75rem',
                          clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)',
                        }}
                      >
                        <p style={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.15em', marginBottom: '3px' }}>{s.label}</p>
                        <p style={{ fontSize: '1.15rem', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
                        {s.bar != null && (
                          <div style={{ marginTop: '5px', height: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${s.bar * 100}%` }}
                              transition={{ duration: 1.2, delay: 0.55 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                              style={{ height: '100%', background: `linear-gradient(90deg, ${s.color}, ${s.color}aa)` }}
                            />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      ) : (
      <div key="analytics" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div>
                <h3 className="text-[10px] font-orbitron font-black text-white/40 uppercase tracking-[0.3em] mb-1">
                  {selectedPlayerId ? `Rendimiento: ${selectedPlayer?.displayName}` : 'Progreso de Equipo'}
                </h3>
                <p className="text-[9px] text-white/20 uppercase font-bold tracking-widest">
                  {selectedPlayerId 
                    ? (['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate', 'league_of_legends', 'valorant'].includes(discipline) ? 'Rendimiento por ronda' : 'Bajas confirmadas por ronda') 
                    : (['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate', 'league_of_legends', 'valorant'].includes(discipline) ? 'Puntos acumulados' : 'Puntos y bajas acumuladas')
                  }
                </p>
             </div>
             
             <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
                {!selectedPlayerId ? (
                  <>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-neon-cyan" /> Puntos</div>
                    {!['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate', 'league_of_legends', 'valorant'].includes(discipline) && (
                      <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-neon-purple" /> Kills</div>
                    )}
                  </>
                ) : (
                  <button 
                    onClick={() => setSelectedPlayerId(null)}
                    className="px-3 py-1 rounded-full border border-white/10 hover:border-white/30 transition-colors text-white/40 hover:text-white"
                  >
                    Volver a Equipo
                  </button>
                )}
             </div>
          </div>
          
          <div className="h-[300px] w-full bg-black/20 rounded-3xl p-6 border border-white/5 shadow-inner relative group">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
                 <div className="px-4 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/5 flex flex-col items-center">
                    <span className="text-[7px] font-black text-white/30 uppercase tracking-widest leading-none mb-1">Mejor Pos.</span>
                    <span className="text-sm font-orbitron font-black text-neon-cyan leading-none">#{bestPlacement}</span>
                 </div>
                 <div className="px-4 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-neon-cyan/20 flex flex-col items-center">
                    <span className="text-[7px] font-black text-neon-cyan uppercase tracking-widest leading-none mb-1">Pos. Media</span>
                    <span className="text-sm font-orbitron font-black text-white leading-none">#{avgPlacement}</span>
                 </div>
              </div>

            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={primaryColor} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0A0A0B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="points" stroke={primaryColor} strokeWidth={3} fillOpacity={1} fill="url(#colorPoints)" animationDuration={1500} />
                  {!['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate', 'league_of_legends', 'valorant'].includes(discipline) && (
                    <Area type="monotone" dataKey="kills" stroke="#B400FF" strokeWidth={2} fill="transparent" animationDuration={2000} />
                  )}
                </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Individual Stats Column */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-orbitron font-black text-white/40 uppercase tracking-[0.3em]">
            Estadísticas de Jugadores
          </h3>

          <div className="space-y-2">
            {teamParticipants.length === 0 ? (
              <p className="text-[10px] text-white/20 uppercase tracking-widest italic py-4 text-center">No hay jugadores registrados</p>
            ) : (
              teamParticipants.map((p, idx) => (
                <motion.div
                  key={p.id}
                  onClick={() => setSelectedPlayerId(p.id)}
                  whileHover={{ x: 4 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-white/20 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} alt="" className="w-8 h-8 rounded-lg object-contain shrink-0" style={{ background: 'transparent' }} />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] text-white/40 font-black group-hover:bg-neon-cyan group-hover:text-black transition-colors">
                        {p.isCaptain ? '👑' : idx + 1}
                      </div>
                    )}
                    <span className="text-sm font-medium text-white group-hover:text-neon-cyan transition-colors">{p.displayName}</span>
                  </div>
                  {!['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate', 'league_of_legends', 'valorant'].includes(discipline) && (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-lg font-orbitron font-black text-white block leading-none">{calculatedPlayerKillsMap[p.id] || 0}</span>
                        <span className="text-[8px] text-white/30 uppercase font-bold tracking-tighter">Kills</span>
                      </div>
                      <svg className="w-3 h-3 text-white/20 group-hover:text-neon-cyan transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>

          {discipline === 'clash_royale' ? (
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-neon-cyan/20 to-transparent border border-neon-cyan/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white font-orbitron">API Sincronizada</span>
              </div>
              <p className="text-[9px] text-white/40 leading-relaxed uppercase tracking-widest font-bold">
                Sincronización oficial del marcador en vivo activa a través de la API de Clash Royale.
              </p>
            </div>
          ) : ['street_fighter_6', 'super_smash_bros_ultimate', 'league_of_legends', 'valorant'].includes(discipline) ? (
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-neon-purple/20 to-transparent border border-neon-purple/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-neon-purple animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white font-orbitron">Admin Verified</span>
              </div>
              <p className="text-[9px] text-white/40 leading-relaxed uppercase tracking-widest font-bold">
                Resultados y llaves gestionados y verificados directamente por el organizador.
              </p>
            </div>
          ) : (
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-neon-purple/20 to-transparent border border-neon-purple/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-neon-purple animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white font-orbitron">IA Verified</span>
              </div>
              <p className="text-[9px] text-white/40 leading-relaxed uppercase tracking-widest font-bold">
                Detección automática de OCR activada para este equipo.
              </p>
            </div>
          )}
        </div>
      </div>
      )}
      </AnimatePresence>
    </div>
  )
}
