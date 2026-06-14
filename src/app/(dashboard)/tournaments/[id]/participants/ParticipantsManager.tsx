'use client'

import { useState, useRef } from 'react'
import type { Team, Participant, TournamentMode } from '@/types'
import { createTeam, addParticipant, deleteTeam, deleteParticipant, updateTeam, updateParticipant, uploadAvatar } from '@/lib/actions/participants'
import { toast } from 'sonner'

export function ParticipantsManager({
  tournamentId,
  tournamentSlug,
  tournamentMode,
  tournamentDiscipline = 'warzone',
  tournamentStatus = 'draft',
  initialTeams,
  initialParticipants,
}: {
  tournamentId: string
  tournamentSlug: string
  tournamentMode: TournamentMode
  tournamentDiscipline?: string
  tournamentStatus?: string
  initialTeams: Team[]
  initialParticipants: Participant[]
}) {
  const [teams, setTeams] = useState(initialTeams)
  const [participants, setParticipants] = useState(initialParticipants)
  const [isAdding, setIsAdding] = useState(false)
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set())
  
  const isLocked = tournamentStatus === 'active' || tournamentStatus === 'finished'
  const isShooter = !['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate', 'league_of_legends', 'valorant'].includes(tournamentDiscipline)
  
  const toggleTeamCollapse = (teamId: string) => {
    const newCollapsed = new Set(collapsedTeams)
    if (newCollapsed.has(teamId)) {
      newCollapsed.delete(teamId)
    } else {
      newCollapsed.add(teamId)
    }
    setCollapsedTeams(newCollapsed)
  }
  
  const isIndividual = tournamentMode === 'individual'
  const maxPerTeam = { individual: 1, duos: 2, trios: 3, cuartetos: 4, quintas: 5 }[tournamentMode]

  // Form states
  const [teamName, setTeamName] = useState('')
  const [streamUrl, setStreamUrl] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  // Add-player inline form
  const [addingPlayerTo, setAddingPlayerTo] = useState<string | null>(null)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerKd, setNewPlayerKd] = useState('')
  const [newPlayerAvgKills, setNewPlayerAvgKills] = useState('')
  const [newPlayerRank, setNewPlayerRank] = useState('')
  const [newPlayerBrPlacement, setNewPlayerBrPlacement] = useState('')
  const [addPlayerLoading, setAddPlayerLoading] = useState(false)

  // Edit-stats modal
  const [editingStats, setEditingStats] = useState<Participant | null>(null)
  const [editKd, setEditKd] = useState('')
  const [editAvgKills, setEditAvgKills] = useState('')
  const [editRank, setEditRank] = useState('')
  const [editBrPlacement, setEditBrPlacement] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editStreamUrl, setEditStreamUrl] = useState('')
  const [editStatsLoading, setEditStatsLoading] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentUploadRef = useRef<{ id: string, type: 'team' | 'participant' } | null>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isIndividual) {
        if (!playerName.trim()) throw new Error('El nombre es requerido')
        
        const tRes = await createTeam(tournamentId, { 
          name: playerName,
          streamUrl: streamUrl || undefined 
        })
        if ('error' in tRes) throw new Error(tRes.error)
        
        const pRes = await addParticipant(tournamentId, {
          displayName: playerName,
          teamId: tRes.data.id,
          isCaptain: true,
        })
        if ('error' in pRes) throw new Error(pRes.error)
        
        setTeams([...teams, tRes.data])
        setParticipants([...participants, pRes.data])
        setPlayerName('')
        setStreamUrl('')
      } else {
        if (!teamName.trim()) throw new Error('El nombre de equipo es requerido')
        
        const tRes = await createTeam(tournamentId, { 
          name: teamName,
          streamUrl: streamUrl || undefined
        })
        if ('error' in tRes) throw new Error(tRes.error)
        
        setTeams([...teams, tRes.data])
        setTeamName('')
        setStreamUrl('')
      }
      setIsAdding(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveTeam = async (teamId: string) => {
    if (!confirm('¿Estás seguro de eliminar este participante/equipo?')) return
    
    const res = await deleteTeam(tournamentId, teamId)
    if ('error' in res) {
      alert(res.error)
    } else {
      setTeams(teams.filter(t => t.id !== teamId))
      setParticipants(participants.filter(p => p.teamId !== teamId))
    }
  }

  const handleRemoveParticipant = async (participantId: string) => {
    if (!confirm('¿Eliminar a este jugador del equipo?')) return
    const res = await deleteParticipant(tournamentId, participantId)
    if ('error' in res) toast.error(res.error)
    else {
      setParticipants(participants.filter(x => x.id !== participantId))
      toast.success('Jugador eliminado')
    }
  }

  const handleAddParticipant = async (teamId: string) => {
    if (!newPlayerName.trim()) return
    setAddPlayerLoading(true)
    const pRes = await addParticipant(tournamentId, {
      displayName: newPlayerName.trim(),
      teamId,
      isCaptain: false,
    })
    if ('error' in pRes) {
      toast.error(pRes.error)
    } else {
      const p = pRes.data
      // Save stats if provided
      if (newPlayerKd || newPlayerAvgKills || newPlayerRank || newPlayerBrPlacement) {
        await updateParticipant(tournamentId, p.id, {
          kdRatio:            newPlayerKd          ? Number(newPlayerKd)          : undefined,
          avgKills:           newPlayerAvgKills     ? Number(newPlayerAvgKills)     : undefined,
          classificationRank: newPlayerRank         || undefined,
          brAvgPlacement:     newPlayerBrPlacement  ? Number(newPlayerBrPlacement)  : undefined,
        } as any)
      }
      setParticipants([...participants, {
        ...p,
        kdRatio:            newPlayerKd          ? Number(newPlayerKd)          : undefined,
        avgKills:           newPlayerAvgKills     ? Number(newPlayerAvgKills)     : undefined,
        classificationRank: newPlayerRank         || undefined,
        brAvgPlacement:     newPlayerBrPlacement  ? Number(newPlayerBrPlacement)  : undefined,
      }])
      toast.success('Jugador añadido')
      setNewPlayerName(''); setNewPlayerKd(''); setNewPlayerAvgKills('')
      setNewPlayerRank(''); setNewPlayerBrPlacement(''); setAddingPlayerTo(null)
    }
    setAddPlayerLoading(false)
  }

  const openEditStats = (p: Participant) => {
    setEditingStats(p)
    setEditKd(p.kdRatio != null ? String(p.kdRatio) : '')
    setEditAvgKills(p.avgKills != null ? String(p.avgKills) : '')
    setEditRank(p.classificationRank ?? '')
    setEditBrPlacement(p.brAvgPlacement != null ? String(p.brAvgPlacement) : '')
    setEditColor(p.color ?? '')
    setEditStreamUrl(p.streamUrl ?? '')
  }

  const handleSaveStats = async () => {
    if (!editingStats) return
    setEditStatsLoading(true)
    const res = await updateParticipant(tournamentId, editingStats.id, {
      kdRatio:            editKd          ? Number(editKd)          : undefined,
      avgKills:           editAvgKills     ? Number(editAvgKills)     : undefined,
      classificationRank: editRank         || undefined,
      brAvgPlacement:     editBrPlacement  ? Number(editBrPlacement)  : undefined,
      color:              editColor       || undefined,
      streamUrl:          editStreamUrl   || null,
    } as any)
    if ('error' in res) {
      toast.error(res.error)
    } else {
      setParticipants(participants.map(p => p.id === editingStats.id ? {
        ...p,
        kdRatio:            editKd          ? Number(editKd)          : undefined,
        avgKills:           editAvgKills     ? Number(editAvgKills)     : undefined,
        classificationRank: editRank         || undefined,
        brAvgPlacement:     editBrPlacement  ? Number(editBrPlacement)  : undefined,
        color:              editColor       || undefined,
        streamUrl:          editStreamUrl   || undefined,
      } : p))
      toast.success('Stats actualizadas')
      setEditingStats(null)
    }
    setEditStatsLoading(false)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUploadRef.current) return

    const { id, type } = currentUploadRef.current
    setUploadingId(id)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadAvatar(tournamentId, id, type, fd)
      if ('error' in res) throw new Error(res.error)

      if (type === 'team') {
        setTeams(teams.map(t => t.id === id ? { ...t, avatarUrl: res.url } : t))
      } else {
        setParticipants(participants.map(p => p.id === id ? { ...p, avatarUrl: res.url } : p))
      }
      toast.success('Imagen actualizada con éxito')
    } catch (err: any) {
      toast.error('Error al subir imagen: ' + err.message)
    } finally {
      setUploadingId(null)
      currentUploadRef.current = null
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const triggerUpload = (id: string, type: 'team' | 'participant') => {
    currentUploadRef.current = { id, type }
    fileInputRef.current?.click()
  }

  const getTeamRoster = (teamId: string) => participants.filter(p => p.teamId === teamId)

  return (
    <div className="space-y-6">
      {isLocked && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center text-xs text-yellow-400 font-medium uppercase tracking-wider">
          🔒 El torneo ya ha iniciado o finalizado. El listado de participantes y equipos está cerrado.
        </div>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white/80">Listado ({teams.length})</h2>
        {!isLocked && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 
              text-sm text-white rounded-lg transition-colors border border-white/10"
          >
            {isAdding ? 'Cancelar' : (isIndividual ? '+ Agregar Jugador' : '+ Agregar Equipo')}
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-dark-card border border-neon-purple/20 rounded-xl p-5 shadow-lg shadow-neon-purple/5">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs text-white/50 mb-1.5 ml-1">
                  {isIndividual ? 'Nombre del Jugador' : 'Nombre del Equipo'}
                </label>
                <input
                  autoFocus
                  type="text"
                  value={isIndividual ? playerName : teamName}
                  onChange={(e) => isIndividual ? setPlayerName(e.target.value) : setTeamName(e.target.value)}
                  placeholder={isIndividual ? 'Ej. Faker' : 'Ej. Team Liquid'}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 outline-none
                    focus:border-neon-purple/50 focus:ring-1 focus:ring-neon-purple/50 transition-all text-sm
                    text-white placeholder:text-white/20"
                />
              </div>
              <div className="flex-[0.6]">
                <label className="block text-xs text-white/50 mb-1.5 ml-1">
                  Link de Stream (Twitch/YouTube/Kick)
                </label>
                <input
                  type="url"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  placeholder="https://twitch.tv/..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 outline-none
                    focus:border-neon-purple/50 focus:ring-1 focus:ring-neon-purple/50 transition-all text-sm
                    text-white placeholder:text-white/20"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-neon-purple hover:bg-neon-purple/90 active:scale-95 text-white 
                  text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed
                  shadow-lg shadow-neon-purple/20"
              >
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
          {error && <p className="text-red-400 text-xs mt-2 ml-1">{error}</p>}
        </div>
      )}

      {teams.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
          <p className="text-white/40 text-sm">No hay {isIndividual ? 'jugadores' : 'equipos'} registrados aún</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {teams.map((team) => {
            const roster = getTeamRoster(team.id)
            const isCollapsed = collapsedTeams.has(team.id)
            
            return (
              <div key={team.id} className="bg-dark-card border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                <div className={`p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${!isCollapsed ? 'border-b border-white/5' : ''}`}>
                  <div className="flex items-center gap-4 group">
                    <button 
                      onClick={() => toggleTeamCollapse(team.id)}
                      className={`p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                    >
                      <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div 
                      className="relative cursor-pointer"
                      onClick={() => triggerUpload(team.id, 'team')}
                    >
                      {team.avatarUrl ? (
                        <img src={team.avatarUrl} alt="" className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-white/10" />
                      ) : (
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          </svg>
                        </div>
                      )}
                      {uploadingId === team.id && (
                        <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-orbitron font-black text-white text-lg sm:text-xl tracking-tight leading-none">{team.name}</h3>
                        {team.streamUrl && (
                          <span className="text-[8px] bg-red-500/20 text-red-500 font-bold px-1.5 py-0.5 rounded border border-red-500/30 uppercase">LIVE</span>
                        )}
                      </div>
                      <p className="text-white/40 text-xs mt-1 font-medium">{roster.length} / {maxPerTeam} jugadores</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/t/${tournamentSlug}/team/${team.id}`
                        navigator.clipboard.writeText(url)
                        toast.success('¡Enlace del portal copiado!')
                      }}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-neon-cyan/10 
                        hover:bg-neon-cyan/20 text-neon-cyan rounded-xl text-xs font-bold border border-neon-cyan/20 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copiar Portal
                    </button>
                    {!isLocked && (
                      <button
                        onClick={() => handleRemoveTeam(team.id)}
                        className="p-2 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="p-4 sm:p-6 bg-white/[0.01]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      {roster.map((p) => (
                        <div key={p.id} className="relative group bg-white/5 border border-white/5 p-4 rounded-2xl hover:border-neon-purple/50 transition-all">
                          <div className="flex items-center gap-3">
                            <div
                              className="relative cursor-pointer"
                              onClick={() => triggerUpload(p.id, 'participant')}
                            >
                              {p.avatarUrl ? (
                                <img src={p.avatarUrl} alt="" className="w-12 h-12 rounded-xl object-contain" style={{ background: 'transparent' }} />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                                  <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                              )}
                              {uploadingId === p.id && (
                                <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                                  <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-white font-bold text-sm truncate">{p.displayName}</h4>
                              {isIndividual ? null : p.isCaptain ? (
                                <span className="text-[8px] font-black text-neon-cyan uppercase tracking-widest block">Capitán</span>
                              ) : (
                                <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest block">Jugador</span>
                              )}
                            </div>
                          </div>

                          {/* Stats preview */}
                          {(p.kdRatio != null || p.avgKills != null || p.classificationRank || p.brAvgPlacement != null) && (
                            <div className="mt-2 grid grid-cols-2 gap-1">
                              {p.kdRatio != null && (
                                <div className="bg-black/40 rounded px-2 py-1 text-center">
                                  <p className="text-[8px] text-white/30 uppercase">K/D</p>
                                  <p className="text-[11px] font-black text-neon-cyan">{p.kdRatio.toFixed(2)}</p>
                                </div>
                              )}
                              {p.avgKills != null && (
                                <div className="bg-black/40 rounded px-2 py-1 text-center">
                                  <p className="text-[8px] text-white/30 uppercase">Kills/partida</p>
                                  <p className="text-[11px] font-black text-neon-purple">{p.avgKills.toFixed(1)}</p>
                                </div>
                              )}
                              {p.classificationRank && (
                                <div className="bg-black/40 rounded px-2 py-1 text-center">
                                  <p className="text-[8px] text-white/30 uppercase">Rango</p>
                                  <p className="text-[10px] font-bold text-yellow-400 truncate">{p.classificationRank}</p>
                                </div>
                              )}
                              {p.brAvgPlacement != null && (
                                <div className="bg-black/40 rounded px-2 py-1 text-center">
                                  <p className="text-[8px] text-white/30 uppercase">Pos. BR</p>
                                  <p className="text-[11px] font-black text-white/70">#{p.brAvgPlacement.toFixed(0)}</p>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="mt-2 flex items-center justify-between gap-1 pt-2 border-t border-white/5">
                            {p.totalKills > 0 && (
                              <div className="px-2 py-0.5 bg-black/40 rounded text-[9px] text-white/40 font-bold uppercase tracking-tighter">
                                Bajas <b className="text-neon-purple ml-1">{p.totalKills}</b>
                              </div>
                            )}
                            {!p.totalKills && <div />}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditStats(p)}
                                title="Editar estadísticas"
                                className="text-white/20 hover:text-neon-cyan transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              {p.streamUrl && (
                                <a href={p.streamUrl} target="_blank" rel="noreferrer" className="text-red-500/50 hover:text-red-500 transition-colors">
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                                  </svg>
                                </a>
                              )}
                              {!isLocked && (
                                <button
                                  onClick={() => handleRemoveParticipant(p.id)}
                                  className="text-white/20 hover:text-red-500 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {!isLocked && roster.length < maxPerTeam && (
                        addingPlayerTo === team.id ? (
                          <div className="bg-white/5 border border-neon-purple/30 rounded-2xl p-4 space-y-2">
                            <input
                              autoFocus
                              type="text"
                              value={newPlayerName}
                              onChange={e => setNewPlayerName(e.target.value)}
                              placeholder="Nombre del jugador"
                              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 outline-none focus:border-neon-purple/50"
                            />
                            {isShooter && (
                              <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                  <label className="text-[8px] text-white/30 uppercase tracking-widest ml-1">K/D Promedio</label>
                                  <input type="number" step="0.01" min="0" value={newPlayerKd} onChange={e => setNewPlayerKd(e.target.value)}
                                    placeholder="1.50"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/50" />
                                </div>
                                <div>
                                  <label className="text-[8px] text-white/30 uppercase tracking-widest ml-1">Kills/Partida</label>
                                  <input type="number" step="0.1" min="0" value={newPlayerAvgKills} onChange={e => setNewPlayerAvgKills(e.target.value)}
                                    placeholder="4.5"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/50" />
                                </div>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="text-[8px] text-white/30 uppercase tracking-widest ml-1">
                                  {tournamentDiscipline === 'clash_royale' ? "Copas / Arena" : "Rango Clasif."}
                                </label>
                                <input type="text" value={newPlayerRank} onChange={e => setNewPlayerRank(e.target.value)}
                                  placeholder={tournamentDiscipline === 'clash_royale' ? "7500 copas / Arena 15" : "Oro / Platino..."}
                                  className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/50" />
                              </div>
                              {isShooter && (
                                <div>
                                  <label className="text-[8px] text-white/30 uppercase tracking-widest ml-1">Pos. Prom. BR</label>
                                  <input type="number" step="1" min="1" value={newPlayerBrPlacement} onChange={e => setNewPlayerBrPlacement(e.target.value)}
                                    placeholder="8"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/50" />
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => handleAddParticipant(team.id)}
                                disabled={addPlayerLoading || !newPlayerName.trim()}
                                className="flex-1 py-1.5 bg-neon-purple/80 hover:bg-neon-purple text-white text-[10px] font-bold rounded-lg disabled:opacity-50 transition-colors uppercase tracking-widest"
                              >
                                {addPlayerLoading ? '...' : 'Agregar'}
                              </button>
                              <button
                                onClick={() => { setAddingPlayerTo(null); setNewPlayerName('') }}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/40 text-[10px] rounded-lg transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAddingPlayerTo(team.id)}
                            className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-white/5
                              hover:border-neon-purple/40 hover:bg-white/[0.02] transition-all group/btn"
                          >
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mb-1 group-hover/btn:scale-110 transition-transform">
                              <span className="text-white/40 text-lg">+</span>
                            </div>
                            <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Añadir Jugador</span>
                          </button>
                        )
                      )}
                    </div>
                    
                    {roster.length === maxPerTeam ? (
                      <div className="text-[10px] text-neon-cyan font-bold italic">Equipo completo</div>
                    ) : (
                      <div className="text-[10px] text-white/20">Faltan {maxPerTeam - roster.length} jugadores</div>
                    )}

                    <div className="mt-6 flex items-center gap-3 p-3 bg-black/40 rounded-xl border border-white/5">
                      <svg className="w-4 h-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 115.656 5.656l-1.101 1.101" />
                      </svg>
                      <input 
                        type="text" 
                        readOnly 
                        value={`${window.location.origin}/t/${tournamentSlug}/team/${team.id}`}
                        className="flex-1 bg-transparent text-[10px] text-white/40 outline-none truncate"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Hidden File Input for Avatars */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Edit Stats Modal */}
      {editingStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0d0d0f] border border-neon-purple/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-neon-purple/10">
            <div className="flex items-center gap-3 mb-5">
              {editingStats.avatarUrl ? (
                <img src={editingStats.avatarUrl} alt="" className="w-10 h-10 rounded-xl object-contain" style={{ background: 'transparent' }} />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <div>
                <h3 className="text-white font-bold text-sm">{editingStats.displayName}</h3>
                <p className="text-white/30 text-[10px] uppercase tracking-widest">Editar estadísticas</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {isShooter && (
                <>
                  <div>
                    <label className="block text-[9px] text-white/40 uppercase tracking-widest mb-1.5">K/D Promedio</label>
                    <input type="number" step="0.01" min="0" value={editKd} onChange={e => setEditKd(e.target.value)}
                      placeholder="1.50"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/50" />
                  </div>
                  <div>
                    <label className="block text-[9px] text-white/40 uppercase tracking-widest mb-1.5">Kills / Partida</label>
                    <input type="number" step="0.1" min="0" value={editAvgKills} onChange={e => setEditAvgKills(e.target.value)}
                      placeholder="4.5"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/50" />
                  </div>
                </>
              )}
              <div className={isShooter ? "" : "col-span-2"}>
                <label className="block text-[9px] text-white/40 uppercase tracking-widest mb-1.5">
                  {tournamentDiscipline === 'clash_royale' ? "Copas / Arena / Liga" : "Rango Clasificatoria"}
                </label>
                <input type="text" value={editRank} onChange={e => setEditRank(e.target.value)}
                  placeholder={tournamentDiscipline === 'clash_royale' ? "Ej. 7500 copas / Arena Real" : "Oro / Platino / Diamante..."}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/50" />
              </div>
              {isShooter && (
                <div>
                  <label className="block text-[9px] text-white/40 uppercase tracking-widest mb-1.5">Posición Prom. BR</label>
                  <input type="number" step="1" min="1" value={editBrPlacement} onChange={e => setEditBrPlacement(e.target.value)}
                    placeholder="8"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/50" />
                </div>
              )}
            </div>

            <div className="mt-3">
              <label className="block text-[9px] text-white/40 uppercase tracking-widest mb-1.5">Link de Transmisión (Twitch/YouTube/Kick)</label>
              <input type="url" value={editStreamUrl} onChange={e => setEditStreamUrl(e.target.value)}
                placeholder="https://kick.com/..."
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/50" />
            </div>

            <div className="mt-3">
              <label className="block text-[9px] text-white/40 uppercase tracking-widest mb-1.5">Color de Tarjeta (Hex)</label>
              <div className="flex gap-2">
                <input type="color" value={editColor || '#00F5FF'} onChange={e => setEditColor(e.target.value)}
                  className="w-9 h-9 rounded-lg bg-black/40 border border-white/10 p-0 cursor-pointer overflow-hidden outline-none focus:border-neon-cyan/50 shrink-0" />
                <input type="text" value={editColor} onChange={e => setEditColor(e.target.value)}
                  placeholder="#00F5FF"
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/50" />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleSaveStats}
                disabled={editStatsLoading}
                className="flex-1 py-2.5 bg-neon-purple hover:bg-neon-purple/90 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors"
              >
                {editStatsLoading ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={() => setEditingStats(null)}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white/50 text-sm rounded-xl transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
