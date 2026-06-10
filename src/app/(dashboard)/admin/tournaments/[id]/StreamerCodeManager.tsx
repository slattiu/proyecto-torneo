'use client'

import { useState } from 'react'
import { generateStreamerCode, toggleStreamerCode } from '@/lib/actions/codes'
import { useRouter } from 'next/navigation'

export function StreamerCodeManager({ 
  tournamentId, 
  existingCodes 
}: { 
  tournamentId: string, 
  existingCodes: any[] 
}) {
  const [streamerName, setStreamerName] = useState('')
  const [customCode, setCustomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!streamerName) return
    setLoading(true)
    const res = await generateStreamerCode(tournamentId, streamerName, customCode)
    if ('error' in res) alert(res.error)
    else {
      setStreamerName('')
      setCustomCode('')
      router.refresh()
    }
    setLoading(false)
  }

  const handleToggle = async (codeId: string, currentState: boolean) => {
    setLoading(true)
    await toggleStreamerCode(codeId, !currentState)
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="bg-[#121219] border border-white/5 rounded-2xl overflow-hidden h-full flex flex-col">
       <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02]">
          <h3 className="text-xs font-black uppercase tracking-widest">Gestión de Códigos</h3>
       </div>

       <div className="p-6 border-b border-white/5">
         <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase font-black tracking-widest text-white/40 mb-2">Nombre del Streamer</label>
              <input 
                value={streamerName}
                onChange={(e) => setStreamerName(e.target.value)}
                placeholder="Ej: Franlys"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-neon-cyan outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-black tracking-widest text-white/40 mb-2">Código Personalizado (Opcional)</label>
              <input 
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                placeholder="Ej: FRANLYS-WZ"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-neon-cyan outline-none"
              />
            </div>
            <button 
              disabled={loading || !streamerName}
              className="w-full bg-white text-black font-black uppercase tracking-tighter py-3 rounded-xl hover:bg-neon-cyan transition-all disabled:opacity-50"
            >
              {loading ? 'Generando...' : 'Generar Código'}
            </button>
         </form>
       </div>

       <div className="flex-1 overflow-y-auto max-h-[400px]">
          {existingCodes.length === 0 ? (
            <div className="p-10 text-center text-white/20 text-[10px] font-bold uppercase tracking-widest">
              Sin códigos generados
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {existingCodes.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between group">
                   <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black font-mono text-neon-cyan">{c.code}</span>
                        {!c.is_active && <span className="text-[8px] px-1 bg-red-500/20 text-red-500 rounded uppercase">Inactivo</span>}
                      </div>
                      <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">{c.streamer_name}</div>
                   </div>
                   <button 
                     onClick={() => handleToggle(c.id, c.is_active)}
                     className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border transition-all ${
                       c.is_active ? 'border-red-500/30 text-red-500 hover:bg-red-500/10' : 'border-green-500/30 text-green-500 hover:bg-green-500/10'
                     }`}
                   >
                     {c.is_active ? 'Desactivar' : 'Activar'}
                   </button>
                </div>
              ))}
            </div>
          )}
       </div>
    </div>
  )
}
