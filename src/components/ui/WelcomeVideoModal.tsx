'use client'

import { useEffect, useState, useRef } from 'react'
import { Orbitron } from 'next/font/google'

const orbitron = Orbitron({ subsets: ['latin'] })

export function WelcomeVideoModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    // Check if the user has already seen the welcome video
    const hasSeen = localStorage.getItem('has_seen_welcome_video_v1')
    if (!hasSeen) {
      setIsOpen(true)
    }
  }, [])

  const handleClose = () => {
    setIsOpen(false)
    localStorage.setItem('has_seen_welcome_video_v1', 'true')
    if (videoRef.current) {
      videoRef.current.pause()
    }
  }

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted
      setIsMuted(videoRef.current.muted)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity duration-500 animate-fade-in">
      <div className="relative w-full max-w-4xl bg-[#0d0d0f] rounded-3xl border border-white/10 overflow-hidden shadow-[0_0_50px_rgba(0,245,255,0.25)] flex flex-col">
        
        {/* Header decoration */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#121219] border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500/80 animate-pulse" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className={`${orbitron.className} text-xs font-black uppercase tracking-[0.2em] text-neon-cyan drop-shadow-[0_0_10px_rgba(0,245,255,0.5)]`}>
            Bienvenido a Kronix
          </span>
          <button 
            onClick={handleClose} 
            className="text-white/40 hover:text-white transition-colors text-xs font-black uppercase tracking-wider bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10"
          >
            Saltar ✕
          </button>
        </div>

        {/* Video Player */}
        <div className="relative aspect-video w-full bg-black">
          <video
            ref={videoRef}
            src="/bienvenida.mp4"
            autoPlay
            muted={isMuted}
            playsInline
            loop
            className="w-full h-full object-contain"
          />

          {/* Mute/Unmute Overlay Helper */}
          <div className="absolute bottom-4 left-4 z-10 flex gap-2">
            <button
              onClick={toggleMute}
              className="flex items-center gap-2 px-4 py-2 bg-black/60 hover:bg-black/80 border border-white/10 hover:border-neon-cyan/50 text-white rounded-xl text-xs font-bold transition-all backdrop-blur-sm shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
            >
              {isMuted ? (
                <>
                  <span>🔊</span> Activar Sonido
                </>
              ) : (
                <>
                  <span>🔇</span> Silenciar
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-5 bg-[#121219] border-t border-white/5 gap-4">
          <p className="text-white/45 text-[11px] text-center sm:text-left leading-relaxed">
            Presiona el botón para ingresar al portal oficial de los e-sports dominicanos.
          </p>
          <button
            onClick={handleClose}
            className={`w-full sm:w-auto px-8 py-3.5 text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(0,245,255,0.3)] bg-neon-cyan hover:bg-[#33f7ff] active:scale-[0.98] ${orbitron.className}`}
            style={{ boxShadow: `0 0 25px rgba(0, 245, 255, 0.4)` }}
          >
            Entrar al Portal
          </button>
        </div>
      </div>
    </div>
  )
}
