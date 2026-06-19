'use client'

import { useState } from 'react'
import { Match } from '@/types'
import { updateMatch, createMatch } from '@/lib/actions/matches'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

export function MatchesManager({
  tournamentId,
  initialMatches,
}: {
  tournamentId: string
  initialMatches: Match[]
}) {
  const [matches, setMatches] = useState(initialMatches)
  const [saving, setSaving] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const encounters = matches.filter(m => !m.parentMatchId)
  const getRounds = (parentId: string) => matches.filter(m => m.parentMatchId === parentId)

  const handleUpdate = async (matchId: string, data: Partial<Match>) => {
    setSaving(matchId)
    const res = await updateMatch(tournamentId, matchId, data)
    if ('error' in res) {
      toast.error(res.error)
    } else {
      // If activating, deactivate all others locally too
      if (data.isActive === true) {
        setMatches(prev => prev.map(m =>
          m.id === matchId
            ? { ...m, ...data }
            : { ...m, isActive: false }
        ))
      } else {
        setMatches(prev => prev.map(m => m.id === matchId ? { ...m, ...data } : m))
      }
      toast.success('Cambios guardados')
    }
    setSaving(null)
  }

  const handleAddMatch = async () => {
    setCreating(true)
    const maxNumber = encounters.reduce((max, m) => m.matchNumber > max ? m.matchNumber : max, 0)
    const nextNumber = maxNumber + 1
    const name = `Encuentro ${nextNumber}`

    const res = await createMatch(tournamentId, {
      name,
      matchNumber: nextNumber,
    })

    if ('error' in res) {
      toast.error(res.error)
    } else {
      setMatches(prev => [...prev, res.data])
      toast.success(`Partida "${name}" creada con éxito`)
    }
    setCreating(false)
  }

  const handleStart = async (match: Match) => {
    if (match.isCompleted) {
      toast.error('Esta partida ya está finalizada')
      return
    }
    await handleUpdate(match.id, { isActive: true })
    toast.success(`▶ ${match.name} marcada como EN CURSO — AC abre mercados`)
  }

  const handleFinish = async (match: Match) => {
    await handleUpdate(match.id, { isActive: false, isCompleted: true })
    toast.success(`✓ ${match.name} finalizada — AC cierra y resuelve mercados`)
  }

  const handleReopen = async (match: Match) => {
    await handleUpdate(match.id, { isCompleted: false, isActive: false })
    toast.success(`${match.name} reabierta`)
  }

  function MatchControls({ match }: { match: Match }) {
    const isSaving = saving === match.id

    if (match.isWarmup) {
      return (
        <span className="text-[10px] text-yellow-500/60 uppercase font-black tracking-widest">
          Warmup — sin mercados
        </span>
      )
    }

    if (match.isCompleted) {
      return (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-neon-cyan">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan" />
            Finalizada
          </span>
          <button
            onClick={() => handleReopen(match)}
            disabled={isSaving}
            className="text-[10px] px-2 py-1 rounded border border-white/10 text-white/30 hover:text-white/60 hover:border-white/20 transition-colors disabled:opacity-40"
          >
            Reabrir
          </button>
        </div>
      )
    }

    if (match.isActive) {
      return (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-green-400 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            En curso · AC live
          </span>
          <button
            onClick={() => handleFinish(match)}
            disabled={isSaving}
            className="text-[10px] px-3 py-1.5 rounded-lg border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 font-black uppercase tracking-widest transition-colors disabled:opacity-40"
          >
            {isSaving ? '...' : 'Finalizar'}
          </button>
        </div>
      )
    }

    // Pending (not active, not completed)
    return (
      <button
        onClick={() => handleStart(match)}
        disabled={isSaving}
        className="text-[10px] px-3 py-1.5 rounded-lg border border-neon-cyan/30 text-neon-cyan bg-neon-cyan/10 hover:bg-neon-cyan/20 font-black uppercase tracking-widest transition-colors disabled:opacity-40"
      >
        {isSaving ? '...' : '▶ Iniciar'}
      </button>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
        <span className="text-xs font-bold text-white/40 uppercase tracking-widest font-orbitron">
          Secuencia de Encuentros
        </span>
        <button
          onClick={handleAddMatch}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 bg-neon-purple hover:bg-neon-purple/90 disabled:opacity-50 text-xs font-bold text-white rounded-xl transition-all border border-neon-purple/30 active:scale-95"
        >
          {creating ? 'Creando...' : '+ Agregar Encuentro'}
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] text-white/30 uppercase tracking-widest font-black px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-white/20" /> Pendiente
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> En curso · AC abierto
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-neon-cyan" /> Finalizada · AC resuelto
        </span>
      </div>

      {encounters.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
          <p className="text-white/40 font-orbitron text-sm uppercase tracking-widest">
            No hay partidas generadas
          </p>
        </div>
      ) : (
        encounters.map((encounter, idx) => {
          const rounds = getRounds(encounter.id)
          const hasRounds = rounds.length > 0

          return (
            <motion.div
              key={encounter.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08 }}
              className={`bg-dark-card/40 backdrop-blur-xl border rounded-3xl overflow-hidden shadow-2xl transition-colors ${
                encounter.isActive
                  ? 'border-green-400/30 shadow-green-400/5'
                  : encounter.isCompleted
                  ? 'border-neon-cyan/20'
                  : 'border-white/10'
              }`}
            >
              {/* Header */}
              <div className="px-8 py-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-orbitron font-black text-sm shrink-0 border ${
                    encounter.isActive
                      ? 'bg-green-400/10 border-green-400/30 text-green-400'
                      : encounter.isCompleted
                      ? 'bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan'
                      : 'bg-neon-purple/10 border-neon-purple/30 text-neon-purple'
                  }`}>
                    {encounter.matchNumber}
                  </div>
                  <div className="min-w-0">
                    <input
                      className="bg-transparent border-none text-lg font-orbitron font-black text-white p-0 focus:ring-0 w-56 hover:bg-white/5 transition-colors rounded px-2 -ml-2"
                      defaultValue={encounter.name}
                      onBlur={(e) => {
                        if (e.target.value !== encounter.name) {
                          handleUpdate(encounter.id, { name: e.target.value })
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => handleUpdate(encounter.id, { isWarmup: !encounter.isWarmup })}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                      encounter.isWarmup
                        ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/40'
                        : 'bg-white/5 text-white/40 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {encounter.isWarmup ? '🔥 Warmup' : 'Warmup?'}
                  </button>

                  {!hasRounds && <MatchControls match={encounter} />}

                  {saving === encounter.id && (
                    <div className="animate-spin w-4 h-4 border-2 border-neon-purple border-t-transparent rounded-full" />
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-6 sm:p-8 space-y-4">
                {!hasRounds ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-black ml-1">
                        Mapa
                      </label>
                      <input
                        placeholder="Ej. Erangel, Miramar..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-purple/50 focus:ring-1 focus:ring-neon-purple/50 transition-all outline-none"
                        defaultValue={encounter.mapName}
                        onBlur={(e) => handleUpdate(encounter.id, { mapName: e.target.value })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {rounds.map((round) => (
                      <div
                        key={round.id}
                        className={`group border rounded-2xl p-5 transition-all ${
                          round.isActive
                            ? 'bg-green-400/5 border-green-400/20'
                            : round.isCompleted
                            ? 'bg-neon-cyan/5 border-neon-cyan/10'
                            : 'bg-white/[0.03] border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                              <span className="bg-white/10 text-white/60 text-[10px] font-black px-2 py-0.5 rounded">
                                R{round.roundNumber}
                              </span>
                              <input
                                className="bg-transparent border-none text-white font-bold p-0 focus:ring-0 text-base hover:bg-white/5 transition-colors rounded px-1 -ml-1 w-full"
                                defaultValue={round.name}
                                onBlur={(e) => {
                                  if (e.target.value !== round.name) {
                                    handleUpdate(round.id, { name: e.target.value })
                                  }
                                }}
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <input
                                placeholder="Mapa (opcional)"
                                className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-neon-purple/50 focus:ring-1 focus:ring-neon-purple/50 transition-all outline-none"
                                defaultValue={round.mapName}
                                onBlur={(e) => handleUpdate(round.id, { mapName: e.target.value })}
                              />
                              <div className="flex items-center">
                                <MatchControls match={round} />
                              </div>
                            </div>
                          </div>
                          {saving === round.id && (
                            <div className="animate-spin w-4 h-4 border-2 border-neon-purple border-t-transparent rounded-full shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )
        })
      )}
    </div>
  )
}
