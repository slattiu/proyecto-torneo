'use client'

import { useState } from 'react'
import { reactivateTournament } from '@/lib/actions/tournaments'
import { useRouter } from 'next/navigation'

export function ReactivateTournamentButton({ id }: { id: string }) {
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  const handleReactivate = async () => {
    if (
      !confirm(
        '¿Reactivar este torneo? Volverá a estado activo y podrás seguir gestionando partidas. Podrás finalizarlo de nuevo cuando corresponda.'
      )
    ) {
      return
    }

    setIsPending(true)
    try {
      const result = await reactivateTournament(id)
      if (result && 'error' in result) {
        alert(result.error)
      } else {
        router.refresh()
      }
    } catch {
      alert('Error inesperado al reactivar el torneo')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <button
      onClick={handleReactivate}
      disabled={isPending}
      className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl
        font-orbitron font-black text-xs text-neon-cyan border border-neon-cyan/30 bg-neon-cyan/5
        hover:bg-neon-cyan/10 active:scale-[0.98] transition-all duration-150
        shadow-lg shadow-neon-cyan/5 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isPending ? (
        <div className="w-4 h-4 border-2 border-neon-cyan/20 border-t-neon-cyan rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      )}
      {isPending ? 'Reactivando...' : 'Reactivar Torneo'}
    </button>
  )
}
