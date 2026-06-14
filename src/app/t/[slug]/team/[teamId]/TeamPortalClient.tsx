'use client'

import { useState, useMemo, useEffect } from 'react'
import { createSubmission } from '@/lib/actions/submissions'
import { uploadEvidence } from '@/lib/actions/storage'

export function TeamPortalClient({
  tournament,
  team,
  participants,
  matches,
}: {
  tournament: any
  team: any
  participants: any[]
  matches: any[]
}) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [selectedParentId, setSelectedParentId] = useState('')
  
  // New state for individual kills
  const [playerKills, setPlayerKills] = useState<Record<string, number>>({})
  const [rank, setRank] = useState<number | ''>('')
  const [potTop, setPotTop] = useState(false)


  // Initialize playerKills when participants load
  useEffect(() => {
    if (participants && participants.length > 0) {
      const initial: Record<string, number> = {}
      participants.forEach(p => {
        initial[p.id] = 0
      })
      setPlayerKills(initial)
    }
  }, [participants])

  // Identify parent matches (Encuentros)
  const parentMatches = matches.filter(m => !m.parent_match_id)
  // Identify rounds for the selected parent
  const availableRounds = matches.filter(m => m.parent_match_id === selectedParentId)

  // Calculate total team kills in real-time
  const teamTotalKills = useMemo(() => {
    return Object.values(playerKills).reduce((acc, val) => acc + (val || 0), 0)
  }, [playerKills])

  const handleKillChange = (participantId: string, value: string) => {
    const num = parseInt(value, 10)
    setPlayerKills(prev => ({
      ...prev,
      [participantId]: isNaN(num) ? 0 : num
    }))
  }

  const handleRankChange = (value: string) => {
    const num = parseInt(value, 10)
    if (isNaN(num)) {
      setRank('')
    } else {
      setRank(num)
      if (num === 1) setPotTop(true)
      else setPotTop(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = e.currentTarget
    
    // If there are rounds, we use the round ID, otherwise the parent ID
    const roundSelect = form.elements.namedItem('roundId') as HTMLSelectElement
    const matchId = roundSelect ? roundSelect.value : (form.elements.namedItem('matchId') as HTMLSelectElement).value
    
    const submittedBy = (form.elements.namedItem('submittedBy') as HTMLSelectElement).value
    
    // Use state-based potTop and rank
    const finalRank = rank === '' ? undefined : rank
    const finalPotTop = potTop
    
    const fileBase = form.elements.namedItem('evidenceFile') as HTMLInputElement
    const file = fileBase?.files?.[0]

    if (!file) {
      setError('Debes subir una imagen de evidencia')
      setLoading(false)
      return
    }

    try {
      // 1. Upload file via Server Action (browser → Vercel → Supabase Storage)
      //    This avoids DNS resolution failures on mobile carrier networks.
      const fileExt = file.name.split('.').pop()
      const fileName = `${crypto.randomUUID()}.${fileExt}`
      const filePath = `${tournament.id}/${team.id}/${matchId}/${fileName}`

      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('filePath', filePath)

      const uploadResult = await uploadEvidence(uploadFormData)
      if ('error' in uploadResult) {
        throw new Error('Error al subir la imagen: ' + uploadResult.error)
      }

      // 2. Submit with player breakdown
      const res = await createSubmission({
        tournamentId: tournament.id,
        teamId: team.id,
        matchId: matchId,
        submittedBy: submittedBy,
        killCount: teamTotalKills,
        playerKills: playerKills,
        rank: finalRank,
        potTop: finalPotTop,
        evidence: {
          storagePath: uploadResult.path,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }
      })

      if (res && 'error' in res) {
        throw new Error(res.error)
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-10 animate-in zoom-in duration-300">
        <div className="w-16 h-16 rounded-full bg-neon-cyan/20 border border-neon-cyan mx-auto flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(0,245,255,0.2)]">
          <span className="text-neon-cyan text-3xl">✓</span>
        </div>
        <h3 className="text-2xl font-orbitron font-bold text-white mb-2">¡Evidencia Enviada!</h3>
        <p className="text-white/60 mb-8">El organizador y la IA revisarán los resultados pronto.</p>
        <button 
          onClick={() => {
            setSuccess(false)
            setError('')
          }}
          className="px-6 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all font-medium"
        >
          Enviar otra partida
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Match Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 ml-1">Encuentro / Partida</label>
          <select 
            name="matchId" 
            required
            value={selectedParentId}
            onChange={(e) => setSelectedParentId(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-all text-white appearance-none"
          >
            <option value="">Seleccionar...</option>
            {parentMatches.map(m => (
              <option key={m.id} value={m.id}>
                {m.name || `Encuentro ${m.match_number}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 ml-1">Quien envía</label>
          <select 
            name="submittedBy" 
            required
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-all text-white"
          >
            {participants.map(p => (
              <option key={p.id} value={p.id}>
                {p.display_name} {p.is_captain && tournament.mode !== 'individual' ? '(C)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {availableRounds.length > 0 && (
        <div className="animate-in slide-in-from-top-4 duration-500">
          <label className="block text-[10px] font-black uppercase tracking-widest text-neon-cyan mb-2 ml-1">Especificar Ronda</label>
          <select 
            name="roundId" 
            required
            className="w-full bg-neon-cyan/5 border border-neon-cyan/30 rounded-xl px-4 py-3 outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-all text-neon-cyan font-bold"
          >
            <option value="">Seleccionar ronda...</option>
            {availableRounds.map(r => (
              <option key={r.id} value={r.id}>
                {r.name} {r.map_name ? `(${r.map_name})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Individual Kills Section */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Kills Individuales</h3>
          <div className="px-3 py-1 rounded-full bg-neon-cyan/10 border border-neon-cyan/20">
            <span className="text-[10px] font-orbitron font-bold text-neon-cyan">Total Equipo: {teamTotalKills}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {participants.map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-black/20 p-2.5 rounded-xl border border-white/5 focus-within:border-white/20 transition-all">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-bold text-white/40">
                {p.is_captain ? '👑' : '•'}
              </div>
              <span className="flex-1 text-xs text-white/80 font-medium truncate">{p.display_name}</span>
              <input 
                type="number"
                min="0"
                value={playerKills[p.id] || 0}
                onChange={(e) => handleKillChange(p.id, e.target.value)}
                className="w-16 bg-black/40 border border-white/10 rounded-lg py-1.5 text-center font-orbitron text-neon-cyan outline-none focus:border-neon-cyan transition-all"
              />
            </div>
          ))}
          {participants.length === 0 && (
            <div className="col-span-full py-4 text-center text-white/20 text-xs italic">
              No hay jugadores en el equipo
            </div>
          )}
        </div>
      </div>
      
      {/* Placement & Victory */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex flex-col justify-center">
          <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-3 ml-1">Posición / Top Logrado</label>
          <div className="flex items-center gap-4">
            <input 
              type="number"
              min="1"
              max="100"
              placeholder="Ej. 1"
              value={rank}
              onChange={(e) => handleRankChange(e.target.value)}
              required
              className="w-24 bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-all text-white font-orbitron text-center text-lg"
            />
            <div className="flex-1">
              <p className="text-[10px] text-white/30 font-medium leading-relaxed uppercase tracking-tighter">
                Indica en qué lugar quedó tu equipo (ej: Top 1 si ganaste, Top 2 para segundo, etc.)
              </p>
            </div>
          </div>
        </div>

        {tournament.pot_top_enabled && (
          <label className={`flex items-center gap-4 px-6 py-5 rounded-2xl border transition-all group cursor-pointer ${
            potTop ? 'bg-gold/10 border-gold shadow-[0_0_15px_rgba(255,215,0,0.1)]' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
          }`}>
            <div className="relative">
              <input 
                type="checkbox" 
                checked={potTop}
                onChange={(e) => setPotTop(e.target.checked)}
                className="peer sr-only" 
              />
              <div className={`w-6 h-6 border-2 rounded-lg flex items-center justify-center transition-all shadow-lg group-hover:scale-110 ${
                potTop ? 'bg-gold border-gold' : 'border-white/10'
              }`}>
                <svg className={`w-4 h-4 text-black ${potTop ? 'opacity-100' : 'opacity-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              </div>
            </div>
            <div className="flex flex-col">
              <span className={`text-sm font-orbitron font-black uppercase tracking-tighter ${potTop ? 'text-gold' : 'text-white/40'}`}>¿Victoria de Partida?</span>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${potTop ? 'text-gold/60' : 'text-white/20'}`}>Booyah! / Winner Winner</span>
            </div>
          </label>
        )}
      </div>

      {/* File Upload */}
      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 ml-1">Captura de evidencia</label>
        <div className="relative group">
          <input 
            type="file" 
            name="evidenceFile" 
            accept="image/*"
            required
            className="w-full text-xs text-white/50 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-[0.1em] file:bg-neon-cyan/20 file:text-neon-cyan hover:file:bg-neon-cyan/30 file:transition-all bg-black/40 border border-white/10 rounded-xl p-2 group-hover:border-white/20 transition-all cursor-pointer"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium animate-shake">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || participants.length === 0}
        className="w-full relative group overflow-hidden rounded-2xl p-[1px] disabled:opacity-50 transition-all active:scale-[0.98]"
      >
        <span className="absolute inset-0 bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-cyan bg-[length:200%_auto] animate-gradient-x opacity-80 group-hover:opacity-100 transition-opacity" />
        <div className="relative bg-[#0a0a0b]/90 px-8 py-4 rounded-[15px] transition-all group-hover:bg-transparent">
          <span className="relative font-orbitron font-black text-white tracking-[0.2em] uppercase text-sm">
            {loading ? 'Procesando...' : 'Subir Resultados'}
          </span>
        </div>
      </button>
    </form>
  )
}
