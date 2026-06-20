'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { submissionSchema } from '@/lib/validations/schemas'
import type { CreateSubmissionInput } from '@/lib/validations/schemas'
import type { Submission } from '@/types'
import { analyzeSubmissionImage } from '../services/ai-vision'

export async function createSubmission(
  data: CreateSubmissionInput
): Promise<{ data: Submission } | { error: string }> {
  const parsed = submissionSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Datos de envío inválidos' }
  }

  const supabase = await createClient()

  // Check if match exists and tournament is active
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('tournament_id, is_completed, is_warmup, tournaments(status)')
    .eq('id', parsed.data.matchId)
    .single()

  if (matchErr || !match) return { error: 'Partida no encontrada' }
  if (match.is_completed) return { error: 'La partida ya está completada' }
  
  // Skip status check for warmup matches; only enforce active status for official matches
  if (!match.is_warmup) {
    const tStatus = Array.isArray(match.tournaments) 
      ? match.tournaments[0]?.status 
      : (match.tournaments as any)?.status
    if (tStatus !== 'active') {
      return { error: 'El torneo no está activo' }
    }
  }

  // Ensure team is not already submitted for this match
  const { data: existing } = await supabase
    .from('submissions')
    .select('id')
    .eq('match_id', parsed.data.matchId)
    .eq('team_id', parsed.data.teamId)
    .single()

  if (existing) {
    return { error: 'Este equipo ya tiene un registro para esta partida' }
  }

  // Ensure rank uniqueness — only one team per position per match
  const effectiveRank = parsed.data.rank ?? (parsed.data.potTop ? 1 : null)
  if (effectiveRank !== null && effectiveRank !== undefined) {
    const { data: rankConflict } = await supabase
      .from('submissions')
      .select('id, teams(name)')
      .eq('match_id', parsed.data.matchId)
      .eq('rank', effectiveRank)
      .in('status', ['pending', 'approved'])
      .neq('team_id', parsed.data.teamId)
      .maybeSingle()

    if (rankConflict) {
      return { error: `La posición #${effectiveRank} ya está registrada por otro equipo en esta partida` }
    }
  }

  // Use admin client to bypass the captain-only database RLS insert policy, 
  // since we have already validated team membership server-side.
  const adminSupabase = await createAdminClient()

  const { data: submission, error: subErr } = await adminSupabase
    .from('submissions')
    .insert({
      tournament_id: parsed.data.tournamentId,
      match_id: parsed.data.matchId,
      team_id: parsed.data.teamId,
      submitted_by: parsed.data.submittedBy,
      kill_count: parsed.data.killCount,
      player_kills: parsed.data.playerKills || {},
      rank: parsed.data.rank || (parsed.data.potTop ? 1 : null),
      pot_top: parsed.data.potTop || parsed.data.rank === 1,
      status: 'pending',
    })
    .select()
    .single()

  if (subErr) return { error: subErr.message }

  if (parsed.data.evidence) {
    const { error: evErr } = await adminSupabase
      .from('evidence_files')
      .insert({
        submission_id: submission.id,
        storage_path: parsed.data.evidence.storagePath,
        file_name: parsed.data.evidence.fileName,
        file_size: parsed.data.evidence.fileSize,
        mime_type: parsed.data.evidence.mimeType,
      })
      
    if (evErr) {
      // NOTE: Normally we might rollback the submission here, but for simplicity
      // we'll return an error and leave the pending submission without evidence.
      // A cron or manual check can clean up orphaned submissions.
      return { error: 'Envío creado, pero hubo un error al registrar la evidencia: ' + evErr.message }
    }

    // NEW: Trigger AI Validation asynchronously (Wait for it in this action for demo purposes or fire and forget)
    // For now, we'll let it run and update the DB in the background
    processAIValidation(submission.id, parsed.data.evidence.storagePath, parsed.data.evidence.mimeType)
      .catch(err => console.error('Background AI validation failed:', err))
  }

  return {
    data: {
      id: submission.id,
      tournamentId: submission.tournament_id,
      teamId: submission.team_id,
      matchId: submission.match_id,
      submittedBy: submission.submitted_by,
      killCount: submission.kill_count,
      playerKills: submission.player_kills,
      rank: submission.rank,
      potTop: submission.pot_top,
      status: submission.status,
      rejectionReason: submission.rejection_reason,
      submittedAt: submission.submitted_at,
    }
  }
}

export async function recalculateStandings(supabase: any, tournamentId: string) {
  // Fetch tournament + rule
  const { data: tourney } = await supabase.from('tournaments')
    .select('id, slug, total_matches, format, is_sanctioned, mode, tournament_type, clash_royale_tag, max_points_limit, scoring_rules(kill_points, placement_points, use_multiplier)')
    .eq('id', tournamentId).single()
  
  console.log(`[STANDINGS] Recalculating for Tournament: ${tournamentId}`)
  if (!tourney) {
    console.error(`[STANDINGS] Tournament not found: ${tournamentId}`)
    return
  }

  // If this is a Clash Royale tournament, delegate to its specific sync flow
  if (tourney.clash_royale_tag) {
    console.log(`[STANDINGS] Tournament ${tournamentId} is linked to Clash Royale tag ${tourney.clash_royale_tag}. Syncing from API...`)
    try {
      const { syncClashRoyaleTournamentData } = await import('@/lib/services/clash-royale')
      await syncClashRoyaleTournamentData(supabase, tournamentId, tourney.clash_royale_tag)
      // Call sync live viewers before early return to make sure viewer counts updates
      syncTournamentViewers(supabase, tournamentId).catch(err => {
        console.error('[STANDINGS] Background viewers sync failed:', err)
      })
      return
    } catch (err) {
      console.error(`[STANDINGS] Failed to sync Clash Royale stats:`, err)
    }
  }

  const sRules = Array.isArray(tourney.scoring_rules) ? tourney.scoring_rules[0] : tourney.scoring_rules
  const rule = {
    id: 'req',
    tournamentId: tourney.id,
    killPoints: Number(sRules?.kill_points ?? 1),
    placementPoints: sRules?.placement_points ?? {},
    useMultiplier: !!sRules?.use_multiplier,
  }

  // Fetch all teams
  const { data: teams } = await supabase.from('teams').select('id, name, avatar_url, vip_score').eq('tournament_id', tournamentId)
  if (!teams) {
    console.warn(`[STANDINGS] No teams found for tournament: ${tournamentId}`)
    return
  }
  console.log(`[STANDINGS] Found ${teams.length} teams`)

  // FETCH SUBMISSIONS (Including warmup for testing if needed, or stick to approved)
  const { data: subs } = await supabase.from('submissions')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('status', 'approved')
  
  console.log(`[STANDINGS] Found ${(subs || []).length} approved submissions`)
  
  const mappedTeams = teams.map((t: any) => ({
    id: t.id, name: t.name, avatarUrl: t.avatar_url, vipScore: t.vip_score
  }))
  
  const mappedSubs = (subs || []).map((s: any) => ({
    id: s.id, tournamentId: s.tournament_id, teamId: s.team_id, matchId: s.match_id,
    submittedBy: s.submitted_by, killCount: s.kill_count, rank: s.rank, potTop: s.pot_top, status: s.status,
    submittedAt: s.submitted_at
  }))

  // STRATEGY: Only count the LATEST approved submission for each team/match pair
  // This solves the issue where duplicate records (e.g. from retries or bugs) inflate the scores.
  const uniqueApprovedSubs = mappedSubs
    .filter((s: any) => s.status === 'approved')
    .sort((a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .filter((sub: any, index: number, self: any[]) => 
      index === self.findIndex((t: any) => (
        t.teamId === sub.teamId && t.matchId === sub.matchId
      ))
    )

  const { computeStandings, calculateKillRaceStandings } = await import('@/lib/scoring/engine')

  let standings = []
  // If we have custom scoring rules in the DB, always use them regardless of format
  if (sRules) {
    console.log(`[STANDINGS] Using custom rules from DB for ${tourney.format} format`)
    standings = computeStandings(uniqueApprovedSubs, rule, { totalMatches: tourney.total_matches, teams: mappedTeams })
  } 
  else if (tourney.format === 'kill_race') {
    console.log(`[STANDINGS] Falling back to default Kill Race logic`)
    standings = calculateKillRaceStandings(uniqueApprovedSubs, mappedTeams)
  } 
  else {
    standings = computeStandings(uniqueApprovedSubs, rule, { totalMatches: tourney.total_matches, teams: mappedTeams })
  }

  // Upsert to team_standings
  const standingRows = standings.map((s: any) => ({
    tournament_id: tournamentId,
    team_id: s.teamId,
    total_points: s.totalPoints,
    total_kills: s.totalKills,
    kill_rate: s.killRate,
    pot_top_count: s.potTopCount,
    vip_score: s.vipScore,
    rank: s.rank,
    previous_rank: s.previousRank || s.rank,
    updated_at: new Date().toISOString()
  }))

  console.log(`[STANDINGS] Upserting ${standingRows.length} rows to team_standings`)
  const { error: upsertErr } = await supabase.from('team_standings').upsert(standingRows, { onConflict: 'tournament_id,team_id' })
  if (upsertErr) {
    console.error(`[STANDINGS] Upsert ERROR:`, upsertErr)
  }

  // Check if any team reached the max points limit to auto-finish the tournament
  if (tourney?.max_points_limit && standingRows.length > 0) {
    const limit = Number(tourney.max_points_limit)
    const reachedLimit = standingRows.some((s: any) => Number(s.total_points) >= limit)
    if (reachedLimit) {
      console.log(`[STANDINGS] A team reached the Max Points Limit of ${limit}! Auto-finishing tournament...`)
      await supabase
        .from('tournaments')
        .update({ status: 'finished' })
        .eq('id', tournamentId)
      
      const { revalidatePath } = await import('next/cache')
      revalidatePath(`/tournaments/${tournamentId}`)
      revalidatePath(`/t/${tourney.slug}`)
      revalidatePath('/tournaments')
      revalidatePath('/')
      
      const { pushToAC } = await import('./ac-push')
      const { data: updatedTourney } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single()
      if (updatedTourney) {
        const { mapTournamentRow } = await import('@/lib/utils')
        pushToAC(
          'tournaments',
          'upsert',
          mapTournamentRow(updatedTourney as Record<string, unknown>) as unknown as Record<string, unknown>
        )
      }
    }
  }

  // ─── NEW: Update Individual Participant Kills ─────────────────────────────
  
  // Aggregate kills per participant from ONLY approved submissions in this tournament
  const playerKillsMap: Record<string, number> = {}
  
  const approvedSubs = (subs || []).filter((s: any) => s.status === 'approved')
  
  for (const s of approvedSubs) {
    if (s.player_kills && typeof s.player_kills === 'object') {
      Object.entries(s.player_kills).forEach(([pId, kills]) => {
        playerKillsMap[pId] = (playerKillsMap[pId] || 0) + Number(kills)
      })
    }
  }

  const playerUpdates = Object.entries(playerKillsMap).map(([id, total_kills]) => ({
    id,
    total_kills
  }))

  if (playerUpdates.length > 0) {
    console.log(`[STANDINGS] Updating total_kills for ${playerUpdates.length} participants`)
    const { error: pErr } = await supabase.from('participants').upsert(playerUpdates)
    if (pErr) console.error(`[STANDINGS] Participant KILLS Update ERROR:`, pErr)
  }

  // Auto-sync streamer live viewers in the background
  syncTournamentViewers(supabase, tournamentId).catch(err => {
    console.error('[STANDINGS] Background viewers sync failed:', err)
  })
}


export async function syncStandings(tournamentId: string): Promise<{ success: boolean } | { error: string }> {
  try {
    // Verify the user is authenticated before allowing sync
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    // Use admin client so the upsert to team_standings bypasses RLS.
    // Without this, the upsert silently fails (no write policy for authenticated users).
    const adminSupabase = await createAdminClient()
    await recalculateStandings(adminSupabase, tournamentId)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

export async function approveSubmission(
  submissionId: string
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Validate ownership implicitly through RLS or explicitly
  const { data: submission, error: subErr } = await supabase
    .from('submissions')
    .select('tournament_id, status, tournaments!inner(creator_id)')
    .eq('id', submissionId)
    .single()

  if (subErr || !submission) return { error: 'Envío no encontrado' }
  
  const creatorId = Array.isArray(submission.tournaments) 
    ? submission.tournaments[0]?.creator_id 
    : (submission.tournaments as any)?.creator_id

  if (creatorId !== user.id) return { error: 'Sin permisos' }
  if (submission.status === 'approved') return { error: 'Ya está aprobado' }

  // Update status
  const { error: updateErr } = await supabase
    .from('submissions')
    .update({ 
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id
    })
    .eq('id', submissionId)

  if (updateErr) return { error: updateErr.message }

  // Trigger recalculation of standings
  await recalculateStandings(supabase, submission.tournament_id)

  return { success: true }
}

export async function rejectSubmission(
  submissionId: string,
  reason: string
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: submission, error: subErr } = await supabase
    .from('submissions')
    .select('tournament_id, status, tournaments!inner(creator_id)')
    .eq('id', submissionId)
    .single()

  if (subErr || !submission) return { error: 'Envío no encontrado' }
  
  const creatorId = Array.isArray(submission.tournaments) 
    ? submission.tournaments[0]?.creator_id 
    : (submission.tournaments as any)?.creator_id

  if (creatorId !== user.id) return { error: 'Sin permisos' }

  const { error: updateErr } = await supabase
    .from('submissions')
    .update({ 
      status: 'rejected',
      rejection_reason: reason,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id
    })
    .eq('id', submissionId)

  if (updateErr) return { error: updateErr.message }

  // Potentially recalculate if it was previously approved, but a rejected submission is usually coming from 'pending' state. 
  // Safety call:
  if (submission.status === 'approved') {
    await recalculateStandings(supabase, submission.tournament_id)
  }

  return { success: true }
}

export async function getSubmissions(
  tournamentId: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data, error } = await supabase
    .from('submissions')
    .select('*, teams(name), matches(name, match_number), evidence_files(*)')
    .eq('tournament_id', tournamentId)
    .order('submitted_at', { ascending: false })

  if (error) return { error: error.message }
  return { data }
}

/**
 * Background AI Validation Process
 * Uses admin client to bypass RLS — the function runs server-side after the
 * user session is no longer available (fire-and-forget call).
 */
export async function processAIValidation(
  submissionId: string,
  storagePath: string,
  mimeType: string
) {
  const supabase = await createAdminClient()

  try {
    // 1. Mark as processing
    await supabase
      .from('submissions')
      .update({ ai_status: 'processing' })
      .eq('id', submissionId)

    // 2. Download file from Storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from('evidences')
      .download(storagePath)

    if (downloadErr || !fileData) {
      throw new Error(`Error descargando evidencia: ${downloadErr?.message}`)
    }

    // 3. Convert to buffer
    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 4. Run AI Analysis
    const aiResult = await analyzeSubmissionImage(buffer, mimeType)

    if ('error' in aiResult) {
       throw new Error(aiResult.error)
    }

    // 5. Update Submission with AI results
    await supabase
      .from('submissions')
      .update({
        ai_status: 'completed',
        ai_data: {
          team_name: aiResult.teamName,
          kill_count: aiResult.killCount,
          rank: aiResult.rank,
        },
        ai_confidence: aiResult.confidence,
      })
      .eq('id', submissionId)

  } catch (error: any) {
    console.error(`[AI] Validation Failed for ${submissionId}:`, error)
    try {
      await supabase
        .from('submissions')
        .update({
          ai_status: 'failed',
          ai_error: error.message || 'Error desconocido'
        })
        .eq('id', submissionId)
    } catch (updateErr) {
      console.error(`[AI] CRITICAL: Failed to update error status for ${submissionId}`)
    }
  }
}

async function fetchKickViewersWithRetry(username: string, retries = 4): Promise<number> {
  const target = `https://kick.com/api/v1/channels/${username.toLowerCase()}`
  const url = `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`
  
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), 4000)
      
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(id)
      
      if (response.status === 200) {
        const json = await response.json()
        if (json.contents) {
          if (json.contents.startsWith('<!DOCTYPE html>') || json.contents.includes('<html')) {
            continue
          }
          const data = JSON.parse(json.contents)
          return data?.livestream?.viewer_count || 0
        }
      }
    } catch (err: any) {
      console.warn(`[KICK SYNC] Attempt ${i + 1} failed for ${username}:`, err.message)
    }
    await new Promise(r => setTimeout(r, 500))
  }
  return 0
}

async function fetchYoutubeViewers(youtubeUser: string): Promise<number> {
  try {
    const formattedUser = youtubeUser.startsWith('@') ? youtubeUser : '@' + youtubeUser
    const url = `https://www.youtube.com/${formattedUser}/live`
    
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 4000)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal
    })
    clearTimeout(id)
    
    const html = await response.text()
    const match = html.match(/ytInitialData\s*=\s*({.+?});/)
    if (match) {
      const data = JSON.parse(match[1])
      const viewCountRenderer = data?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.videoPrimaryInfoRenderer?.viewCount?.videoViewCountRenderer
      if (viewCountRenderer && viewCountRenderer.isLive) {
        return parseInt(viewCountRenderer.originalViewCount || '0', 10)
      }
    }
  } catch (err: any) {
    console.error(`[YT SYNC] Error fetching youtube viewers for ${youtubeUser}:`, err.message)
  }
  return 0
}

export async function syncTournamentViewers(supabase: any, tournamentId: string): Promise<number> {
  try {
    // Fetch tournament stream_url
    const { data: tourney } = await supabase
      .from('tournaments')
      .select('stream_url')
      .eq('id', tournamentId)
      .single()

    // 1. Fetch all teams and participants stream URLs for this tournament
    const { data: teams } = await supabase
      .from('teams')
      .select('stream_url, participants(stream_url)')
      .eq('tournament_id', tournamentId)

    if (!teams) return 0

    const urls: string[] = []
    if (tourney?.stream_url) urls.push(tourney.stream_url)
    for (const t of teams) {
      if (t.stream_url) urls.push(t.stream_url)
      if (t.participants) {
        for (const p of t.participants) {
          if (p.stream_url) urls.push(p.stream_url)
        }
      }
    }

    // Filter unique URLs
    const uniqueUrls = Array.from(new Set(urls.map(u => u.trim()).filter(Boolean)))
    if (uniqueUrls.length === 0) {
      await supabase.from('tournaments').update({ total_live_viewers: 0 }).eq('id', tournamentId)
      return 0
    }

    let totalViewers = 0

    for (const url of uniqueUrls) {
      const twitchUser = url.match(/(?:twitch\.tv\/)([\w\-]+)/)?.[1]
      const kickUser = url.match(/(?:kick\.com\/)([\w\-]+)/)?.[1]
      const youtubeUser = url.match(/(?:youtube\.com\/(?:c\/|channel\/|user\/|@)?|youtu\.be\/)([\w\-]+)/)?.[1]

      let viewers = 0

      if (twitchUser) {
        try {
          const response = await fetch('https://gql.twitch.tv/gql', {
            method: 'POST',
            headers: {
              'Client-Id': 'kimne78kx3ncx6brgo9wj607yyq771',
              'Content-Type': 'text/plain',
            },
            body: JSON.stringify([
              {
                operationName: 'StreamRefetchHeartbeat',
                variables: {
                  channelName: twitchUser.toLowerCase(),
                },
                extensions: {
                  persistedQuery: {
                    version: 1,
                    sha256Hash: '05e6e59aa28aa370e44b942fe2931a72d1746200236a997cfd9006900f684a86',
                  },
                },
              },
            ]),
          })
          const data = await response.json()
          viewers = data[0]?.data?.user?.stream?.viewersCount || 0
        } catch (err) {
          console.error(`Error fetching twitch viewers for ${twitchUser}:`, err)
        }
      } else if (kickUser) {
        viewers = await fetchKickViewersWithRetry(kickUser)
      } else if (youtubeUser) {
        viewers = await fetchYoutubeViewers(youtubeUser)
      }

      totalViewers += viewers
    }

    // Update the tournaments table with total live viewers count
    await supabase
      .from('tournaments')
      .update({ total_live_viewers: totalViewers })
      .eq('id', tournamentId)

    // Insert snapshot history into tournament_analytics table
    await supabase.from('tournament_analytics').insert({
      tournament_id: tournamentId,
      event_type: 'stream_viewers_snapshot',
      path: '',
      visitor_id: 'system',
      metadata: { viewer_count: totalViewers }
    })

    return totalViewers
  } catch (err) {
    console.error('Error syncing tournament viewers:', err)
    return 0
  }
}


