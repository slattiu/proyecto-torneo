'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { signOut } from '@/lib/actions/auth'
import { motion, AnimatePresence } from 'framer-motion'

export default function DashboardShell({ children, userRole }: { children: React.ReactNode; userRole: 'ADMIN' | 'STREAMER' | 'USER' }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [])

  const NavLinks = () => (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {userRole !== 'USER' && (
        <Link
          href="/tournaments"
          onClick={() => setDrawerOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h18M3 12h18M3 17h18" />
          </svg>
          Mis Torneos
        </Link>
      )}

      {userRole === 'ADMIN' && (
        <>
          <div className="px-3 pt-4 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Administración</span>
          </div>
          <Link
            href="/admin"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-neon-cyan/70 hover:text-neon-cyan hover:bg-neon-cyan/5 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Panel Admin
          </Link>
          <Link
            href="/admin/users"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Usuarios
          </Link>
          <Link
            href="/admin/subscriptions"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Suscripciones
          </Link>
          <Link
            href="/admin/revenue"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Ingresos
          </Link>
          <Link
            href="/admin/settings"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Personalizar Inicio
          </Link>
        </>
      )}
    </nav>
  )

  const SidebarFooter = () => (
    <div className="px-3 py-4 border-t border-white/5 space-y-1">
      <Link
        href="/profile"
        onClick={() => setDrawerOpen(false)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Mi Perfil
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar sesión
        </button>
      </form>
      <div className="mt-6 text-center opacity-30 pointer-events-none select-none">
        <span className="text-[9px] uppercase tracking-widest block font-orbitron">Powered by</span>
        <span className="text-xs font-bold uppercase tracking-wider mt-0.5 block font-orbitron text-neon-cyan">GonzalezLabs</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-dark-bg flex">
      {/* Desktop Sidebar — hidden on mobile */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-dark-card border-r border-white/5 flex-col h-screen sticky top-0 overflow-y-auto">
        <div className="px-6 py-5 border-b border-white/5">
          <Link href="/tournaments" className="flex items-center gap-2.5 group">
            <img 
              src="/logo.png" 
              alt="KRONIX Logo" 
              className="w-6 h-6 object-contain transition-transform duration-300 group-hover:scale-105" 
            />
            <div>
              <span className="font-sans font-black tracking-[0.2em] text-xs text-white uppercase group-hover:text-neon-cyan transition-colors">KRONIX</span>
              <span className="block font-sans text-[8px] tracking-[0.15em] text-white/30 uppercase -mt-0.5">by GonzalezLabs</span>
            </div>
          </Link>
        </div>
        <NavLinks />
        <SidebarFooter />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-dark-card/95 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 py-3">
        <Link href="/tournaments" className="flex items-center gap-2 group">
          <img 
            src="/logo.png" 
            alt="KRONIX Logo" 
            className="w-5 h-5 object-contain" 
          />
          <span className="font-sans font-black tracking-[0.2em] text-xs text-white uppercase">KRONIX</span>
        </Link>
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Abrir menú"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            {/* Drawer panel */}
            <motion.aside
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-dark-card border-r border-white/5 flex flex-col"
            >
              <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                <Link href="/tournaments" onClick={() => setDrawerOpen(false)}>
                  <span className="font-orbitron text-sm font-bold tracking-widest text-neon-cyan uppercase">Tournament</span>
                  <span className="block font-orbitron text-[10px] tracking-[0.25em] text-white/30 uppercase mt-0.5">Platform</span>
                </Link>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <NavLinks />
              <SidebarFooter />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content — padding top on mobile for the fixed header */}
      <main className="flex-1 overflow-auto pt-[52px] lg:pt-0">
        {children}
      </main>
    </div>
  )
}
