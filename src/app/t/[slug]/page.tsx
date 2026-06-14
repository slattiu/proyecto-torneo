export const dynamic = 'force-dynamic'
export const revalidate = 0

import { notFound } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { LeaderboardClient } from './LeaderboardClient'
import { recalculateStandings } from '@/lib/actions/submissions'
import { ArenaPromoBanner } from '@/components/promo/ArenaPromoBanner'
import { getAdBanners } from '@/lib/actions/federation'

export default async function PublicLeaderboardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  noStore()
  const { slug } = await params
  const normalizedSlug = slug.trim().toLowerCase()
  const adminSupabase = await createAdminClient()
  const supabase = adminSupabase // Replace public client with admin for this page

  // Fetch the tournament ID
  const { data: tourneyInit, error: tErr } = await supabase
    .from('tournaments')
    .select('id')
    .eq('slug', normalizedSlug)
    .single()

  if (tErr || !tourneyInit) notFound()

  // AUTO-SYNC: Recalculate standings on every page load to ensure data is always fresh
  await recalculateStandings(adminSupabase, tourneyInit.id)

  // Fetch the full tournament details (reflecting any automatic status updates from the sync)
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*, leaderboard_themes(*)')
    .eq('id', tourneyInit.id)
    .single()

  if (!tournament) notFound()

  // Fetch ALL teams with their participants (for the Participants tab)
  const { data: allTeams } = await supabase
    .from('teams')
    .select('id, name, avatar_url, stream_url, participants(id, team_id, display_name, is_captain, stream_url, total_kills, kd_ratio, avg_kills, classification_rank, br_avg_placement, color)')
    .eq('tournament_id', tournament.id)
    .order('created_at', { ascending: true })


  // Fetch real standings (if any approved submissions exist)
  const { data: standings } = await supabase
    .from('team_standings')
    .select('*')
    .eq('tournament_id', tournament.id)

  // Build a map of standings by team_id for quick lookup
  const standingsMap = new Map((standings || []).map((s: any) => [s.team_id, s]))

  // Format standings — build from allTeams so every team is always shown
  // Sort: first by actual rank if exists, then by creation order
  const formattedStandings = (allTeams || []).map((t: any, idx: number) => {
    const s = standingsMap.get(t.id)
    const teamStreams: { name: string; url: string }[] = []
    if (t.stream_url) {
      teamStreams.push({ name: 'Equipo', url: t.stream_url })
    }
    if (t.participants) {
      t.participants.forEach((p: any) => {
        if (p.stream_url) {
          teamStreams.push({ name: p.display_name, url: p.stream_url })
        }
      })
    }

    return {
      teamId: t.id,
      teamName: t.name,
      avatarUrl: t.avatar_url,
      streamUrl: t.stream_url,
      streams: teamStreams,
      totalPoints: s ? Number(s.total_points) : 0,
      totalKills: s ? (s.total_kills ?? 0) : 0,
      killRate: s ? Number(s.kill_rate) : 0,
      potTopCount: s ? (s.pot_top_count ?? 0) : 0,
      vipScore: s ? Number(s.vip_score) : 0,
      rank: s ? s.rank : ((allTeams?.length || 0) + 100),
      previousRank: s ? s.previous_rank : ((allTeams?.length || 0) + 100),
    }
  }).sort((a, b) => {
    // Deterministic sort: Points > Kills > Rank > Name
    if ((b.totalPoints || 0) !== (a.totalPoints || 0)) return (b.totalPoints || 0) - (a.totalPoints || 0)
    if ((b.totalKills || 0) !== (a.totalKills || 0)) return (b.totalKills || 0) - (a.totalKills || 0)
    if (a.rank !== b.rank) return a.rank - b.rank
    return a.teamName.localeCompare(b.teamName)
  }).map((t, idx) => ({ ...t, rank: idx + 1 })) // FORCED RANK BY POSITION

  // Format teams for the participants tab
  const formattedTeams = (allTeams || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    avatarUrl: t.avatar_url,
    streamUrl: t.stream_url,
    participants: (t.participants || []).map((p: any) => ({
      id: p.id,
      displayName: p.display_name,
      isCaptain: p.is_captain,
      streamUrl: p.stream_url,
      avatarUrl: p.avatar_url ?? undefined,
      totalKills: p.total_kills || 0,
      kdRatio:            p.kd_ratio            ?? undefined,
      avgKills:           p.avg_kills            ?? undefined,
      classificationRank: p.classification_rank  ?? undefined,
      brAvgPlacement:     p.br_avg_placement      ?? undefined,
      color:              p.color                 ?? undefined,
    })),
  }))

  const theme = Array.isArray(tournament.leaderboard_themes)
    ? tournament.leaderboard_themes[0]
    : tournament.leaderboard_themes

  // Fetch matches and approved submissions
  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('match_number', { ascending: true })

  const formattedMatches = (matches || []).map((m: any) => ({
    id: m.id,
    tournamentId: m.tournament_id,
    name: m.name || `Match ${m.match_number}`,
    matchNumber: m.match_number,
    mapName: m.map_name,
    isCompleted: m.is_completed,
    isWarmup: m.is_warmup,
    isActive: m.is_active ?? false,
    roundNumber: m.round_number || 1,
    createdAt: m.created_at
  }))

  const { data: rawSubmissions } = await supabase
    .from('submissions')
    .select(`
      *,
      teams(name, avatar_url),
      evidence_files(*)
    `)
    .eq('tournament_id', tournament.id)
    .eq('status', 'approved')

  const submissions = (rawSubmissions || []).map((s: any) => ({
    id: s.id,
    tournamentId: s.tournament_id,
    matchId: s.match_id,
    teamId: s.team_id,
    submittedBy: s.submitted_by,
    killCount: s.kill_count,
    playerKills: s.player_kills,
    rank: s.rank,
    potTop: s.pot_top,
    status: s.status,
    rejectionReason: s.rejection_reason,
    submittedAt: s.submitted_at,
    teams: s.teams,
    evidenceFiles: (s.evidence_files || []).map((ev: any) => ({
      storagePath: ev.storage_path,
      mimeType: ev.mime_type
    }))
  }))

  // Fetch scoring rule
  const { data: rawScoringRule } = await supabase
    .from('scoring_rules')
    .select('*')
    .eq('tournament_id', tournament.id)
    .single()

  const scoringRule = rawScoringRule ? {
    id: rawScoringRule.id,
    tournamentId: rawScoringRule.tournament_id,
    killPoints: rawScoringRule.kill_points,
    placementPoints: rawScoringRule.placement_points
  } : undefined

  // Flatten and map participants for LeaderboardClient
  const allParticipants = allTeams?.flatMap(t => 
    (t.participants || []).map((p: any) => ({
      id: p.id,
      tournamentId: tournament.id,
      teamId: p.team_id,
      displayName: p.display_name,
      isCaptain: p.is_captain,
      streamUrl: p.stream_url,
      totalKills: p.total_kills || 0
    }))
  ) || []

  // Fetch active advertising placements
  const adsRes = await getAdBanners()
  const adBanners = adsRes && 'data' in adsRes ? adsRes.data : []

  return (
    <main className="min-h-screen bg-transparent text-white font-inter">
      {tournament.arena_betting_enabled && (
        <ArenaPromoBanner tournamentSlug={slug} />
      )}
      <LeaderboardClient 
        tournamentId={tournament.id}
        tournamentName={tournament.name}
        tournamentLogoUrl={tournament.logo_url}
        hideLogoInLeaderboard={tournament.hide_logo_in_leaderboard || false}
        description={tournament.description}
        format={tournament.format}
        status={tournament.status}
        mode={tournament.mode}
        clashRoyaleTag={tournament.clash_royale_tag}
        discipline={tournament.discipline}
        totalLiveViewers={tournament.total_live_viewers || 0}
        killRateEnabled={tournament.kill_rate_enabled}
        potTopEnabled={tournament.pot_top_enabled}
        vipEnabled={tournament.vip_enabled}
        initialStandings={formattedStandings}
        teams={formattedTeams}
        theme={theme}
        matches={formattedMatches}
        submissions={submissions || []}
        rulesText={tournament.rules_text}
        scoringRule={scoringRule}
        participants={allParticipants}
        championImageUrl={tournament.champion_image_url}
        adBanners={adBanners}
        slug={normalizedSlug}
        isPrivate={tournament.is_private || false}
        maxTeams={tournament.max_teams}
        registrationStartDate={tournament.registration_start_date}
        registrationEndDate={tournament.registration_end_date}
        startDate={tournament.start_date}
        prize1st={Number(tournament.prize_1st || 0)}
        prize2nd={Number(tournament.prize_2nd || 0)}
        prize3rd={Number(tournament.prize_3rd || 0)}
        prizeMvp={Number(tournament.prize_mvp || 0)}
      />
    </main>
  )
}
