import { createClient } from '@/lib/supabase/server'
import { Orbitron } from 'next/font/google'
import Link from 'next/link'

const orbitron = Orbitron({ subsets: ['latin'] })

export default async function AdminTournamentsPage() {
  const supabase = await createClient()
  
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select(`
      *,
      profiles:creator_id (
        username
      )
    `)
    .order('created_at', { ascending: false })

  const statusColors = {
    draft: 'bg-white/10 text-white/40',
    active: 'bg-red-500/20 text-red-500 border-red-500/20',
    finished: 'bg-green-500/20 text-green-500 border-green-500/20'
  }

  return (
    <div className="space-y-12">
      <header>
        <h1 className={`${orbitron.className} text-4xl font-black uppercase tracking-tighter mb-2`}>
          Panel de <span className="text-neon-cyan">Torneos</span>
        </h1>
        <p className="text-white/40 text-lg">Supervisa todos los torneos y gestiona los códigos de streamers.</p>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#121219]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 text-[10px] uppercase font-black tracking-widest text-white/40">
              <th className="px-6 py-4">Torneo</th>
              <th className="px-6 py-4">Organizador</th>
              <th className="px-6 py-4">Estado</th>
              <th className="px-6 py-4">Apuestas</th>
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {tournaments?.map((t) => (
              <tr key={t.id} className="group hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-white group-hover:text-neon-cyan transition-colors">{t.name}</div>
                  <div className="text-[10px] text-white/20 font-mono">{t.slug}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-bold text-white/60">{t.profiles?.username || 'Desconocido'}</div>
                </td>
                <td className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">
                  <span className={`px-2 py-1 rounded border ${statusColors[t.status as keyof typeof statusColors]}`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {t.arena_betting_enabled ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan" />
                      <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Activas</span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Deshabilitadas</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link 
                    href={`/admin/tournaments/${t.id}`}
                    className="inline-flex items-center gap-2 bg-white/5 hover:bg-neon-cyan hover:text-black px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                  >
                    Gestionar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
