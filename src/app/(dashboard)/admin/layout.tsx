import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/actions/auth-helpers'
import Link from 'next/link'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const allowed = await isAdmin()

  if (!allowed) {
    redirect('/tournaments')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Admin Sidebar/Navbar */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-[#121219] border-b border-white/5 flex items-center px-8 z-50">
        <div className="flex items-center gap-8">
          <Link href="/admin" className="font-black tracking-tighter text-xl">
            ARENA<span className="text-neon-cyan">ADMIN</span>
          </Link>
          
          <div className="flex items-center gap-6 text-sm font-bold uppercase tracking-widest text-white/60">
            <Link href="/admin/subscriptions" className="hover:text-neon-cyan transition-colors">Suscripciones</Link>
            <Link href="/admin/tournaments" className="hover:text-neon-cyan transition-colors">Torneos</Link>
          </div>
        </div>
        
        <div className="ml-auto">
          <Link href="/tournaments" className="text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors">
            Volver al App
          </Link>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
