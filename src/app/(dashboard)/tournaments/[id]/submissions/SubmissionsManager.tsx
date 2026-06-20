'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { approveSubmission, rejectSubmission, updateSubmissionAction } from '@/lib/actions/submissions'

type EvidenceFile = {
  id: string
  storage_path: string
  mime_type: string
  file_name?: string
}

type PendingSubmission = {
  id: string
  tournament_id: string
  team_id: string
  match_id: string
  submitted_by: string
  kill_count: number
  rank?: number
  pot_top: boolean
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason?: string
  submitted_at: string
  teams?: { name: string; participants?: { id: string; display_name: string }[] } | { name: string; participants?: { id: string; display_name: string }[] }[]
  matches?: { name: string; match_number: number } | { name: string; match_number: number }[]
  evidence_files?: EvidenceFile[]
  ai_status?: 'pending' | 'processing' | 'completed' | 'failed'
  ai_data?: { team_name?: string; kill_count?: number; rank?: number }
  ai_confidence?: number
  ai_error?: string
  player_kills?: Record<string, number>
}

function getEvidenceUrl(storagePath: string): string {
  const supabase = createClient()
  // Always use getPublicUrl — it generates the correct URL regardless of
  // whether the path already contains the bucket prefix or not.
  const clean = storagePath.replace(/^evidences\//, '')
  const { data } = supabase.storage.from('evidences').getPublicUrl(clean)
  return data.publicUrl
}

export function SubmissionsManager({
  tournamentId,
  initialSubmissions,
  allTeams = [],
}: {
  tournamentId: string
  initialSubmissions: PendingSubmission[]
  allTeams?: { id: string; name: string }[]
}) {
  const [submissions, setSubmissions] = useState(initialSubmissions)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const [editingSub, setEditingSub] = useState<PendingSubmission | null>(null)
  const [editKills, setEditKills] = useState<number>(0)
  const [editRank, setEditRank] = useState<number | null>(null)
  const [editPotTop, setEditPotTop] = useState<boolean>(false)
  const [editPlayerKills, setEditPlayerKills] = useState<Record<string, number>>({})

  const openEditSubmission = (sub: PendingSubmission) => {
    setEditingSub(sub)
    setEditKills(sub.kill_count)
    setEditRank(sub.rank || null)
    setEditPotTop(sub.pot_top || false)
    
    // Initialize player kills. If a player is not in player_kills, default to 0.
    const pKills: Record<string, number> = {}
    const teamObj: any = Array.isArray(sub.teams) ? sub.teams[0] : sub.teams
    const teamParticipants = teamObj?.participants || []
    
    teamParticipants.forEach((p: any) => {
      pKills[p.id] = sub.player_kills?.[p.id] || 0
    })
    
    setEditPlayerKills(pKills)
  }

  const handlePlayerKillChange = (pId: string, val: string) => {
    const num = parseInt(val, 10) || 0
    const nextPlayerKills = { ...editPlayerKills, [pId]: num }
    setEditPlayerKills(nextPlayerKills)
    
    // Automatically calculate the sum
    const total = Object.values(nextPlayerKills).reduce((a, b) => a + b, 0)
    setEditKills(total)
  }

  const handleSaveEdit = async () => {
    if (!editingSub) return
    setLoadingId(editingSub.id)
    try {
      const res = await updateSubmissionAction(editingSub.id, {
        killCount: editKills,
        rank: editRank,
        potTop: editPotTop,
        playerKills: editPlayerKills,
      })
      if ('error' in res) throw new Error(res.error)
      
      setSubmissions(submissions.map(s => s.id === editingSub.id ? {
        ...s,
        kill_count: editKills,
        rank: editRank || undefined,
        pot_top: editPotTop,
        player_kills: editPlayerKills,
      } : s))
      setEditingSub(null)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoadingId(null)
    }
  }

  const handleApprove = async (id: string) => {
    setLoadingId(id)
    try {
      const res = await approveSubmission(id)
      if ('error' in res) throw new Error(res.error)
      
      setSubmissions(submissions.map(s => s.id === id ? { ...s, status: 'approved' } : s))
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoadingId(null)
    }
  }

  const handleReject = async (id: string) => {
    const reason = prompt('Motivo del rechazo:')
    if (reason === null) return // cancelled
    
    setLoadingId(id)
    try {
      const res = await rejectSubmission(id, reason || 'Envío inválido')
      if ('error' in res) throw new Error(res.error)
      
      setSubmissions(submissions.map(s => s.id === id ? { ...s, status: 'rejected', rejection_reason: reason || 'Envío inválido' } : s))
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoadingId(null)
    }
  }

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    const confirmDelete = confirm(`¿Estás seguro de que deseas eliminar permanentemente al equipo "${teamName}"? Se borrarán todos sus participantes registrados.`)
    if (!confirmDelete) return
    
    setLoadingId(teamId)
    try {
      const { deleteTeam } = await import('@/lib/actions/participants')
      const res = await deleteTeam(tournamentId, teamId)
      if ('error' in res) throw new Error(res.error)
      
      alert(`Equipo "${teamName}" eliminado exitosamente.`)
      // Refresh window to re-fetch teams and recalculate standings
      window.location.reload()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoadingId(null)
    }
  }

  const handleBanTeam = async (teamId: string, teamName: string) => {
    const confirmBan = confirm(`¿Estás seguro de que deseas BANEAR a todos los integrantes de "${teamName}" por abandono? Esto los eliminará del torneo y les impedirá inscribirse en los siguientes 3 torneos.`)
    if (!confirmBan) return
    
    setLoadingId(teamId)
    try {
      const { banTeamForAbandonment } = await import('@/lib/actions/bans')
      const res = await banTeamForAbandonment(tournamentId, teamId)
      if ('error' in res) throw new Error(res.error)
      
      alert(`Equipo "${teamName}" baneado y eliminado exitosamente.`)
      window.location.reload()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoadingId(null)
    }
  }

  // Parse arrays if Supabase returned un-unwrapped values due to 1:M assumptions when we select from views
  const getTeamName = (s: PendingSubmission) => Array.isArray(s.teams) ? s.teams[0]?.name : s.teams?.name || 'Equipo desconocido'
  const getMatchName = (s: PendingSubmission) => Array.isArray(s.matches) ? s.matches[0]?.name : s.matches?.name || 'Partida'

  // Group submissions by match
  const submissionsByMatch = submissions.reduce((acc, sub) => {
    const matchId = sub.match_id
    if (!acc[matchId]) acc[matchId] = []
    acc[matchId].push(sub)
    return acc
  }, {} as Record<string, PendingSubmission[]>)

  // Sort match IDs by match number (if available)
  const sortedMatchIds = Object.keys(submissionsByMatch).sort((a, b) => {
    const matchA = submissionsByMatch[a][0].matches as any
    const matchB = submissionsByMatch[b][0].matches as any
    const numA = Array.isArray(matchA) ? matchA[0]?.match_number : matchA?.match_number
    const numB = Array.isArray(matchB) ? matchB[0]?.match_number : matchB?.match_number
    return (numA || 0) - (numB || 0)
  })

  return (
    <div className="space-y-12">
      {submissions.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.02] space-y-4">
          <p className="text-white/40 text-sm">No hay envíos registrados aún</p>
          {allTeams.length > 0 && (
            <div className="max-w-md mx-auto text-left bg-dark-card border border-white/5 p-6 rounded-xl">
              <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">Equipos Registrados (Sin envíos):</h3>
              <div className="flex flex-wrap gap-2">
                {allTeams.map(t => (
                  <span key={t.id} className="text-xs px-2.5 py-1 bg-white/[0.03] border border-white/10 rounded-lg text-white/70">
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        sortedMatchIds.map(matchId => {
          const matchSubmissions = submissionsByMatch[matchId]
          const matchName = getMatchName(matchSubmissions[0])
          
          // Find teams that have NOT submitted for this specific match
          const submittedTeamIds = new Set(matchSubmissions.map(s => s.team_id))
          const missingTeams = allTeams.filter(t => !submittedTeamIds.has(t.id))

          return (
            <div key={matchId} className="space-y-4">
              <div className="flex items-center gap-4">
                <h2 className="font-orbitron text-lg font-bold text-neon-cyan tracking-wider truncate">
                  {matchName}
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-neon-cyan/30 to-transparent" />
                <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                  {matchSubmissions.length} ENVÍOS
                </span>
              </div>

              {missingTeams.length > 0 && (
                <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    Falta evidencia de {missingTeams.length} {missingTeams.length === 1 ? 'equipo' : 'equipos'}:
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    {missingTeams.map(t => (
                      <div key={t.id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-950/20 border border-red-900/30 text-red-300 rounded-lg">
                        <span className="text-xs font-semibold">{t.name}</span>
                        <div className="flex items-center gap-1 border-l border-red-900/40 pl-2 ml-1">
                          <button
                            onClick={() => handleDeleteTeam(t.id, t.name)}
                            disabled={loadingId === t.id}
                            className="p-1 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                            title="Eliminar Equipo"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleBanTeam(t.id, t.name)}
                            disabled={loadingId === t.id}
                            className="p-1 text-red-500 hover:text-red-300 hover:bg-red-500/20 rounded transition-all"
                            title="Banear por Abandono"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="bg-dark-card border border-white/5 rounded-xl overflow-hidden shadow-lg shadow-black/20">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-white/40 uppercase bg-white/[0.02] border-b border-white/5">
                      <tr>
                        <th className="px-6 py-4 font-medium">Equipo/Jugador</th>
                        <th className="px-6 py-4 font-medium text-center">Kills</th>
                        <th className="px-6 py-4 font-medium text-center">Rango / Top</th>
                        <th className="px-6 py-4 font-medium">Validación IA</th>
                        <th className="px-6 py-4 font-medium">Estado</th>
                        <th className="px-6 py-4 font-medium text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {matchSubmissions.map(sub => (
                        <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4 font-medium text-white">{getTeamName(sub)}</td>
                          <td className="px-6 py-4 text-center font-orbitron text-neon-cyan">{sub.kill_count}</td>
                          <td className="px-6 py-4 text-center">
                             {sub.rank ? (
                               <span className={`inline-flex max-w-fit mx-auto px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                                 sub.rank === 1 ? 'bg-gold/20 text-gold border-gold/30' : 'bg-white/10 text-white/60 border-white/20'
                               }`}>
                                 Top {sub.rank}
                               </span>
                             ) : sub.pot_top ? (
                               <span className="inline-flex max-w-fit mx-auto px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-gold/20 text-gold border border-gold/30">Top 1</span>
                             ) : (
                               <span className="text-white/20">-</span>
                             )}
                           </td>
                          <td className="px-6 py-4">
                            {sub.ai_status === 'processing' && (
                              <div className="flex items-center gap-2 text-white/40">
                                <div className="w-3 h-3 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
                                <span className="text-[10px] uppercase font-bold tracking-widest">Analizando...</span>
                              </div>
                            )}
                            {sub.ai_status === 'failed' && (
                              <div className="flex items-center gap-2 text-red-400/60" title={sub.ai_error}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span className="text-[10px] uppercase font-bold tracking-widest">Error IA</span>
                              </div>
                            )}
                            {sub.ai_status === 'completed' && sub.ai_data && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                   <div className={`w-1.5 h-1.5 rounded-full ${sub.ai_data.kill_count === sub.kill_count ? 'bg-green-400' : 'bg-orange-400'}`} />
                                   <span className="text-[10px] text-white/60 font-medium">Kills detectadas: <b className="text-white">{sub.ai_data.kill_count}</b></span>
                                </div>
                                <div className="flex items-center gap-2">
                                   {sub.ai_confidence && sub.ai_confidence > 0.8 ? (
                                     <span className="text-[8px] bg-green-500/10 text-green-400 px-1 rounded border border-green-500/20 uppercase font-black tracking-tighter">Alta Confianza</span>
                                   ) : (
                                     <span className="text-[8px] bg-orange-500/10 text-orange-400 px-1 rounded border border-orange-500/20 uppercase font-black tracking-tighter">Revisión Manual</span>
                                   )}
                                </div>
                              </div>
                            )}
                            {!sub.ai_status && (
                              <span className="text-white/10 text-[10px] uppercase tracking-widest font-bold">Sin análisis</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs">
                            {sub.status === 'pending' && <span className="text-yellow-400">Pendiente</span>}
                            {sub.status === 'approved' && <span className="text-green-400 font-bold">Aprobado</span>}
                            {sub.status === 'rejected' && (
                              <div className="group relative w-max cursor-help text-red-400">
                                Rechazado
                                <div className="absolute top-0 left-[110%] ml-2 w-48 p-2 bg-black/90 border border-white/10 rounded text-xs text-white/70 opacity-0 group-hover:opacity-100 pointer-events-none z-10 transition-opacity">
                                  {sub.rejection_reason}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex items-center justify-end gap-2">
                               {sub.evidence_files && sub.evidence_files.length > 0 && (
                                   <a
                                     href={getEvidenceUrl(sub.evidence_files[0].storage_path)}
                                     target="_blank"
                                     rel="noreferrer"
                                     className="p-1.5 text-white/50 hover:text-neon-cyan hover:bg-neon-cyan/10 rounded transition-colors"
                                     title="Ver Evidencia"
                                   >
                                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                     </svg>
                                   </a>
                               )}
                               
                               {sub.status === 'pending' && (
                                 <>
                                   <button
                                     onClick={() => openEditSubmission(sub)}
                                     disabled={loadingId === sub.id}
                                     className="p-1.5 text-white/50 hover:text-neon-cyan hover:bg-neon-cyan/10 rounded transition-colors"
                                     title="Editar"
                                   >
                                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                     </svg>
                                   </button>
                                   <button
                                     onClick={() => handleApprove(sub.id)}
                                     disabled={loadingId === sub.id}
                                     className="p-1.5 text-white/50 hover:text-green-400 hover:bg-green-400/10 rounded transition-colors"
                                     title="Aprobar"
                                   >
                                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                     </svg>
                                   </button>
                                   <button
                                     onClick={() => handleReject(sub.id)}
                                     disabled={loadingId === sub.id}
                                     className="p-1.5 text-white/50 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                                     title="Rechazar"
                                   >
                                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                     </svg>
                                   </button>
                                 </>
                               )}
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })
      )}

      {/* Edit Submission Modal */}
      {editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-dark-card border border-white/10 rounded-2xl p-6 space-y-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="font-orbitron font-bold text-lg text-white">
                Editar Información de Envío
              </h3>
              <button
                onClick={() => setEditingSub(null)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-2">
                  Rango/Posición del Equipo
                </label>
                <input
                  type="number"
                  min="1"
                  value={editRank || ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : null
                    setEditRank(val)
                    if (val === 1) {
                      setEditPotTop(true)
                    }
                  }}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:border-neon-cyan focus:outline-none transition-colors"
                  placeholder="Ej: 1, 2, 3..."
                />
              </div>

              <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-4 rounded-xl">
                <input
                  id="potTop"
                  type="checkbox"
                  checked={editPotTop}
                  onChange={(e) => setEditPotTop(e.target.checked)}
                  className="w-4 h-4 rounded border-white/10 bg-white/[0.03] text-neon-cyan focus:ring-neon-cyan"
                />
                <label htmlFor="potTop" className="text-sm font-medium text-white/80 select-none">
                  ¿Potencial Top / Victoria? (Top 1)
                </label>
              </div>

              <div>
                <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                  Kills por Jugador (Suma automática)
                </h4>
                <div className="space-y-3">
                  {(() => {
                    const teamObj: any = Array.isArray(editingSub.teams) ? editingSub.teams[0] : editingSub.teams
                    const teamParticipants = teamObj?.participants || []
                    if (teamParticipants.length === 0) {
                      return <p className="text-xs text-white/30 italic">No se encontraron jugadores en el equipo.</p>
                    }
                    return teamParticipants.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between gap-4">
                        <span className="text-sm text-white/80 font-medium truncate">{p.display_name}</span>
                        <input
                          type="number"
                          min="0"
                          value={editPlayerKills[p.id] ?? 0}
                          onChange={(e) => handlePlayerKillChange(p.id, e.target.value)}
                          className="w-24 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-right text-white focus:border-neon-cyan focus:outline-none transition-colors font-orbitron"
                        />
                      </div>
                    ))
                  })()}
                </div>
              </div>

              <div className="pt-2 border-t border-white/5">
                <div className="flex justify-between items-center bg-neon-cyan/5 border border-neon-cyan/10 p-4 rounded-xl">
                  <span className="text-xs font-bold text-neon-cyan uppercase tracking-wider">Kills Totales</span>
                  <span className="font-orbitron font-black text-xl text-neon-cyan">{editKills}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/5 pt-4">
              <button
                onClick={() => setEditingSub(null)}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold text-white/80 hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={loadingId === editingSub.id}
                className="px-5 py-2.5 bg-neon-cyan hover:bg-neon-cyan-hover rounded-xl text-sm font-semibold text-dark-bg transition-all font-orbitron tracking-wider flex items-center gap-2 disabled:opacity-50"
              >
                {loadingId === editingSub.id ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
