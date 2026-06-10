'use client'

import { useTransition } from 'react'
import { deleteUserByAdmin } from '@/lib/actions/admin'

interface DeleteUserButtonProps {
  userId: string
  userEmail: string
}

export function DeleteUserButton({ userId, userEmail }: DeleteUserButtonProps) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario ${userEmail}? Esta acción borrará su perfil y cuenta de manera irreversible.`)) {
      startTransition(async () => {
        const res = await deleteUserByAdmin(userId)
        if (res && 'error' in res) {
          alert(res.error)
        }
      })
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="p-1.5 text-red-500/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-40"
      title="Eliminar usuario"
    >
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  )
}
