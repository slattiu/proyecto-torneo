'use client'

import React, { useEffect, useState, useMemo, useCallback, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Orbitron } from 'next/font/google'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { TeamStanding, Participant, Match, Submission, ScoringRule } from '@/types'
import { MatchRecap } from './MatchRecap'
import { TeamDetails } from './TeamDetails'
import { NumberTicker } from '@/components/ui/NumberTicker'

import { AdPlacement } from '@/components/federation/AdPlacement'
import type { AdBanner } from '@/lib/actions/federation'
import { trackEvent } from '@/lib/analytics'
import { registerTournament } from '@/lib/actions/registration'
import { toast } from 'sonner'

const orbitron = Orbitron({ subsets: ['latin'] })

export function LeaderboardClient({
  tournamentId,
  tournamentName,
  tournamentLogoUrl,
  hideLogoInLeaderboard = false,
  description,
  format,
  status,
  initialStandings,
  teams,
  theme,
  matches,
  submissions,
  killRateEnabled,
  potTopEnabled,
  vipEnabled,
  rulesText,
  scoringRule,
  participants,
  championImageUrl,
  totalLiveViewers,
  adBanners,
  slug,
  mode,
  isPrivate,
  maxTeams,
  registrationStartDate,
  registrationEndDate,
  startDate,
  prize1st = 0,
  prize2nd = 0,
  prize3rd = 0,
  prizeMvp = 0,
  clashRoyaleTag,
  discipline = 'warzone',
}: {
  tournamentId: string
  tournamentName: string
  tournamentLogoUrl?: string
  hideLogoInLeaderboard?: boolean
  description?: string
  format: string
  status: string
  initialStandings: any[]
  teams?: any[]
  theme?: any
  matches?: Match[]
  submissions?: Submission[]
  killRateEnabled?: boolean
  potTopEnabled?: boolean
  vipEnabled?: boolean
  rulesText?: string
  scoringRule?: ScoringRule
  participants: Participant[]
  championImageUrl?: string
  totalLiveViewers?: number
  adBanners?: AdBanner[]
  slug: string
  mode: string
  isPrivate: boolean
  maxTeams?: number | null
  registrationStartDate?: string | null
  registrationEndDate?: string | null
  startDate?: string | null
  prize1st?: number
  prize2nd?: number
  prize3rd?: number
  prizeMvp?: number
  clashRoyaleTag?: string | null
  discipline?: string
}) {
  // Stable supabase client — created once, not on every render.
  // If this were inside the component body without useMemo, every render would produce
  // a new object reference, causing refreshStandingsFromDB (useCallback) to be
  // recreated each render, which would re-trigger the useEffect on every render.
  const supabase = useMemo(() => createClient(), [])
  const isShooter = discipline !== 'clash_royale' && 
    discipline !== 'street_fighter_6' && 
    discipline !== 'super_smash_bros_ultimate' && 
    discipline !== 'league_of_legends' && 
    discipline !== 'valorant'

  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isUserRegistered, setIsUserRegistered] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [regTeamName, setRegTeamName] = useState('')
  const [regStreamUrl, setRegStreamUrl] = useState('')
  const [regParticipants, setRegParticipants] = useState<string[]>([])
  const [regPassword, setRegPassword] = useState('')
  const [regLoading, setRegLoading] = useState(false)

  const handleOpenRegistration = () => {
    const size = { individual: 1, duos: 2, trios: 3, cuartetos: 4, quintas: 5 }[mode] || 1
    const initialParticipants = Array(size).fill('')
    if (currentUser) {
      initialParticipants[0] = currentUser.email.split('@')[0]
    }
    setRegParticipants(initialParticipants)
    setRegTeamName('')
    setRegStreamUrl('')
    setRegPassword('')
    setIsRegistering(true)
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegLoading(true)
    try {
      // Validate all names are filled
      const emptyNameIndex = regParticipants.findIndex(name => name.trim() === '')
      if (emptyNameIndex !== -1) {
        toast.error(`Por favor, completa el nombre del Integrante ${emptyNameIndex + 1}`)
        setRegLoading(false)
        return
      }

      if (isPrivate && !regPassword.trim()) {
        toast.error('Por favor, ingresa la contraseña del torneo.')
        setRegLoading(false)
        return
      }

      const members = regParticipants.map(name => ({ displayName: name }))
      const res = await registerTournament(tournamentId, {
        teamName: mode === 'individual' ? regParticipants[0] : regTeamName,
        streamUrl: regStreamUrl || undefined,
        participants: members,
        password: isPrivate ? regPassword : undefined
      })

      if (res && 'error' in res) {
        toast.error(res.error)
      } else {
        toast.success('¡Inscripción completada con éxito!')
        setIsUserRegistered(true)
        setIsRegistering(false)
        window.location.reload()
      }
    } catch (err: any) {
      toast.error('Ocurrió un error al enviar la inscripción.')
    } finally {
      setRegLoading(false)
    }
  }
  const [isMounted, setIsMounted] = useState(false)
  const [host, setHost] = useState('localhost')
  const [standings, setStandings] = useState(initialStandings)
  const [currentTeams, setCurrentTeams] = useState(teams || [])
  const [currentSubmissions, setCurrentSubmissions] = useState(submissions || [])
  const [currentMatches, setCurrentMatches] = useState(matches || [])
  const [currentLiveViewers, setCurrentLiveViewers] = useState(totalLiveViewers || 0)
  const [activeTab, setActiveTab] = useState<'ranking' | 'participants' | 'matches' | 'rules' | 'statistics'>('ranking')
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null)
  const [watchingStream, setWatchingStream] = useState<string | null>(null)

  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)

  // Real-time metadata states
  const [currentTheme, setCurrentTheme] = useState(theme)
  const [currentStatus, setCurrentStatus] = useState(status)
  const [currentChampionImg, setCurrentChampionImg] = useState(championImageUrl)
  const [isMobile, setIsMobile] = useState(false)
  const [showHallOfFame, setShowHallOfFame] = useState(false)
  const [isTableMaximized, setIsTableMaximized] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    setHost(window.location.hostname)
    // Track leaderboard page view
    trackEvent({
      tournamentId,
      eventType: 'page_view',
      metadata: { tournamentName }
    })
  }, [tournamentId, tournamentName])

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser(user)
        // Check if user is registered in this tournament
        const { data: registration } = await supabase
          .from('participants')
          .select('id')
          .eq('tournament_id', tournamentId)
          .eq('user_id', user.id)
          .limit(1)
        if (registration && registration.length > 0) {
          setIsUserRegistered(true)
        }
      }
    }
    fetchUser()
  }, [supabase, tournamentId])

  const primaryColor = currentTheme?.primary_color || currentTheme?.primaryColor || '#00F5FF'
  const backgroundValue = currentTheme?.background_value
  const backgroundMobileValue = currentTheme?.background_mobile_value
  const activeBackground = (isMobile && backgroundMobileValue) ? backgroundMobileValue : backgroundValue
  const logoUrl = currentTheme?.logo_url || currentTheme?.logoUrl || tournamentLogoUrl

  // Prop Sync: Ensure internal state handles server-side updates/navigation
  useEffect(() => {
    if (theme) setCurrentTheme(theme)
  }, [theme])

  useEffect(() => {
    if (status) setCurrentStatus(status)
  }, [status])

  useEffect(() => {
    if (championImageUrl !== undefined) {
      setCurrentChampionImg(championImageUrl)
    }
  }, [championImageUrl])

  useEffect(() => {
    if (initialStandings) setStandings(initialStandings)
  }, [initialStandings])

  useEffect(() => {
    if (teams) setCurrentTeams(teams)
  }, [teams])

  useEffect(() => {
    if (submissions) setCurrentSubmissions(submissions)
  }, [submissions])

  useEffect(() => {
    if (matches) setCurrentMatches(matches)
  }, [matches])

  useEffect(() => {
    setExpandedTeamId(null)
  }, [activeTab])

  const handleSync = async () => {
    setIsSyncing(true)
    setSyncStatus('Sincronizando...')
    try {
      // Call the public API route (uses admin client, no user auth required)
      const res = await fetch(`/api/sync-standings?tournamentId=${tournamentId}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setSyncStatus('¡Marcador actualizado!')
        // Refresh standings from DB without full page reload
        await refreshStandingsFromDB()
        setTimeout(() => setSyncStatus(null), 3000)
      } else {
        setSyncStatus('Error al sincronizar')
        setTimeout(() => setSyncStatus(null), 3000)
      }
    } catch (err) {
      setSyncStatus('Fallo de red')
      setTimeout(() => setSyncStatus(null), 3000)
    } finally {
      setIsSyncing(false)
    }
  }

  // 1. Agregación Atómica: Calculamos las bajas reales sumando las partidas aprobadas
  // Esta es la "Fuente de Verdad" que evita la latencia de la base de datos.
  const participantsWithCalculatedKills = useMemo(() => {
    // Mapa de bajas acumuladas por ID de jugador
    const killsMap: Record<string, number> = {}
    
    currentSubmissions
      .filter(s => s.status === 'approved')
      .forEach(s => {
        if (s.playerKills && typeof s.playerKills === 'object') {
          Object.entries(s.playerKills).forEach(([pId, kills]) => {
            killsMap[pId] = (killsMap[pId] || 0) + (Number(kills) || 0)
          })
        }
      })

    // Enriquecemos los participantes con sus bajas calculadas
    return (currentTeams || []).flatMap((t: any) => 
      (t.participants || []).map((p: any) => ({
        ...p,
        teamId: t.id,
        teamName: t.name,
        teamAvatar: t.avatarUrl,
        totalKills: killsMap[p.id] || 0 // Sobrescribimos con el dato real/calculado
      }))
    )
  }, [currentTeams, currentSubmissions])

  // NUEVO: Mapa de búsqueda rápida por ID de jugador para las listas
  const calculatedKillsLookup = useMemo(() => {
    const map: Record<string, number> = {}
    participantsWithCalculatedKills.forEach(p => {
      map[p.id] = p.totalKills || 0
    })
    return map
  }, [participantsWithCalculatedKills])
  
  const topFraggers = [...participantsWithCalculatedKills]
    .sort((a, b) => (b.totalKills || 0) - (a.totalKills || 0))
    .filter(p => (p.totalKills || 0) > 0)
    .slice(0, 5)

  const renderStandingsTable = () => {
    return (
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white/[0.03] border-b border-white/5 text-xs text-white/40 uppercase tracking-widest font-semibold">
            <th className="px-6 py-4 w-20 text-center">Rank</th>
            <th className="px-6 py-4">Equipo</th>
            <th className="px-6 py-4 text-center">PTS</th>
            {isShooter && <th className="px-6 py-4 text-center">Kills</th>}
            {potTopEnabled && <th className="hidden md:table-cell px-6 py-4 text-center">Top 1</th>}
            {isShooter && killRateEnabled && <th className="hidden md:table-cell px-6 py-4 text-center">Kill Rate</th>}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence>
            {standings.map((s, idx) => {
              const rankDiff = (s.previousRank || s.rank) - s.rank
              return (
                <Fragment key={s.teamId}>
                <motion.tr
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ 
                    type: 'spring', 
                    stiffness: 400, 
                    damping: 40,
                    opacity: { duration: 0.2 },
                    layout: { duration: 0.6 }
                  }}
                  className={`border-b border-white/5 hover:bg-white/[0.04] transition-colors cursor-pointer group ${
                    expandedTeamId === s.teamId ? 'bg-white/[0.03]' : ''
                  }`}
                  onClick={() => setExpandedTeamId(expandedTeamId === s.teamId ? null : s.teamId)}
                >
                  <td className="px-3 sm:px-6 py-4 sm:py-6">
                    <div className="flex items-center justify-center gap-1 sm:gap-2">
                       <div className="flex flex-col items-center">
                          <span className={`font-orbitron font-black text-base sm:text-2xl ${
                            (idx + 1) === 1 ? 'text-gold drop-shadow-[0_0_10px_rgba(255,215,0,0.3)]' : 
                            (idx + 1) === 2 ? 'text-gray-300' : 
                            (idx + 1) === 3 ? 'text-orange-400' : 'text-white/40'
                          }`}>
                            {idx + 1}
                          </span>
                          <div className="flex items-center gap-1 mt-1 h-3">
                             <AnimatePresence mode="wait">
                               {rankDiff > 0 && (
                                 <motion.span 
                                   key="up"
                                   initial={{ opacity: 0, y: 5 }}
                                   animate={{ opacity: 1, y: 0 }}
                                   exit={{ opacity: 0, y: -5 }}
                                   className="text-[9px] font-bold text-green-400 flex items-center"
                                 >
                                   ▲{rankDiff}
                                 </motion.span>
                               )}
                               {rankDiff < 0 && (
                                 <motion.span 
                                   key="down"
                                   initial={{ opacity: 0, y: -5 }}
                                   animate={{ opacity: 1, y: 0 }}
                                   exit={{ opacity: 0, y: 5 }}
                                   className="text-[9px] font-bold text-red-400 flex items-center"
                                 >
                                   ▼{Math.abs(rankDiff)}
                                 </motion.span>
                               )}
                             </AnimatePresence>
                          </div>
                       </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 sm:py-6">
                    <div className="flex items-center gap-3 sm:gap-5">
                      <div className="relative">
                         {s.avatarUrl ? (
                           <img src={s.avatarUrl} alt="" className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl object-cover border-2 border-white/10 shadow-xl" />
                         ) : (
                           <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20 font-orbitron font-black text-xl italic">
                             {s.teamName.substring(0, 1)}
                           </div>
                         )}
                         {expandedTeamId === s.teamId && (
                           <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-neon-cyan border-2 border-dark-card flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                           </div>
                         )}
                      </div>
                      <div className="flex-1">
                         <div className="flex items-center gap-3">
                           <span className="font-orbitron font-black text-sm sm:text-xl tracking-tight text-white group-hover:text-neon-cyan transition-colors">{s.teamName}</span>
                           {s.streams && s.streams.length > 0 && (
                             <div className="flex items-center gap-1 text-[8px] bg-red-500/20 text-red-500 font-bold px-1.5 py-0.5 rounded border border-red-500/30 uppercase tracking-tighter">
                                LIVE
                             </div>
                           )}
                         </div>
                         <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Ver Detalles</span>
                            <svg className={`w-3 h-3 text-white/20 transition-transform ${expandedTeamId === s.teamId ? 'rotate-90 text-neon-cyan' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                            </svg>
                         </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 sm:py-6 text-center font-orbitron font-black text-2xl sm:text-4xl text-neon-cyan">
                    <NumberTicker value={s.totalPoints} />
                  </td>
                  {isShooter && (
                    <td className="px-3 sm:px-6 py-4 sm:py-6 text-center">
                       <div className="flex flex-col items-center">
                          <span className="text-white font-black text-lg sm:text-xl">
                            <NumberTicker value={s.totalKills} />
                          </span>
                          <span className="text-[8px] text-white/40 uppercase font-black tracking-widest mt-1">TOTAL KILLS</span>
                       </div>
                    </td>
                  )}
                  {potTopEnabled && (
                    <td className="hidden md:table-cell px-6 py-4 text-center">
                       <div className="flex flex-col items-center">
                          <span className="text-gold font-black text-lg">{s.potTopCount}</span>
                          <span className="text-[8px] text-white/40 uppercase font-black tracking-widest mt-1">VICTORIAS</span>
                       </div>
                    </td>
                  )}
                  {isShooter && killRateEnabled && (
                    <td className="hidden md:table-cell px-6 py-4 text-center">
                       <div className="flex flex-col items-center">
                          <span className="text-white/60 font-mono text-xs">
                            <NumberTicker value={s.killRate} precision={1} />
                          </span>
                          <span className="text-[8px] text-white/20 uppercase font-black tracking-tighter mt-1">AVG K/M</span>
                       </div>
                    </td>
                  )}
                </motion.tr>

                {/* Expansion Row */}
                <AnimatePresence>
                  {expandedTeamId === s.teamId && (
                    <motion.tr
                      key={`details-${s.teamId}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-black/40 overflow-hidden"
                    >
                      <td colSpan={6} className="p-0">
                         <TeamDetails 
                           teamId={s.teamId}
                           teamName={s.teamName}
                           matches={currentMatches || []}
                           submissions={currentSubmissions || []}
                           scoringRule={scoringRule!}
                           participants={participantsWithCalculatedKills}
                           primaryColor={primaryColor}
                           discipline={discipline}
                           totalPoints={s.totalPoints}
                           rank={s.rank}
                           tournamentMode={mode}
                         />
                      </td>
                    </motion.tr>
                  )}
                </AnimatePresence>
                </Fragment>
              )
            })}
          </AnimatePresence>
          {standings.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-white/40">
                Aún no hay posiciones registradas
              </td>
            </tr>
          )}
        </tbody>
      </table>
    )
  }

  const renderSplitStandings = () => {
    if (standings.length === 0) {
      return (
        <div className="py-16 text-center border border-dashed border-white/10 rounded-2xl w-full bg-dark-card/50">
          <p className="text-white/40 font-orbitron">Aún no hay posiciones registradas</p>
        </div>
      )
    }
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full relative">
        {/* Left Table: General Standings & Kills */}
        <div className="lg:col-span-5 bg-dark-card/75 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
            <span className="font-orbitron font-bold text-xs text-white uppercase tracking-widest">Puntuación y Bajas</span>
            <button 
              onClick={() => setIsTableMaximized(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/50 text-[10px] uppercase font-bold rounded-lg border border-white/5 transition-all"
            >
              <svg className="w-3 h-3 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Maximizar
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5 text-[10px] text-white/40 uppercase tracking-widest font-semibold">
                  <th className="px-4 py-3 w-16 text-center">Rank</th>
                  <th className="px-4 py-3">Equipo</th>
                  <th className="px-4 py-3 text-center">PTS</th>
                  {isShooter && <th className="px-4 py-3 text-center">Kills</th>}
                </tr>
              </thead>
              <tbody>
                {standings.map((s, idx) => (
                  <tr 
                    key={s.teamId} 
                    className={`border-b border-white/5 hover:bg-white/[0.04] transition-colors cursor-pointer ${
                      expandedTeamId === s.teamId ? 'bg-white/[0.03]' : ''
                    }`}
                    onClick={() => setExpandedTeamId(expandedTeamId === s.teamId ? null : s.teamId)}
                  >
                    <td className="px-4 py-3.5 text-center font-orbitron font-black text-sm" style={{ color: (idx+1) === 1 ? '#FFD700' : (idx+1) === 2 ? '#C0C0C0' : (idx+1) === 3 ? '#CD7F32' : 'rgba(255,255,255,0.4)' }}>
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        {s.avatarUrl ? (
                          <img src={s.avatarUrl} alt="" className="w-7 h-7 rounded-lg object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold">
                            {s.teamName.substring(0, 1)}
                          </div>
                        )}
                        <span className="font-orbitron font-bold text-xs truncate max-w-[120px]">{s.teamName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center font-orbitron font-black text-sm text-neon-cyan">
                      {s.totalPoints}
                    </td>
                    {isShooter && (
                      <td className="px-4 py-3.5 text-center font-orbitron font-bold text-xs text-white/80">
                        {s.totalKills}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Center Space: Empty for branding */}
        <div className="hidden lg:block lg:col-span-2 min-h-[100px]" />

        {/* Right Table: Details & Ratios */}
        <div className="lg:col-span-5 bg-dark-card/75 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02]">
            <span className="font-orbitron font-bold text-xs text-white uppercase tracking-widest">Estadísticas de Rendimiento</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5 text-[10px] text-white/40 uppercase tracking-widest font-semibold">
                  <th className="px-4 py-3 w-16 text-center">Rank</th>
                  <th className="px-4 py-3">Equipo</th>
                  {potTopEnabled && <th className="px-4 py-3 text-center">Top 1</th>}
                  {killRateEnabled && <th className="px-4 py-3 text-center">Kill Rate</th>}
                </tr>
              </thead>
              <tbody>
                {standings.map((s, idx) => (
                  <tr 
                    key={s.teamId} 
                    className={`border-b border-white/5 hover:bg-white/[0.04] transition-colors cursor-pointer ${
                      expandedTeamId === s.teamId ? 'bg-white/[0.03]' : ''
                    }`}
                    onClick={() => setExpandedTeamId(expandedTeamId === s.teamId ? null : s.teamId)}
                  >
                    <td className="px-4 py-3.5 text-center font-orbitron font-black text-sm" style={{ color: (idx+1) === 1 ? '#FFD700' : (idx+1) === 2 ? '#C0C0C0' : (idx+1) === 3 ? '#CD7F32' : 'rgba(255,255,255,0.4)' }}>
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        {s.avatarUrl ? (
                          <img src={s.avatarUrl} alt="" className="w-7 h-7 rounded-lg object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold">
                            {s.teamName.substring(0, 1)}
                          </div>
                        )}
                        <span className="font-orbitron font-bold text-xs truncate max-w-[120px]">{s.teamName}</span>
                      </div>
                    </td>
                    {potTopEnabled && (
                      <td className="px-4 py-3.5 text-center font-orbitron font-bold text-xs text-gold">
                        {s.potTopCount}
                      </td>
                    )}
                    {killRateEnabled && (
                      <td className="px-4 py-3.5 text-center font-mono text-xs text-white/60">
                        {s.killRate.toFixed(1)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Shared helper: fetch all teams + standings and rebuild the standings state.
  // Used by both Realtime subscriptions so the merge logic is not duplicated.
  const refreshStandingsFromDB = React.useCallback(async () => {
    const [
      { data: standingsData }, 
      { data: teamsData },
      { data: subsData },
      { data: matchesData }
    ] = await Promise.all([
      supabase
        .from('team_standings')
        .select('*')
        .eq('tournament_id', tournamentId),
      supabase
        .from('teams')
        .select('id, name, avatar_url, stream_url, participants(id, team_id, display_name, avatar_url, stream_url, is_captain, total_kills, kd_ratio, avg_kills, classification_rank, br_avg_placement, color)')
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: true }),
      supabase
        .from('submissions')
        .select('*, evidence_files(*)')
        .eq('tournament_id', tournamentId)
        .order('submitted_at', { ascending: false }),
      supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('match_number', { ascending: true })
    ])

    if (!teamsData) return

    // 1. Normalización de Partidas (Matches)
    const normalizedMatches = (matchesData || []).map((m: any) => ({
      ...m,
      matchNumber: m.match_number,
      isCompleted: m.is_completed,
      isWarmup: m.is_warmup,
      roundNumber: m.round_number,
      parentMatchId: m.parent_match_id,
      mapName: m.map_name,
      createdAt: m.created_at
    }))

    // 2. Normalización de Envíos (Submissions)
    const normalizedSubmissions = (subsData || []).map((s: any) => ({
      ...s,
      tournamentId: s.tournament_id,
      teamId: s.team_id,
      matchId: s.match_id,
      submittedBy: s.submitted_by,
      killCount: s.kill_count,
      potTop: s.pot_top,
      submittedAt: s.submitted_at,
      playerKills: s.player_kills,
      aiStatus: s.ai_status,
      aiConfidence: s.ai_confidence,
      evidenceFiles: (s.evidence_files || []).map((f: any) => ({
        id: f.id,
        storagePath: f.storage_path,
        mimeType: f.mime_type,
        fileSize: f.file_size
      }))
    }))

    // 3. Normalización de Equipos y Participantes
    const normalizedTeams = teamsData.map((t: any) => ({
      ...t,
      avatarUrl: t.avatar_url,
      streamUrl: t.stream_url,
      participants: (t.participants || []).map((p: any) => ({
        id: p.id,
        teamId: p.team_id,
        displayName: p.display_name,
        avatarUrl: p.avatar_url,
        streamUrl: p.stream_url,
        isCaptain: p.is_captain,
        totalKills: Number(p.total_kills || 0),
        kdRatio:            p.kd_ratio            ?? undefined,
        avgKills:           p.avg_kills            ?? undefined,
        classificationRank: p.classification_rank  ?? undefined,
        brAvgPlacement:     p.br_avg_placement      ?? undefined,
        color:              p.color                 ?? undefined,
      }))
    }))

    // 4. Cáculo Dinámico de Posiciones (Single Source of Truth)
    const calculatedStandingsMap = new Map()
    
    // Inicializar mapa de equipos (asegura que todos aparezcan aunque tengan 0 bajas/puntos)
    normalizedTeams.forEach((t: any) => {
      calculatedStandingsMap.set(t.id, {
        teamId: t.id,
        teamName: t.name,
        avatarUrl: t.avatarUrl,
        streamUrl: t.streamUrl,
        totalPoints: 0,
        totalKills: 0,
        potTopCount: 0,
        submissionsCount: 0,
        participants: t.participants || []
      })
    })

    // Agregación de envíos aprobados
    normalizedSubmissions
      .filter(s => s.status === 'approved')
      .forEach(s => {
        const stats = calculatedStandingsMap.get(s.teamId)
        if (stats) {
          const killPts = (s.killCount || 0) * (scoringRule?.killPoints || 0)
          const placementPts = s.rank && scoringRule?.placementPoints 
            ? (scoringRule.placementPoints[String(s.rank)] || 0)
            : (s.potTop ? (scoringRule?.placementPoints?.[ '1'] || 0) : 0)
          
          stats.totalPoints += (killPts + placementPts)
          stats.totalKills += (s.killCount || 0)
          stats.submissionsCount += 1
          if (s.potTop || s.rank === 1) stats.potTopCount += 1
        }
      })

    const merged = Array.from(calculatedStandingsMap.values()).map((t: any) => {
      const killRate = t.submissionsCount > 0 ? (t.totalKills / t.submissionsCount) : 0
      
      // Intentamos recuperar el rango previo de la DB si existiera (opcional)
      const dbStanding = (standingsData || []).find((s: any) => s.team_id === t.teamId)

      const teamStreams: { name: string; url: string }[] = []
      if (t.streamUrl) teamStreams.push({ name: 'Equipo', url: t.streamUrl })
      if (t.participants) {
        t.participants.forEach((p: any) => {
          if (p.streamUrl) teamStreams.push({ name: p.displayName, url: p.streamUrl })
        })
      }

      return {
        ...t,
        streams: teamStreams,
        killRate,
        rank: dbStanding ? dbStanding.rank : 999, // Se recalculará en el sort siguiente
        previousRank: dbStanding ? dbStanding.previous_rank : 999
      }
    }).sort((a: any, b: any) => {
      // Ordenamiento Dinámico: Puntos > Kills > Victorias > Nombre
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
      if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills
      if (b.potTopCount !== a.potTopCount) return b.potTopCount - a.potTopCount
      return a.teamName.localeCompare(b.teamName)
    }).map((t, index) => ({
      ...t,
      rank: index + 1 // Asignamos el rango dinámico real
    }))

    setStandings(merged)
    setCurrentTeams(normalizedTeams)
    setCurrentSubmissions(normalizedSubmissions)
    setCurrentMatches(normalizedMatches)
  }, [tournamentId, supabase])
 
  useEffect(() => {
    refreshStandingsFromDB()
  }, [refreshStandingsFromDB])

  useEffect(() => {
    // Subscribe to team_standings changes (score updates)
    const standingsChannel = supabase
      .channel(`standings:${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_standings', filter: `tournament_id=eq.${tournamentId}` },
        () => refreshStandingsFromDB()
      )
      .subscribe()

    // Subscribe to teams changes (new team added / team deleted / team renamed)
    // Without this subscription, a newly-created team only becomes visible on next
    // full page reload — it never triggers a standings event.
    const teamsChannel = supabase
      .channel(`teams:${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: `tournament_id=eq.${tournamentId}` },
        () => refreshStandingsFromDB()
      )
      .subscribe()

    // Subscribe to participants changes (individual kills)
    const participantsChannel = supabase
      .channel(`participants:${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants' },
        () => {
          console.log('[REALTIME] Participant stats updated, refreshing...')
          refreshStandingsFromDB()
        }
      )
      .subscribe()

    // Subscribe to theme changes
    const themeChannel = supabase
      .channel(`theme:${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leaderboard_themes', filter: `tournament_id=eq.${tournamentId}` },
        (payload: any) => {
          console.log('[REALTIME] Theme updated:', payload.new)
          setCurrentTheme(payload.new)
        }
      )
      .subscribe()

    // Subscribe to tournament status/champion updates
    const tournamentChannel = supabase
      .channel(`tournament:${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${tournamentId}` },
        (payload: any) => {
          console.log('[REALTIME] Tournament metadata updated:', payload.new)
          if (payload.new.status) setCurrentStatus(payload.new.status)
          if (payload.new.champion_image_url !== undefined) {
             setCurrentChampionImg(payload.new.champion_image_url)
          }
          if (payload.new.total_live_viewers !== undefined) {
             setCurrentLiveViewers(payload.new.total_live_viewers || 0)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(standingsChannel)
      supabase.removeChannel(teamsChannel)
      supabase.removeChannel(participantsChannel)
      supabase.removeChannel(themeChannel)
      supabase.removeChannel(tournamentChannel)
    }
  }, [tournamentId, supabase, refreshStandingsFromDB])

  const isVideoBackground = activeBackground?.toLowerCase().match(/\.(mp4|webm|ogg)$/)
  
  // YouTube Detection
  const youtubeId = activeBackground?.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w\-]{11})/)?.[1]
  
  // Twitch Detection
  const twitchUser = activeBackground?.match(/(?:twitch\.tv\/)([\w\-]+)/)?.[1]

  // Kick Detection
  const kickUser = activeBackground?.match(/(?:kick\.com\/)([\w\-]+)/)?.[1]

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/10 border-t-neon-cyan rounded-full animate-spin" />
      </div>
    )
  }


  const handleWatchTeam = (streamUrl: string) => {
    setWatchingStream(streamUrl)
  }

  const renderStreamPlayer = (url: string) => {
    const ytId = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w\-]{11})/)?.[1]
    const twitchU = url.match(/(?:twitch\.tv\/)([\w\-]+)/)?.[1]
    const kickU = url.match(/(?:kick\.com\/)([\w\-]+)/)?.[1]

    if (ytId) return <iframe src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0`} className="w-full h-full border-0" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
    if (twitchU) return <iframe src={`https://player.twitch.tv/?channel=${twitchU}&parent=${host}&autoplay=true`} className="w-full h-full border-0" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
    if (kickU) return <iframe src={`https://player.kick.com/${kickU}?autoplay=true`} className="w-full h-full border-0" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
    
    return <div className="flex items-center justify-center h-full text-white/40">URL de stream no soportada</div>
  }

  return (
    <>
      {/* ── Background Handler (Root Level) ─────────────────────────── */}
      {activeBackground && (
        <div className="fixed inset-0 w-full h-full -z-10 overflow-hidden pointer-events-none">
          {youtubeId ? (
            <div 
              className="absolute top-1/2 left-1/2 min-w-full min-h-full w-[177.77vh] h-[56.25vw] -translate-x-1/2 -translate-y-1/2"
              style={{ opacity: (currentTheme?.background_opacity ?? 40) / 100 }}
            >
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&modestbranding=1&rel=0&showinfo=0&privacy_mode=1`}
                className="w-full h-full border-0 pointer-events-none scale-[1.05]"
                allow="autoplay; encrypted-media"
              />
            </div>
          ) : (
            <>
              {twitchUser ? (
                <div 
                  className="absolute top-1/2 left-1/2 min-w-full min-h-full w-[177.77vh] h-[56.25vw] -translate-x-1/2 -translate-y-1/2"
                  style={{ opacity: (currentTheme?.background_opacity ?? 40) / 100 }}
                >
                  <iframe
                    src={`https://player.twitch.tv/?channel=${twitchUser}&parent=${host}&muted=true&autoplay=true&controls=false`}
                    className="w-full h-full border-0 pointer-events-none scale-[1.05]"
                    allowFullScreen
                  />
                </div>
              ) : kickUser ? (
                <div 
                  className="absolute top-1/2 left-1/2 min-w-full min-h-full w-[177.77vh] h-[56.25vw] -translate-x-1/2 -translate-y-1/2"
                  style={{ opacity: (currentTheme?.background_opacity ?? 40) / 100 }}
                >
                  <iframe
                    src={`https://player.kick.com/${kickUser}?muted=true&autoplay=true`}
                    className="w-full h-full border-0 pointer-events-none scale-[1.1]"
                  />
                </div>
              ) : isVideoBackground ? (
                <video 
                  key={activeBackground}
                  src={activeBackground} 
                  autoPlay loop muted playsInline 
                  className="w-full h-full object-cover block absolute inset-0" 
                  style={{ opacity: (currentTheme?.background_opacity ?? 40) / 100 }}
                />
              ) : (
                <div 
                  key={activeBackground}
                  className="w-full h-full bg-cover bg-center block" 
                  style={{ 
                    backgroundImage: `url(${activeBackground})`,
                    opacity: (currentTheme?.background_opacity ?? 40) / 100 
                  }} 
                />
              )}
            </>
          )}
          {/* Subtle vignette for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
        </div>
      )}

      {/* ── Main UI Content (With Glow Effect) ──────────────────────── */}
      <div 
        className="w-full max-w-7xl mx-auto p-4 md:p-8 relative z-10 min-h-[90vh] flex flex-col justify-center py-10"
        style={{ 
          filter: `drop-shadow(0 0 50px ${primaryColor}15)`,
        }}
      >
        {/* Stream Modal */}
        <AnimatePresence>
          {watchingStream && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
              onClick={() => setWatchingStream(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="bg-dark-card w-full max-w-5xl aspect-video rounded-2xl overflow-hidden border border-white/10 relative"
                onClick={e => e.stopPropagation()}
              >
                <div className="absolute top-4 right-4 z-10 flex gap-2">
                  <a
                    href={watchingStream}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-neon-cyan/20 hover:bg-neon-cyan/40 text-neon-cyan rounded-lg transition-colors text-sm font-medium border border-neon-cyan/50 backdrop-blur-md flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    Ver en sitio original
                  </a>
                  <button 
                    onClick={() => setWatchingStream(null)}
                    className="p-2 bg-black/50 hover:bg-black/80 rounded-lg text-white/50 hover:text-white transition-all backdrop-blur-md border border-white/10"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                {renderStreamPlayer(watchingStream)}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center mb-12 flex flex-col items-center">
          {logoUrl && !hideLogoInLeaderboard ? (
            <div className="mb-6">
              <img 
                src={logoUrl} 
                alt={tournamentName} 
                className="max-h-32 md:max-h-48 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]" 
              />
              <h1 className="sr-only">{tournamentName}</h1>
            </div>
          ) : (
            <h1 className="font-orbitron font-bold text-2xl sm:text-4xl md:text-5xl uppercase tracking-wider mb-4 px-4"
                style={{ color: primaryColor, textShadow: `0 0 20px ${primaryColor}40` }}>
              {tournamentName}
            </h1>
          )}

          {description && <p className="text-white/60 text-lg max-w-2xl mx-auto">{description}</p>}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
            {currentStatus === 'draft' && (
              <span className="text-xs font-bold bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full text-white/50 uppercase tracking-widest">
                Pre-torneo
              </span>
            )}
            {currentStatus === 'active' && (
              <span className="text-xs font-bold bg-red-500/10 border border-red-500/20 px-3.5 py-1.5 rounded-full text-red-400 uppercase tracking-widest animate-pulse flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                ● En Vivo
              </span>
            )}
            {currentStatus === 'pending' && (
              <span className="text-xs font-bold bg-green-500/10 border border-green-500/20 px-3.5 py-1.5 rounded-full text-green-400 uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Inscripciones Abiertas
              </span>
            )}
            {currentStatus === 'finished' && (
              <span className="text-xs font-bold bg-gold/10 border border-gold/20 px-3.5 py-1.5 rounded-full text-gold uppercase tracking-widest flex items-center gap-1.5">
                <span>🏆</span> Torneo Finalizado
              </span>
            )}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-black uppercase tracking-widest text-white/70">
              <span className={`w-1.5 h-1.5 rounded-full ${currentLiveViewers > 0 ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
              <span>
                {currentLiveViewers > 0 
                  ? `${currentLiveViewers.toLocaleString()} Espectadores` 
                  : '0 Espectadores'
                }
              </span>
            </div>
            {clashRoyaleTag && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full text-xs font-black uppercase tracking-widest text-blue-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <span>Clash Royale ({clashRoyaleTag})</span>
                </div>
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  title="Actualizar marcador desde Clash Royale"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/30 border border-blue-500/30 hover:border-blue-500/60 rounded-full text-xs font-black uppercase tracking-widest text-blue-300 hover:text-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSyncing ? (
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  {syncStatus ?? 'Actualizar'}
                </button>
              </div>
            )}
          </div>
          {currentStatus === 'finished' && (
            <div className="flex flex-col items-center gap-4 mt-6">
              <button
                onClick={() => setShowHallOfFame(true)}
                className="group relative flex items-center gap-3 px-8 py-4 rounded-2xl bg-gold/10 border border-gold/40 text-gold font-orbitron font-black text-base uppercase tracking-widest hover:bg-gold/20 hover:border-gold/60 transition-all shadow-[0_0_30px_rgba(255,215,0,0.15)] hover:shadow-[0_0_50px_rgba(255,215,0,0.25)] animate-pulse"
              >
                <div className="absolute inset-0 bg-gold/5 blur-xl group-hover:bg-gold/10 transition-colors rounded-2xl" />
                <span className="relative flex items-center gap-3 text-2xl">🏆</span>
                <span className="relative">Salón de la Fama</span>
              </button>
            </div>
          )}
          {currentStatus !== 'finished' && currentChampionImg && (
            <button
              onClick={() => setShowHallOfFame(true)}
              className="mt-6 group relative flex items-center gap-3 px-6 py-3 rounded-2xl bg-gold/10 border border-gold/30 text-gold font-orbitron font-black text-sm uppercase tracking-widest hover:bg-gold/20 hover:border-gold/50 transition-all shadow-[0_0_20px_rgba(255,215,0,0.1)] hover:shadow-[0_0_30px_rgba(255,215,0,0.2)]"
            >
              <div className="absolute inset-0 bg-gold/5 blur-xl group-hover:bg-gold/10 transition-colors rounded-2xl" />
              <span className="relative flex items-center gap-2">
                <span className="text-lg">🏆</span>
                Salón de la Fama
              </span>
            </button>
          )}

          {/* Registration Section */}
          {(currentStatus === 'pending' || currentStatus === 'active') && (() => {
            const totalTeamsRegistered = currentTeams.length
            const isFull = maxTeams ? totalTeamsRegistered >= maxTeams : false
            
            const now = new Date()
            const regStart = registrationStartDate ? new Date(registrationStartDate) : null
            const regEnd = registrationEndDate ? new Date(registrationEndDate) : null
            const tourneyStart = startDate ? new Date(startDate) : null
            const totalPrize = (prize1st || 0) + (prize2nd || 0) + (prize3rd || 0) + (prizeMvp || 0)

            const hasRegStarted = regStart ? now >= regStart : true
            const hasRegEnded = regEnd ? now > regEnd : false
            const isRegistrationOpen = hasRegStarted && !hasRegEnded

            const formatDate = (date: Date) => {
              return date.toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            }

            return (
              <div className="mt-8 p-6 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md max-w-2xl mx-auto flex flex-col md:flex-row items-center gap-6 w-full text-left relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/5 to-neon-purple/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {/* Logo & Mode Section */}
                {logoUrl && !hideLogoInLeaderboard && (
                  <div className="shrink-0 relative w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center shadow-inner">
                    <img 
                      src={logoUrl} 
                      alt={tournamentName} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="flex-1 min-w-0 z-10 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-orbitron font-bold text-base text-white uppercase tracking-wider">Inscripción al Torneo</h3>
                    {isPrivate && (
                      <span className="text-[9px] bg-neon-purple/20 text-neon-purple font-bold px-2 py-0.5 rounded border border-neon-purple/30 uppercase tracking-wide flex items-center gap-1">
                        <span>🔒</span> Privado
                      </span>
                    )}
                    <span className="text-[9px] bg-neon-cyan/20 text-neon-cyan font-bold px-2 py-0.5 rounded border border-neon-cyan/30 uppercase tracking-wide">
                      {mode.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-white/60 text-xs mt-1.5 leading-relaxed">
                    {isUserRegistered 
                      ? '¡Ya estás inscrito en este torneo! Revisa tu equipo en la pestaña de Participantes.'
                      : `Regístrate para competir en la modalidad de ${mode.toUpperCase()} (${format.replace(/_/g, ' ').toUpperCase()}).`
                    }
                  </p>

                  {/* Dates / Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-[11px] text-white/40">
                    {regStart && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-neon-cyan">📅</span>
                        <span>
                          <strong>Inscripciones:</strong> {formatDate(regStart)}
                        </span>
                      </div>
                    )}
                    {regEnd && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-neon-purple">⏳</span>
                        <span>
                          <strong>Cierre:</strong> {formatDate(regEnd)}
                        </span>
                      </div>
                    )}
                    {tourneyStart && (
                      <div className="flex items-center gap-1.5 sm:col-span-2">
                        <span className="text-gold">🚀</span>
                        <span>
                          <strong>Inicio del Torneo:</strong> {formatDate(tourneyStart)}
                        </span>
                      </div>
                    )}
                    {totalPrize > 0 && (
                      <div className="flex items-center gap-1.5 sm:col-span-2 text-gold font-bold mt-1">
                        <span>💰</span>
                        <span>
                          <strong>Premio total:</strong> ${totalPrize.toLocaleString('es-ES')} USD 
                          <span className="text-[9px] text-white/40 font-normal ml-2">
                            (1º: ${prize1st} | 2º: ${prize2nd} | 3º: ${prize3rd} {prizeMvp > 0 && `| MVP: $${prizeMvp}`})
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-neon-cyan text-[10px] font-bold uppercase tracking-widest mt-3">
                    {maxTeams ? `Cupos: ${totalTeamsRegistered} / ${maxTeams} Equipos` : `Inscritos: ${totalTeamsRegistered} Equipos`}
                  </p>
                </div>

                <div className="shrink-0 w-full md:w-auto text-right z-10">
                  {isUserRegistered ? (
                    <span className="inline-block w-full md:w-auto text-center text-xs font-bold bg-green-500/20 text-green-400 px-5 py-3 rounded-xl border border-green-500/30 uppercase tracking-wider">
                      ✓ Inscrito
                    </span>
                  ) : !hasRegStarted ? (
                    <span className="inline-block w-full md:w-auto text-center text-xs font-bold bg-white/10 text-white/40 px-5 py-3 rounded-xl border border-white/5 uppercase tracking-wider">
                      Próximamente
                    </span>
                  ) : hasRegEnded ? (
                    <span className="inline-block w-full md:w-auto text-center text-xs font-bold bg-red-500/10 text-red-400 px-5 py-3 rounded-xl border border-red-500/20 uppercase tracking-wider">
                      Registro Cerrado
                    </span>
                  ) : isFull ? (
                    <span className="inline-block w-full md:w-auto text-center text-xs font-bold bg-red-500/10 text-red-400 px-5 py-3 rounded-xl border border-red-500/20 uppercase tracking-wider">
                      🚫 Cupos Llenos
                    </span>
                  ) : currentUser ? (
                    <button
                      onClick={handleOpenRegistration}
                      className="w-full md:w-auto px-6 py-3 bg-neon-cyan hover:bg-neon-cyan/90 active:scale-95 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(0,245,255,0.2)] hover:shadow-[0_0_35px_rgba(0,245,255,0.35)]"
                    >
                      Inscribirse Ahora
                    </button>
                  ) : (
                    <Link
                      href={`/login?redirectTo=/t/${slug}`}
                      className="inline-block w-full text-center px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-white/10"
                    >
                      Inicia Sesión
                    </Link>
                  )}
                </div>
              </div>
            )
          })()}
        </div>

      {/* Tabs — scrollable on mobile */}
      <div className="flex gap-1 mb-6 sm:mb-8 sm:justify-center overflow-x-auto pb-1 px-2 sm:px-0 scrollbar-hide">
        <button
          onClick={() => setActiveTab('ranking')}
          className={`shrink-0 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-orbitron text-xs sm:text-sm transition-all shadow-lg ${
            activeTab === 'ranking' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'
          }`}
          style={{ borderColor: activeTab === 'ranking' ? primaryColor : 'transparent', borderWidth: 1 }}
        >
          Posiciones
        </button>
        <button
          onClick={() => setActiveTab('participants')}
          className={`shrink-0 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-orbitron text-xs sm:text-sm transition-all shadow-lg ${
            activeTab === 'participants' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'
          }`}
          style={{ borderColor: activeTab === 'participants' ? primaryColor : 'transparent', borderWidth: 1 }}
        >
          Participantes
        </button>
        <button
          onClick={() => setActiveTab('matches')}
          className={`shrink-0 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-orbitron text-xs sm:text-sm transition-all shadow-lg ${
            activeTab === 'matches' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'
          }`}
          style={{ borderColor: activeTab === 'matches' ? primaryColor : 'transparent', borderWidth: 1 }}
        >
          Partidas
        </button>
        <button
          onClick={() => setActiveTab('statistics')}
          className={`shrink-0 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-orbitron text-xs sm:text-sm transition-all shadow-lg ${
            activeTab === 'statistics' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'
          }`}
          style={{ borderColor: activeTab === 'statistics' ? primaryColor : 'transparent', borderWidth: 1 }}
        >
          Estadísticas
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`shrink-0 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-orbitron text-xs sm:text-sm transition-all shadow-lg ${
            activeTab === 'rules' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'
          }`}
          style={{ borderColor: activeTab === 'rules' ? primaryColor : 'transparent', borderWidth: 1 }}
        >
          Reglas
        </button>
      </div>

      {activeTab === 'ranking' ? (
        currentTheme?.preset_name === 'split' ? (
          renderSplitStandings()
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-9 bg-dark-card/80 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                <span className="font-orbitron font-bold text-xs sm:text-sm text-white uppercase tracking-wider">Tabla de Posiciones</span>
                <button 
                  onClick={() => setIsTableMaximized(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all text-xs border border-white/5 font-semibold"
                >
                  <svg className="w-3.5 h-3.5 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  Maximizar Vista
                </button>
              </div>
              <div className="overflow-x-auto">
                {renderStandingsTable()}
              </div>
            </div>
            <div className="lg:col-span-3 lg:sticky lg:top-24 space-y-6">
              <AdPlacement banners={adBanners || []} slotName="leaderboard_sidebar" tournamentId={tournamentId} />
            </div>
          </div>
        )
      ) : activeTab === 'participants' ? (
        <div className="space-y-4">
          {(!currentTeams || currentTeams.length === 0) ? (
            <div className="py-16 text-center border border-dashed border-white/10 rounded-2xl">
              <p className="text-white/40">No hay participantes registrados aún</p>
            </div>
          ) : (
            currentTeams.map((team: any) => (
              <div key={team.id} className="bg-dark-card/80 backdrop-blur-md border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {team.avatarUrl ? (
                      <img src={team.avatarUrl} alt={team.name} className="w-10 h-10 rounded-xl object-cover border border-white/10" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg">🎮</div>
                    )}
                    <h3 className="font-orbitron font-bold text-white text-lg">{team.name}</h3>
                  </div>
                  {/* Team stream buttons */}
                  <div className="flex gap-2">
                    {team.streamUrl && (
                      <>
                        <button
                          onClick={() => handleWatchTeam(team.streamUrl)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold hover:bg-red-600/30 transition-all"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          Ver en app
                        </button>
                        <a
                          href={team.streamUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-white/60 rounded-lg text-xs font-medium hover:bg-white/10 transition-all"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          Ir al canal
                        </a>
                      </>
                    )}
                  </div>
                </div>
                {/* Participants list */}
                {team.participants && team.participants.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {team.participants.map((p: any) => {
                      const hasStats = p.kdRatio != null || p.avgKills != null || p.classificationRank || p.brAvgPlacement != null
                      return (
                      <div key={p.id} className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          {p.avatarUrl ? (
                            <img src={p.avatarUrl} alt="" className="w-9 h-9 rounded-lg object-contain shrink-0" style={{ background: 'transparent' }} />
                          ) : (
                            <div className={`w-2 h-2 rounded-full shrink-0 ${p.streamUrl ? 'bg-red-500 animate-pulse' : 'bg-white/20'}`} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm text-white/80 truncate">{p.displayName}</span>
                              {p.isCaptain && <span className="text-[9px] font-bold text-neon-cyan uppercase tracking-wider border border-neon-cyan/30 px-1 py-0.5 rounded shrink-0">Cap</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isShooter && (
                              <div className="text-right">
                                <span className="text-xs font-orbitron font-bold text-white block leading-none">{calculatedKillsLookup[p.id] || 0}</span>
                                <span className="text-[7px] text-white/30 uppercase font-black tracking-tighter">Kills</span>
                              </div>
                            )}
                            {p.streamUrl && (
                              <div className="flex gap-1">
                                <button onClick={() => handleWatchTeam(p.streamUrl)} title="Ver stream" className="p-1 bg-red-600/20 hover:bg-red-600/40 rounded text-red-400 transition-colors">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                </button>
                                <a href={p.streamUrl} target="_blank" rel="noreferrer" className="p-1 bg-white/5 hover:bg-white/10 rounded text-white/40 transition-colors">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        {isShooter && hasStats && (
                          <div className="grid grid-cols-4 divide-x divide-white/5 border-t border-white/5">
                            {p.kdRatio != null && (
                              <div className="px-2 py-1.5 text-center">
                                <p className="text-[7px] text-white/30 uppercase font-bold tracking-wider">K/D</p>
                                <p className="text-[11px] font-black text-neon-cyan font-orbitron">{Number(p.kdRatio).toFixed(2)}</p>
                              </div>
                            )}
                            {p.avgKills != null && (
                              <div className="px-2 py-1.5 text-center">
                                <p className="text-[7px] text-white/30 uppercase font-bold tracking-wider">AVG K</p>
                                <p className="text-[11px] font-black text-purple-400 font-orbitron">{Number(p.avgKills).toFixed(1)}</p>
                              </div>
                            )}
                            {p.classificationRank && (
                              <div className="px-2 py-1.5 text-center">
                                <p className="text-[7px] text-white/30 uppercase font-bold tracking-wider">RANGO</p>
                                <p className="text-[9px] font-black text-yellow-400 font-orbitron truncate">{p.classificationRank}</p>
                              </div>
                            )}
                            {p.brAvgPlacement != null && (
                              <div className="px-2 py-1.5 text-center">
                                <p className="text-[7px] text-white/30 uppercase font-bold tracking-wider">BR</p>
                                <p className="text-[11px] font-black text-white/60 font-orbitron">#{Number(p.brAvgPlacement).toFixed(0)}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )})}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'statistics' ? (
        <div className="space-y-6">
          {/* Top Fragger Hero Section (Individual) */}
          {topFraggers.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-6 bg-dark-card/30 border border-white/5 rounded-3xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />
                <div className="flex flex-col items-center gap-2">
                  <h2 className={`${orbitron.className} text-xl font-black text-neon-cyan uppercase tracking-widest flex items-center gap-3`}>
                    <span className="p-1 px-2 rounded bg-neon-cyan/20 text-[10px] sm:text-xs font-sans">Individual</span>
                    Top Fragger MVP
                  </h2>
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />
              </div>

              <div className="flex flex-wrap justify-center gap-4">
                {topFraggers.slice(0, 3).map((player, idx) => (
                  <motion.div
                    key={player.id}
                    whileHover={{ scale: 1.02, y: -5 }}
                    className={`relative group bg-dark-card/40 backdrop-blur-xl border rounded-2xl p-3.5 mb-2 overflow-hidden transition-all duration-300 w-full md:w-[calc(50%-1rem)] lg:w-[calc(33.33%-1rem)] max-w-sm ${
                      idx === 0 ? 'border-neon-cyan/50 shadow-[0_0_20px_rgba(0,245,255,0.15)]' : 'border-white/5'
                    }`}
                  >
                    {/* Accent background */}
                    <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full blur-3xl opacity-10 ${
                      idx === 0 ? 'bg-neon-cyan' : 'bg-neon-purple'
                    }`} />

                    <div className="flex items-center gap-3 relative z-10">
                      <div className="relative">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl border ${
                          idx === 0 ? 'bg-neon-cyan/10 border-neon-cyan/40' : 'bg-white/5 border-white/10'
                        }`}>
                          {idx === 0 ? '👑' : idx === 1 ? '🥈' : '🥉'}
                        </div>
                        {idx === 0 && (
                          <div className="absolute -top-1.5 -left-1.5 bg-neon-cyan text-black font-black text-[8px] px-1.5 py-0.5 rounded-full animate-bounce">
                            MVP
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-orbitron font-bold text-white text-base truncate group-hover:text-neon-cyan transition-colors">
                          {player.displayName}
                        </h4>
                        <p className="text-white/40 text-[10px] truncate uppercase tracking-tighter">Equipo: {(player as any).teamName}</p>
                      </div>

                      <div className="text-right">
                        <div className="text-xl font-black text-white leading-none">{(player as any).totalKills || 0}</div>
                        <div className="text-[9px] font-bold text-white/30 uppercase tracking-tighter">Kills</div>
                      </div>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-white/5 flex items-center justify-between gap-3">
                      {player.streamUrl ? (
                        <button
                          onClick={() => handleWatchTeam(player.streamUrl!)}
                          className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-red-600/20 border border-red-500/20 text-red-400 rounded-lg text-[10px] font-bold hover:bg-red-600/30 transition-all group/btn"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          Live Stream
                          <svg className="w-2.5 h-2.5 group-hover/btn:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </button>
                      ) : (
                        <div className="flex-1 py-1.5 text-center text-[9px] text-white/10 font-bold uppercase tracking-widest border border-dashed border-white/5 rounded-lg">
                          Offline
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {standings.map((team, idx) => (
                <div 
                  key={team.teamId}
                  className={`group relative overflow-hidden rounded-2xl border transition-all cursor-pointer ${
                    expandedTeamId === team.teamId 
                      ? 'border-neon-cyan bg-white/[0.05] ring-1 ring-neon-cyan/20' 
                      : 'border-white/5 bg-white/[0.02] hover:border-white/20'
                  }`}
                  onClick={() => setExpandedTeamId(expandedTeamId === team.teamId ? null : team.teamId)}
                >
                  <div className="p-6 flex items-center justify-between relative z-10">
                     <div className="flex items-center gap-4">
                        <div className="relative">
                           <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 overflow-hidden shadow-inner">
                              {team.avatarUrl ? (
                                <img src={team.avatarUrl} alt={team.teamName} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xl bg-gradient-to-br from-white/5 to-transparent">🛡️</div>
                              )}
                           </div>
                           <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-[10px] font-black text-white">
                              {idx + 1}
                           </div>
                        </div>
                        <div>
                           <h4 className="font-orbitron font-bold text-white group-hover:text-neon-cyan transition-colors truncate max-w-[150px]">{team.teamName}</h4>
                           <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">Analizar Equipo</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <div className="text-xl font-black text-white leading-none">{team.totalPoints}</div>
                        <div className="text-[8px] text-white/30 uppercase font-bold tracking-tighter">Puntos</div>
                     </div>
                  </div>
                  
                  {/* Small progress bar */}
                  <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-transparent via-neon-cyan to-transparent w-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
             ))}
          </div>

          <AnimatePresence>
            {expandedTeamId && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden bg-dark-card/50 backdrop-blur-xl border border-neon-cyan/20 rounded-[32px] shadow-2xl"
              >
                {standings
                  .filter(s => s.teamId === expandedTeamId)
                  .map(s => (
                    <TeamDetails
                      key={s.teamId}
                      teamId={s.teamId}
                      teamName={s.teamName}
                      matches={currentMatches}
                      submissions={currentSubmissions}
                      scoringRule={scoringRule!}
                      participants={participantsWithCalculatedKills}
                      primaryColor={primaryColor}
                      discipline={discipline}
                      totalPoints={s.totalPoints}
                      rank={s.rank}
                      tournamentMode={mode}
                    />
                  ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : activeTab === 'matches' ? (
        <MatchRecap 
          matches={currentMatches} 
          submissions={currentSubmissions} 
          participants={participantsWithCalculatedKills}
          primaryColor={primaryColor} 
        />
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-dark-card/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(0,245,255,0.1)]">
              📜
            </div>
            <div>
              <h2 className={`${orbitron.className} text-2xl font-black text-white uppercase tracking-tighter`}>
                Reglamento Oficial
              </h2>
              <p className="text-white/40 text-xs uppercase tracking-widest font-bold">Normativas y Conducta del Torneo</p>
            </div>
          </div>
          
          <div className="prose prose-invert max-w-none">
            {rulesText ? (
              <p className="text-white/70 leading-relaxed whitespace-pre-wrap font-sans text-base sm:text-lg bg-white/[0.02] p-6 rounded-2xl border border-white/5">
                {rulesText}
              </p>
            ) : (
              <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl">
                <p className="text-white/20 italic">No se han definido reglas específicas para este torneo aún.</p>
              </div>
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/[0.03] p-4 rounded-xl border border-white/5">
              <span className="text-[10px] font-black text-neon-cyan uppercase tracking-[0.2em] block mb-2">Formato de Juego</span>
              <span className="text-white font-orbitron font-bold text-sm uppercase">{format.replace(/_/g, ' ')}</span>
            </div>
            <div className="bg-white/[0.03] p-4 rounded-xl border border-white/5">
              <span className="text-[10px] font-black text-neon-cyan uppercase tracking-[0.2em] block mb-2">Estado del Torneo</span>
              <span className="text-white font-orbitron font-bold text-sm uppercase">{currentStatus}</span>
            </div>
          </div>
        </motion.div>
      )}
        <AnimatePresence>
          {showHallOfFame && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md"
              onClick={() => setShowHallOfFame(false)}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: 30 }}
                className="relative max-w-5xl w-full flex flex-col items-center"
                onClick={e => e.stopPropagation()}
              >
                {/* Decorative glow */}
                <div className="absolute -top-20 -z-10 w-64 h-64 bg-gold/20 rounded-full blur-[100px] animate-pulse" />

                <h2 className="font-orbitron font-black text-2xl sm:text-4xl text-gold mb-6 uppercase tracking-widest text-center flex flex-col items-center gap-2">
                  <span className="text-4xl sm:text-6xl drop-shadow-[0_0_20px_rgba(255,215,0,0.4)]">🏆</span>
                  Salón de la Fama
                  <div className="h-1 w-24 bg-gradient-to-r from-transparent via-gold to-transparent mt-2" />
                </h2>

                {/* Champion team name from standings rank 1 */}
                {standings[0] && (
                  <div className="flex flex-col items-center gap-3 mb-6">
                    <span className="text-xs font-bold text-gold/60 uppercase tracking-[0.3em]">Campeón</span>
                    <div className="flex items-center gap-4">
                      {standings[0].avatarUrl ? (
                        <img src={standings[0].avatarUrl} alt="" className="w-16 h-16 rounded-2xl object-cover border-2 border-gold/50 shadow-[0_0_20px_rgba(255,215,0,0.3)]" />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-gold/10 border-2 border-gold/30 flex items-center justify-center text-2xl font-black text-gold">
                          {standings[0].teamName?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-orbitron font-black text-3xl sm:text-5xl text-white drop-shadow-[0_0_15px_rgba(255,215,0,0.4)]">
                        {standings[0].teamName}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-white/60 font-orbitron mt-1">
                      {discipline === 'clash_royale' ? (
                        <span><b className="text-neon-cyan">{standings[0].totalPoints}</b> COPAS</span>
                      ) : (
                        <span><b className="text-neon-cyan">{standings[0].totalPoints}</b> PTS</span>
                      )}
                      {isShooter && (
                        <span><b className="text-white">{standings[0].totalKills}</b> KILLS</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Victory photo (if uploaded) */}
                {currentChampionImg && (
                  <div className="relative group p-1 bg-gradient-to-b from-gold/50 via-gold/10 to-transparent rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(255,215,0,0.15)]">
                    <img
                      src={currentChampionImg.startsWith('http')
                        ? currentChampionImg
                        : `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')}/storage/v1/object/public/evidences/${currentChampionImg.replace(/^evidences\//, '')}`}
                      alt="Foto de victoria"
                      className="max-h-[50vh] rounded-2xl object-contain shadow-2xl transition-transform duration-700 group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                  </div>
                )}

                <button
                  onClick={() => setShowHallOfFame(false)}
                  className="mt-8 px-8 py-3 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl font-bold text-sm transition-all border border-white/10 flex items-center gap-3 group"
                >
                  <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Volver al Marcador
                </button>
              </motion.div>
            </motion.div>
          )}
          {isTableMaximized && (
            <motion.div
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6 bg-black/45 backdrop-blur-xl overflow-y-auto"
              onClick={() => setIsTableMaximized(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="bg-dark-card/95 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] w-full max-w-6xl my-8 flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                <div 
                  className="flex justify-between items-center px-6 sm:px-8 py-5 border-b border-white/5 bg-white/[0.03]"
                  style={{ borderLeft: `4px solid ${primaryColor}` }}
                >
                  <div>
                    <h2 className="font-orbitron font-black text-lg sm:text-2xl text-white uppercase tracking-wider">
                      Clasificación General
                    </h2>
                    <p className="text-white/40 text-xs mt-0.5 uppercase tracking-widest font-semibold">
                      {tournamentName} • Vista Expandida
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsTableMaximized(false)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all text-sm border border-white/5 font-semibold group"
                  >
                    <span className="group-hover:rotate-90 transition-transform duration-300">✕</span>
                    Minimizar
                  </button>
                </div>
                <div className="overflow-x-auto p-4 sm:p-6 max-h-[75vh] overflow-y-auto">
                  {renderStandingsTable()}
                </div>
              </motion.div>
            </motion.div>
          )}
          {isRegistering && (
            <motion.div
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xl overflow-y-auto"
              onClick={() => setIsRegistering(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="bg-dark-card/95 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] w-full max-w-lg flex flex-col my-8"
                onClick={e => e.stopPropagation()}
              >
                <div 
                  className="flex justify-between items-center px-6 sm:px-8 py-5 border-b border-white/5 bg-white/[0.03]"
                  style={{ borderLeft: `4px solid ${primaryColor}` }}
                >
                  <div>
                    <h2 className="font-orbitron font-black text-lg sm:text-xl text-white uppercase tracking-wider">
                      Formulario de Inscripción
                    </h2>
                    <p className="text-white/40 text-xs mt-0.5 uppercase tracking-widest font-semibold">
                      Modalidad: {mode.toUpperCase()}
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsRegistering(false)}
                    className="p-2 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white rounded-lg transition-all border border-white/10"
                  >
                    ✕
                  </button>
                </div>
                <form onSubmit={handleRegisterSubmit} className="p-6 space-y-4">
                  {mode !== 'individual' && (
                    <div>
                      <label className="block text-xs text-white/60 uppercase tracking-widest font-bold mb-1.5 ml-1">
                        Nombre del Equipo
                      </label>
                      <input
                        required
                        type="text"
                        value={regTeamName}
                        onChange={e => setRegTeamName(e.target.value)}
                        placeholder="Ej. Los Reyes del Barrio"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-all"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-white/60 uppercase tracking-widest font-bold mb-1.5 ml-1">
                      Link de Stream (Opcional)
                    </label>
                    <input
                      type="url"
                      value={regStreamUrl}
                      onChange={e => setRegStreamUrl(e.target.value)}
                      placeholder="https://twitch.tv/tu_canal"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-all"
                    />
                  </div>

                  {isPrivate && (
                    <div>
                      <label className="block text-xs text-neon-purple uppercase tracking-widest font-bold mb-1.5 ml-1 flex items-center gap-1">
                        <span>🔒</span> Contraseña de Inscripción
                      </label>
                      <input
                        required
                        type="password"
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                        placeholder="Contraseña provista por el organizador"
                        className="w-full bg-black/40 border border-neon-purple/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-neon-purple/50 focus:ring-1 focus:ring-neon-purple/30 transition-all font-mono"
                      />
                    </div>
                  )}

                  <div className="space-y-3">
                    <label className="block text-xs text-white/60 uppercase tracking-widest font-bold mb-1 ml-1">
                      Integrantes ({regParticipants.length})
                    </label>
                    {regParticipants.map((name, idx) => (
                      <div key={idx}>
                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block mb-1.5 ml-1">
                          {idx === 0 ? 'Integrante 1 (Capitán / Tú)' : `Integrante ${idx + 1}`}
                        </span>
                        <input
                          required
                          type="text"
                          value={name}
                          onChange={e => {
                            const newParticipants = [...regParticipants]
                            newParticipants[idx] = e.target.value
                            setRegParticipants(newParticipants)
                          }}
                          placeholder={idx === 0 ? "Tu display name / GamerTag" : `Display Name Integrante ${idx + 1}`}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-all"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-white/5">
                    <button
                      type="submit"
                      disabled={regLoading}
                      className="flex-1 py-3 bg-neon-cyan hover:bg-neon-cyan/95 active:scale-95 text-black font-bold text-sm uppercase tracking-wider rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(0,245,255,0.15)]"
                    >
                      {regLoading ? 'Procesando Inscripción...' : 'Enviar Inscripción'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRegistering(false)}
                      className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-sm font-bold uppercase tracking-wider rounded-xl transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
