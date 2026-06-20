'use client'
import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { signUp } from '@/lib/actions/auth'
import { z } from 'zod'
import { useState } from 'react'

const registerSchema = z
  .object({
    username: z.string()
      .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
      .max(30, 'El nombre de usuario no puede exceder los 30 caracteres')
      .regex(/^[a-zA-Z0-9_]+$/, 'El nombre de usuario solo puede contener letras, números y guión bajo (_)'),
    email: z.string().email('Email inválido'),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-neon-cyan to-neon-purple hover:opacity-90 disabled:opacity-50 transition-opacity mt-2"
    >
      {pending ? 'Creando cuenta...' : 'Crear cuenta'}
    </button>
  )
}

export default function RegisterPage() {
  const [state, action] = useFormState(signUp, null)
  const [clientError, setClientError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget
    const result = registerSchema.safeParse({
      username: (form.elements.namedItem('username') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      password: (form.elements.namedItem('password') as HTMLInputElement).value,
      confirmPassword: (form.elements.namedItem('confirmPassword') as HTMLInputElement).value,
    })
    if (!result.success) {
      e.preventDefault()
      setClientError(result.error.errors[0].message)
    } else {
      setClientError(null)
    }
  }

  if (state && 'success' in state) {
    return (
      <div>
        <div className="text-center mb-8">
          <h1 className="font-orbitron text-2xl font-bold tracking-widest text-neon-cyan uppercase">
            Tournament
          </h1>
          <p className="font-orbitron text-xs tracking-[0.3em] text-white/40 uppercase mt-1">
            Leaderboard Platform
          </p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-neon-cyan/20 border border-neon-cyan/40 flex items-center justify-center mx-auto mb-4">
            <span className="text-neon-cyan text-xl">✓</span>
          </div>
          <h2 className="text-white font-semibold text-xl mb-2">¡Revisa tu email!</h2>
          <p className="text-white/60 text-sm">{state.success}</p>
          <Link
            href="/login"
            className="inline-block mt-6 text-neon-cyan text-sm hover:underline"
          >
            Volver al login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Logo */}
      <div className="text-center mb-8">
        <h1 className="font-orbitron text-2xl font-bold tracking-widest text-neon-cyan uppercase">
          Tournament
        </h1>
        <p className="font-orbitron text-xs tracking-[0.3em] text-white/40 uppercase mt-1">
          Leaderboard Platform
        </p>
      </div>

      {/* Card */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 relative">
        <h2 className="text-white font-semibold text-xl mb-6">Crear cuenta</h2>

        <form action={action} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm text-white/60 mb-1.5">
              Nombre de Usuario (Nickname)
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-colors"
              placeholder="tu_nickname"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm text-white/60 mb-1.5">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-colors"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-white/60 mb-1.5">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-colors"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm text-white/60 mb-1.5">
              Confirmar contraseña
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-colors"
              placeholder="Repite tu contraseña"
            />
          </div>

          {(clientError ?? (state && 'error' in state && state.error)) && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {clientError ?? (state && 'error' in state ? state.error : '')}
            </p>
          )}

          <SubmitButton />
        </form>

        <p className="text-center text-white/40 text-sm mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-neon-cyan hover:underline">
            Inicia sesión
          </Link>
        </p>

        {/* Sello Discreto */}
        <div className="mt-8 pt-4 border-t border-white/5 text-center flex flex-col items-center justify-center opacity-40 select-none">
           <span className="text-[8px] font-orbitron uppercase tracking-widest text-white/70">Powered by</span>
           <span className="text-[10px] font-orbitron font-bold uppercase tracking-widest text-white mt-0.5">GonzalezLabs</span>
        </div>
      </div>
    </div>
  )
}
