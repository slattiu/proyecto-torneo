'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Orbitron } from 'next/font/google'
import { updateProfile } from '@/lib/actions/profile'
import { toast } from 'sonner'

const orbitron = Orbitron({ subsets: ['latin'] })

interface NicknameModalProps {
  onComplete: () => void
}

export function NicknameModal({ onComplete }: NicknameModalProps) {
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = nickname.trim()
    if (!trimmed || trimmed.length < 3) {
      setError('El nickname debe tener al menos 3 caracteres.')
      return
    }
    if (trimmed.length > 30) {
      setError('El nickname no puede tener más de 30 caracteres.')
      return
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(trimmed)) {
      setError('Solo letras, números, _, - y . están permitidos.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('username', trimmed)
      const res = await updateProfile(fd)
      if (res && 'error' in res) {
        setError(res.error || 'Error al guardar el nickname.')
      } else {
        toast.success('¡Nickname guardado exitosamente!')
        onComplete()
      }
    } catch {
      setError('Error inesperado. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 30 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="w-full max-w-md bg-[#0d0d0f] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* Header glow bar */}
          <div className="h-1 bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-cyan" />

          <div className="p-8 space-y-6">
            {/* Icon & Title */}
            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/20 rounded-2xl flex items-center justify-center text-3xl">
                🎮
              </div>
              <div>
                <h2 className={`${orbitron.className} text-xl font-black text-white`}>
                  ¡Bienvenido a KRONIX!
                </h2>
                <p className="text-sm text-white/50 mt-1 leading-relaxed">
                  Antes de continuar, elige tu <span className="text-neon-cyan font-bold">Nickname</span>.<br />
                  Este nombre te identificará en los torneos.
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-white/50 mb-2 ml-1">
                  Tu Nickname / GamerTag
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={e => { setNickname(e.target.value); setError('') }}
                  placeholder="Ej: SniperKing99"
                  maxLength={30}
                  autoFocus
                  className="w-full bg-black/50 border border-white/10 focus:border-neon-cyan/60 focus:ring-1 focus:ring-neon-cyan/20 rounded-xl px-4 py-3.5 text-white text-base font-bold placeholder:text-white/20 outline-none transition-all"
                />
                {error && (
                  <p className="text-xs text-red-400 mt-1.5 ml-1">{error}</p>
                )}
                <p className="text-[10px] text-white/30 mt-1.5 ml-1">
                  {nickname.length}/30 caracteres · Solo letras, números, _ - .
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || nickname.trim().length < 3}
                className="w-full py-3.5 bg-neon-cyan hover:bg-neon-cyan/90 active:scale-[0.98] text-black font-black text-sm uppercase tracking-widest rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_24px_rgba(0,245,255,0.2)]"
              >
                {loading ? 'Guardando...' : '¡Entrar a KRONIX! 🚀'}
              </button>
            </form>

            <p className="text-[10px] text-white/20 text-center">
              Podrás cambiar tu nickname más adelante desde tu perfil.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
