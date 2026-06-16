'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleTournamentPrivacy } from '@/lib/actions/tournaments'

interface VisibilityToggleProps {
  id: string
  isPrivate: boolean
}

export function VisibilityToggle({ id, isPrivate }: VisibilityToggleProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleToggle() {
    startTransition(async () => {
      const res = await toggleTournamentPrivacy(id, !isPrivate)
      if ('error' in res) {
        alert(res.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 border disabled:opacity-50 ${
        isPrivate
          ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
      }`}
      title={isPrivate ? 'El torneo está oculto. Haz clic para hacerlo público.' : 'El torneo es público. Haz clic para ocultarlo.'}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isPrivate ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
      {isPending ? 'Cambiando...' : isPrivate ? 'Oculto / Privado' : 'Público'}
    </button>
  )
}
