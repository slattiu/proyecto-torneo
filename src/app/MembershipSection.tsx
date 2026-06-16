'use client'

import { Orbitron } from 'next/font/google'
import Link from 'next/link'
import { useState } from 'react'
import { requestSubscription } from '@/lib/actions/subscriptions'
import { useRouter } from 'next/navigation'

const orbitron = Orbitron({ subsets: ['latin'] })

export function MembershipSection({ user, profile }: { user: any, profile: any }) {
  const [loading, setLoading] = useState(false)
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const router = useRouter()

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!evidenceUrl) return
    setLoading(true)
    const res = await requestSubscription(evidenceUrl)
    if ('error' in res) alert(res.error)
    else alert('Solicitud enviada. El administrador revisará tu pago pronto.')
    setLoading(false)
    router.refresh()
  }

  return (
    <section className="py-20 md:py-32 px-4 sm:px-8">
      <div className="max-w-4xl mx-auto bg-gradient-to-b from-[#121219] to-[#0a0a0b] border border-white/10 rounded-[30px] md:rounded-[40px] p-6 sm:p-12 text-center relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-neon-cyan to-transparent opacity-50" />
        
        {!user ? (
          <>
            <h2 className={`${orbitron.className} text-2xl sm:text-4xl font-black uppercase mb-4 sm:mb-6`}>Únete a la <span className="text-neon-cyan">Élite</span></h2>
            <p className="text-white/40 mb-8 sm:mb-10 text-sm sm:text-lg max-w-xl mx-auto leading-relaxed">Inicia sesión para solicitar tu membresía de Streamer Pro y empezar a organizar tus propios torneos profesionales.</p>
            <Link href="/login" className="w-full sm:w-auto inline-block text-center px-6 md:px-12 py-4 md:py-5 bg-neon-cyan text-black font-black text-xs md:text-sm uppercase tracking-widest rounded-2xl hover:bg-[#00D1DB] transition-all">
              Inicia Sesión
            </Link>
          </>
        ) : profile?.subscriptionStatus === 'ACTIVE' ? (
          <>
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 border border-green-500/30">
               <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className={`${orbitron.className} text-2xl sm:text-4xl font-black uppercase mb-4 sm:mb-6`}>Eres <span className="text-green-500">Streamer Pro</span></h2>
            <p className="text-white/40 mb-8 sm:mb-10 text-sm sm:text-lg max-w-xl mx-auto leading-relaxed text-balance">Tienes acceso total para crear torneos ilimitados, gestionar premios y personalizar leaderboards para tu comunidad.</p>
            <Link href="/tournaments" className="w-full sm:w-auto inline-block text-center px-6 md:px-12 py-4 md:py-5 bg-white text-black font-black text-xs md:text-sm uppercase tracking-widest rounded-2xl hover:bg-neon-cyan transition-all">
              Ir al Dashboard
            </Link>
          </>
        ) : profile?.subscriptionStatus === 'PENDING' ? (
           <>
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-yellow-500/20 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 border border-yellow-500/30">
               <svg className="w-8 h-8 sm:w-10 sm:h-10 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h2 className={`${orbitron.className} text-2xl sm:text-4xl font-black uppercase mb-4 sm:mb-6`}>Pago en <span className="text-yellow-500">Revisión</span></h2>
            <p className="text-white/40 mb-8 sm:mb-10 text-sm sm:text-lg max-w-xl mx-auto leading-relaxed">Hemos recibido tu comprobante. El administrador validará el pago de $15 pronto para activar tu cuenta.</p>
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/20">Espera un momento...</div>
          </>
        ) : (
          <div className="max-w-2xl mx-auto">
            <h2 className={`${orbitron.className} text-2xl sm:text-4xl font-black uppercase mb-4`}>Plan <span className="text-neon-cyan">Streamer Pro</span></h2>
            <div className="text-4xl sm:text-5xl font-black text-white mb-6">$15<span className="text-sm font-normal text-white/40">/mes</span></div>
            
            <ul className="text-left space-y-4 mb-10">
               <li className="flex items-center gap-3 text-white/60 text-sm">
                  <svg className="w-5 h-5 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Creación y gestión de torneos ilimitados
               </li>
               <li className="flex items-center gap-3 text-white/60 text-sm">
                  <svg className="w-5 h-5 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Leaderboard en vivo personalizado para tu comunidad
               </li>
               <li className="flex items-center gap-3 text-white/60 text-sm">
                  <svg className="w-5 h-5 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Exportación de estadísticas y reportes en CSV
               </li>
               <li className="flex items-center gap-3 text-white/60 text-sm">
                  <svg className="w-5 h-5 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Soporte técnico prioritario 24/7
               </li>

            </ul>

            <div className="bg-white/5 border border-white/5 p-6 rounded-2xl mb-8 text-left">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Instrucciones de Pago</h4>
               <p className="text-sm text-white/80 leading-relaxed mb-4 italic">Realiza el pago de $15 vía USDT (Polygon/Binance) a la wallet del admin y sube el enlace del comprobante o captura aquí abajo.</p>
               <div className="text-xs font-mono bg-black/40 p-2 rounded border border-white/10 break-all text-neon-cyan">
                  0x742d35Cc6634C0532925a3b844Bc454e4438f44e -- Placeholder Admin Wallet
               </div>
            </div>

            <form onSubmit={handleRequest} className="space-y-4">
               <input 
                 required
                 value={evidenceUrl}
                 onChange={(e) => setEvidenceUrl(e.target.value)}
                 placeholder="URL del comprobante o TxHash"
                 className="w-full bg-[#0a0a0b] border border-white/10 rounded-xl px-6 py-4 outline-none focus:border-neon-cyan transition-colors text-sm"
               />
               <button 
                 disabled={loading}
                 className="w-full py-5 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-neon-cyan transition-all disabled:opacity-50"
               >
                 {loading ? 'Enviando...' : 'Solicitar Acceso Pro'}
               </button>
            </form>
          </div>
        )}
      </div>
    </section>
  )
}
