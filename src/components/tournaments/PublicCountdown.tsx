'use client'

import { useState, useEffect } from 'react'

interface PublicCountdownProps {
  registrationStartDate: string | null
  registrationEndDate: string | null
  startDate: string | null
  endDate: string | null
  status: string
}

export function PublicCountdown({
  registrationStartDate,
  registrationEndDate,
  startDate,
  endDate,
  status,
}: PublicCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{
    label: string
    colorClass: string
    glowClass: string
    text: string
  } | null>(null)

  useEffect(() => {
    function calculateTime() {
      const now = new Date().getTime()
      const regStart = registrationStartDate ? new Date(registrationStartDate).getTime() : null
      const regEnd = registrationEndDate ? new Date(registrationEndDate).getTime() : null
      const start = startDate ? new Date(startDate).getTime() : null
      const end = endDate ? new Date(endDate).getTime() : null

      // Status helper states
      const hasRegStarted = regStart ? now >= regStart : true
      const hasRegEnded = regEnd ? now > regEnd : false
      const isRegOpen = hasRegStarted && !hasRegEnded

      let targetTime: number | null = null
      let label = ''
      let colorClass = 'text-white/60'
      let glowClass = 'shadow-none'

      if (status === 'finished') {
        return {
          label: 'Torneo',
          colorClass: 'text-white/30',
          glowClass: '',
          text: 'FINALIZADO',
        }
      }

      // 1. Registration is open (or not started yet)
      if (regStart && now < regStart) {
        targetTime = regStart
        label = 'Apertura registro'
        colorClass = 'text-neon-purple'
        glowClass = 'shadow-neon-purple/20'
      } else if (isRegOpen && regEnd) {
        targetTime = regEnd
        label = 'Registro cierra en'
        colorClass = 'text-neon-purple font-medium'
        glowClass = 'shadow-neon-purple/20'
      }
      // 2. Registrations closed, tournament hasn't started yet
      else if (start && now < start) {
        targetTime = start
        label = 'Empieza en'
        colorClass = 'text-neon-cyan font-medium'
        glowClass = 'shadow-neon-cyan/20'
      }
      // 3. Tournament is in progress (active)
      else if (status === 'active' || (start && now >= start && end && now < end)) {
        targetTime = end
        label = 'Finaliza en'
        colorClass = 'text-red-400 font-bold'
        glowClass = 'shadow-red-500/20'
      } else {
        return null
      }

      if (targetTime === null) return null

      const difference = targetTime - now
      if (difference <= 0) {
        // Fallback for when countdown reaches zero but page hasn't reloaded
        return {
          label: label,
          colorClass: colorClass,
          glowClass: glowClass,
          text: '--:--:--',
        }
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24))
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((difference % (1000 * 60)) / 1000)

      let text = ''
      if (days > 0) {
        text += `${days}d `
      }
      text += `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`

      return {
        label,
        colorClass,
        glowClass,
        text,
      }
    }

    // Initialize state
    setTimeLeft(calculateTime())

    const timer = setInterval(() => {
      setTimeLeft(calculateTime())
    }, 1000)

    return () => clearInterval(timer)
  }, [registrationStartDate, registrationEndDate, startDate, endDate, status])

  if (!timeLeft) return null

  return (
    <div className="flex flex-col gap-0.5 mt-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/5 shadow-inner">
      <div className="flex justify-between items-center text-[9px] uppercase tracking-wider text-white/30 font-bold px-1">
        <span>⏰ {timeLeft.label}</span>
      </div>
      <div className={`text-xs font-mono tracking-wider ${timeLeft.colorClass} px-1 font-semibold flex items-center gap-1.5`}>
        {timeLeft.text}
      </div>
    </div>
  )
}
