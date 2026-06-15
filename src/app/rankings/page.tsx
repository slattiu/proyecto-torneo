export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { Orbitron } from 'next/font/google'
import { getProfile } from '@/lib/actions/auth-helpers'
import { Navbar } from '@/components/navigation/Navbar'
import { HomeTracker } from '@/components/analytics/HomeTracker'
import { RankingsClient } from './RankingsClient'

const orbitron = Orbitron({ subsets: ['latin'] })

export default async function RankingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user ? await getProfile() : null

  // 1. Fetch community rankings (Ranking Kronix)
  const { data: communityRankings } = await supabase
    .from('user_discipline_rankings')
    .select(`
      id,
      discipline,
      points,
      user_id,
      profiles (
        username
      )
    `)
    .order('points', { ascending: false })

  // 2. Fetch national rankings (Ranking Nacional FDDE)
  const { data: nationalRankings } = await supabase
    .from('player_national_stats')
    .select('*')
    .order('points', { ascending: false })

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white selection:bg-neon-cyan/30 pb-20">
      <HomeTracker path="/rankings" />
      <Navbar user={user} profile={profile} />

      <main className="max-w-7xl mx-auto px-6 sm:px-8 pt-32 space-y-8">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-neon-cyan">Base de datos de Alto Rendimiento</span>
          <h1 className={`${orbitron.className} text-3xl sm:text-5xl font-black uppercase tracking-tighter text-white mt-2`}>
            Rankings de la Plataforma
          </h1>
          <p className="text-white/40 text-xs sm:text-sm max-w-xl mt-1.5 leading-relaxed">
            Explora y compara los rankings oficiales. Alterna entre el Ranking Kronix de la comunidad y el Ranking Nacional para atletas federados de la FDDE.
          </p>
        </div>

        <RankingsClient 
          communityRankings={communityRankings || []} 
          nationalRankings={nationalRankings || []} 
        />
      </main>
    </div>
  )
}
