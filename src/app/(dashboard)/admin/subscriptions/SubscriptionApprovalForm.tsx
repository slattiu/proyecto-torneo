'use client'

import { useState } from 'react'
import { approveSubscription, rejectSubscription } from '@/lib/actions/subscriptions'
import { useRouter } from 'next/navigation'

export function SubscriptionApprovalForm({ requestId, userId }: { requestId: string, userId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleApprove = async () => {
    if (!confirm('¿Confirmas que el pago de $15 fue recibido correctamente?')) return
    setLoading(true)
    const res = await approveSubscription(requestId, userId)
    if ('error' in res) alert(res.error)
    setLoading(false)
    router.refresh()
  }

  const handleReject = async () => {
    const notes = prompt('Motivo del rechazo:')
    if (notes === null) return
    setLoading(true)
    const res = await rejectSubscription(requestId, userId, notes)
    if ('error' in res) alert(res.error)
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-4 pt-4 border-t border-white/5">
      <button 
        onClick={handleApprove}
        disabled={loading}
        className="flex-1 bg-neon-cyan text-black font-black uppercase tracking-tighter py-3 rounded-xl hover:bg-[#00D1DB] transition-colors disabled:opacity-50"
      >
        {loading ? 'Procesando...' : 'Aprobar Pago'}
      </button>
      <button 
        onClick={handleReject}
        disabled={loading}
        className="px-6 border border-red-500/30 text-red-500 font-bold uppercase tracking-widest text-[10px] hover:bg-red-500/10 transition-colors py-3 rounded-xl disabled:opacity-50"
      >
        Rechazar
      </button>
    </div>
  )
}
