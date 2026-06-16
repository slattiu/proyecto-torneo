'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createTournamentSchema, updateTournamentSchema } from '@/lib/validations/schemas'
import type { Tournament, ScoringRule } from '@/types'
import type { CreateTournamentInput, UpdateTournamentInput } from '@/lib/validations/schemas'
import { isActiveStreamer, isAdmin } from './auth-helpers'
import { pushToAC } from './ac-push'

// ─── helpers ────────────────────────────────────────────────────────────────

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)

  const shortId = Math.random().toString(36).slice(2, 8)
  return `${base}-${shortId}`
}

function mapTournamentRow(row: Record<string, unknown>): Tournament {
  return {
    id: row.id as string,
    creatorId: row.creator_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    rulesText: row.rules_text as string | undefined,
    slug: row.slug as string,
    mode: row.mode as Tournament['mode'],
    format: row.format as Tournament['format'],
    level: row.level as Tournament['level'],
    status: row.status as Tournament['status'],
    totalMatches: row.total_matches as number,
    matchesCompleted: row.matches_completed as number,
    killRateEnabled: row.kill_rate_enabled as boolean,
    potTopEnabled: row.pot_top_enabled as boolean,
    vipEnabled: row.vip_enabled as boolean,
    tiebreakerMatchEnabled: row.tiebreaker_match_enabled as boolean,
    killRaceTimeLimitMinutes: row.kill_race_time_limit_minutes as number | undefined,
    defaultRoundsPerMatch: row.default_rounds_per_match as number,
    startDate: row.start_date as string | undefined,
    endDate: row.end_date as string | undefined,
    championImageUrl: row.champion_image_url as string | undefined,
    logoUrl: row.logo_url as string | undefined,
    hideLogoInLeaderboard: row.hide_logo_in_leaderboard as boolean,
    // Finance Model
    entryFee: Number(row.entry_fee || 0),
    prize1st: Number(row.prize_1st || 0),
    prize2nd: Number(row.prize_2nd || 0),
    prize3rd: Number(row.prize_3rd || 0),
    prizeMvp: Number(row.prize_mvp || 0),
    organizerSplit: Number(row.organizer_split || 50),
    streamerSplit: Number(row.streamer_split || 50),
    // Arena Betting
    arenaBettingEnabled: row.arena_betting_enabled as boolean,
    arenaBettingStatus: row.arena_betting_status as Tournament['arenaBettingStatus'],
    totalLiveViewers: row.total_live_viewers as number,
    // Arena Crypto sync
    tournamentType: (row.tournament_type as Tournament['tournamentType']) ?? 'battle_royale',
    // Registration & Capacity
    maxTeams: row.max_teams !== undefined && row.max_teams !== null ? Number(row.max_teams) : null,
    isPrivate: row.is_private as boolean | undefined,
    registrationPassword: row.registration_password as string | undefined | null,
    registrationStartDate: row.registration_start_date as string | undefined | null,
    registrationEndDate: row.registration_end_date as string | undefined | null,
    clashRoyaleTag: row.clash_royale_tag as string | undefined | null,
    discipline: (row.discipline as string) || 'warzone',
    badgeUrl: row.badge_url as string | undefined | null,
  }
}

function mapScoringRuleRow(row: Record<string, unknown>): ScoringRule {
  return {
    id: row.id as string,
    tournamentId: row.tournament_id as string,
    killPoints: Number(row.kill_points),
    placementPoints: row.placement_points as Record<string, number>,
    useMultiplier: !!row.use_multiplier,
  }
}

// ─── actions ────────────────────────────────────────────────────────────────

export async function createTournament(
  data: CreateTournamentInput
): Promise<{ data: Tournament } | { error: string }> {
  // 1. Authorization check
  const isAllowed = await isActiveStreamer()
  if (!isAllowed) {
    return { error: 'Requerido: Suscripción Streamer Pro activa ($15/mes) para crear torneos.' }
  }

  const parsed = createTournamentSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.errors[0]
    return { error: first?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const input = parsed.data
  const slug = generateSlug(input.name)

  // Insert tournament
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .insert({
      creator_id: user.id,
      name: input.name,
      description: input.description ?? null,
      rules_text: input.rulesText ?? null,
      slug,
      mode: input.mode,
      format: input.format,
      level: input.level,
      status: 'draft',
      total_matches: input.totalMatches,
      kill_rate_enabled: input.killRateEnabled,
      pot_top_enabled: input.potTopEnabled,
      vip_enabled: input.vipEnabled,
      tiebreaker_match_enabled: input.tiebreakerMatchEnabled,
      kill_race_time_limit_minutes: input.killRaceTimeLimitMinutes ?? null,
      default_rounds_per_match: input.defaultRoundsPerMatch,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      is_private: input.isPrivate || false,
      registration_password: input.registrationPassword || null,
      max_teams: input.maxTeams || null,
      registration_start_date: input.registrationStartDate || new Date().toISOString(),
      registration_end_date: input.registrationEndDate || null,
      hide_logo_in_leaderboard: input.hideLogoInLeaderboard || false,
      clash_royale_tag: input.clashRoyaleTag || null,
      discipline: input.discipline || 'warzone',
      badge_url: input.badgeUrl || null,
      // Finance Model
      entry_fee: input.entryFee || 0,
      prize_1st: input.prize1st || 0,
      prize_2nd: input.prize2nd || 0,
      prize_3rd: input.prize3rd || 0,
      prize_mvp: input.prizeMvp || 0,
      organizer_split: input.organizerSplit ?? 50,
      streamer_split: input.streamerSplit ?? 50,
      // Arena Betting
      arena_betting_enabled: input.arenaBettingEnabled || false,
      arena_betting_status: 'closed',
    })
    .select()
    .single()

  if (tErr || !tournament) {
    return { error: tErr?.message ?? 'Error al crear el torneo' }
  }

  // Insert scoring rule
  const { error: srErr } = await supabase.from('scoring_rules').insert({
    tournament_id: tournament.id,
    kill_points: input.scoringRule.killPoints,
    placement_points: input.scoringRule.placementPoints,
    use_multiplier: input.scoringRule.useMultiplier || false,
  })

  if (srErr) {
    // Rollback tournament
    await supabase.from('tournaments').delete().eq('id', tournament.id)
    return { error: srErr.message }
  }

  // Create matches and rounds automatically
  for (let i = 0; i < input.totalMatches; i++) {
    const matchNumber = i + 1;
    // 1. Create Parent Match (Encounter)
    const { data: parentMatch, error: pmErr } = await supabase
      .from('matches')
      .insert({
        tournament_id: tournament.id,
        match_number: matchNumber,
        name: `Encuentro ${matchNumber}`,
      })
      .select()
      .single();

    if (pmErr) {
      await supabase.from('tournaments').delete().eq('id', tournament.id);
      return { error: pmErr.message };
    }

    // 2. Create Rounds (Child Matches) if more than 1 round is configured
    if (input.defaultRoundsPerMatch > 1) {
      const rounds = Array.from({ length: input.defaultRoundsPerMatch }, (_, rIdx) => ({
        tournament_id: tournament.id,
        parent_match_id: parentMatch.id,
        match_number: matchNumber,
        round_number: rIdx + 1,
        name: `Ronda ${rIdx + 1}`,
      }));

      const { error: rErr } = await supabase.from('matches').insert(rounds);
      if (rErr) {
        await supabase.from('tournaments').delete().eq('id', tournament.id);
        return { error: rErr.message };
      }
    }
  }

  const mapped = mapTournamentRow(tournament as Record<string, unknown>)

  // Push tournament + all matches to AC mirror (fire-and-forget)
  pushToAC('tournaments', 'upsert', mapped as unknown as Record<string, unknown>)
  const { data: createdMatches } = await supabase
    .from('matches').select('*').eq('tournament_id', tournament.id)
  for (const m of createdMatches ?? []) {
    pushToAC('matches', 'upsert', m)
  }

  return { data: mapped }
}

export async function updateTournament(
  id: string,
  data: UpdateTournamentInput
): Promise<{ data: Tournament } | { error: string }> {
  const parsed = updateTournamentSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.errors[0]
    return { error: first?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership and draft status
  const { data: existing, error: fetchErr } = await supabase
    .from('tournaments')
    .select('status, creator_id')
    .eq('id', id)
    .single()

  if (fetchErr || !existing) return { error: 'Torneo no encontrado' }
  if (existing.creator_id !== user.id) return { error: 'Sin permisos' }
  if (existing.status !== 'draft' && existing.status !== 'pending') {
    return { error: 'No se puede modificar un torneo activo o finalizado' }
  }

  const input = parsed.data
  const updatePayload: Record<string, unknown> = {}

  if (input.name !== undefined) updatePayload.name = input.name
  if (input.description !== undefined) updatePayload.description = input.description
  if (input.rulesText !== undefined) updatePayload.rules_text = input.rulesText
  if (input.mode !== undefined) updatePayload.mode = input.mode
  if (input.format !== undefined) updatePayload.format = input.format
  if (input.level !== undefined) updatePayload.level = input.level
  if (input.totalMatches !== undefined) updatePayload.total_matches = input.totalMatches
  if (input.killRateEnabled !== undefined) updatePayload.kill_rate_enabled = input.killRateEnabled
  if (input.potTopEnabled !== undefined) updatePayload.pot_top_enabled = input.potTopEnabled
  if (input.vipEnabled !== undefined) updatePayload.vip_enabled = input.vipEnabled
  if (input.tiebreakerMatchEnabled !== undefined)
    updatePayload.tiebreaker_match_enabled = input.tiebreakerMatchEnabled
  if (input.killRaceTimeLimitMinutes !== undefined)
    updatePayload.kill_race_time_limit_minutes = input.killRaceTimeLimitMinutes
  if (input.defaultRoundsPerMatch !== undefined)
    updatePayload.default_rounds_per_match = input.defaultRoundsPerMatch
  if (input.startDate !== undefined) updatePayload.start_date = input.startDate || null
  if (input.endDate !== undefined) updatePayload.end_date = input.endDate || null
  if (input.logoUrl !== undefined) updatePayload.logo_url = input.logoUrl || null
  if (input.hideLogoInLeaderboard !== undefined)
    updatePayload.hide_logo_in_leaderboard = input.hideLogoInLeaderboard
  if (input.clashRoyaleTag !== undefined)
    updatePayload.clash_royale_tag = input.clashRoyaleTag
  if (input.discipline !== undefined)
    updatePayload.discipline = input.discipline
  if (input.badgeUrl !== undefined)
    updatePayload.badge_url = input.badgeUrl
  if (input.maxTeams !== undefined)
    updatePayload.max_teams = input.maxTeams
  if (input.isPrivate !== undefined)
    updatePayload.is_private = input.isPrivate
  if (input.registrationPassword !== undefined)
    updatePayload.registration_password = input.registrationPassword
  if (input.registrationStartDate !== undefined)
    updatePayload.registration_start_date = input.registrationStartDate || null
  if (input.registrationEndDate !== undefined)
    updatePayload.registration_end_date = input.registrationEndDate || null

  
  // Finance Model
  if (input.entryFee !== undefined) updatePayload.entry_fee = input.entryFee
  if (input.prize1st !== undefined) updatePayload.prize_1st = input.prize1st
  if (input.prize2nd !== undefined) updatePayload.prize_2nd = input.prize2nd
  if (input.prize3rd !== undefined) updatePayload.prize_3rd = input.prize3rd
  if (input.prizeMvp !== undefined) updatePayload.prize_mvp = input.prizeMvp
  if (input.organizerSplit !== undefined) updatePayload.organizer_split = input.organizerSplit
  if (input.streamerSplit !== undefined) updatePayload.streamer_split = input.streamerSplit

  // Arena Betting
  if (input.arenaBettingEnabled !== undefined) updatePayload.arena_betting_enabled = input.arenaBettingEnabled

  const { data: updated, error: updateErr } = await supabase
    .from('tournaments')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (updateErr || !updated) {
    return { error: updateErr?.message ?? 'Error al actualizar' }
  }

  // Update scoring rule if provided
  if (input.scoringRule) {
    await supabase
      .from('scoring_rules')
      .update({
        kill_points: input.scoringRule.killPoints,
        placement_points: input.scoringRule.placementPoints,
        use_multiplier: input.scoringRule.useMultiplier || false,
      })
      .eq('tournament_id', id)
  }

  const mappedUpdated = mapTournamentRow(updated as Record<string, unknown>)
  pushToAC('tournaments', 'upsert', mappedUpdated as unknown as Record<string, unknown>)
  return { data: mappedUpdated }
}

export async function publishTournament(
  id: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments')
    .select('status, creator_id')
    .eq('id', id)
    .single()

  if (fetchErr || !tournament) return { error: 'Torneo no encontrado' }

  const { isAdmin } = await import('./auth-helpers')
  const admin = await isAdmin()
  if (!admin && tournament.creator_id !== user.id) return { error: 'Sin permisos' }

  if (tournament.status !== 'draft') {
    return { error: 'Solo se puede anunciar un torneo en estado Borrador' }
  }

  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'pending' })
    .eq('id', id)

  if (error) return { error: error.message }

  // Push updated status to AC mirror
  const { data: updated } = await supabase.from('tournaments').select('*').eq('id', id).single()
  if (updated) pushToAC('tournaments', 'upsert', mapTournamentRow(updated as Record<string, unknown>) as unknown as Record<string, unknown>)

  revalidatePath(`/tournaments/${id}`)
  revalidatePath('/tournaments')
  return { success: true }
}

export async function activateTournament(
  id: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership
  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments')
    .select('status, creator_id, format, kill_race_time_limit_minutes')
    .eq('id', id)
    .single()

  if (fetchErr || !tournament) return { error: 'Torneo no encontrado' }
  if (tournament.creator_id !== user.id) return { error: 'Sin permisos' }
  if (tournament.status !== 'draft' && tournament.status !== 'pending') {
    return { error: 'El torneo ya está activo o finalizado' }
  }

  // Verify scoring rule exists
  const { data: rule, error: ruleErr } = await supabase
    .from('scoring_rules')
    .select('id')
    .eq('tournament_id', id)
    .single()

  if (ruleErr || !rule) {
    return { error: 'El torneo debe tener una regla de puntuación antes de activarse' }
  }

  // Kill Race requires time limit
  if (tournament.format === 'kill_race' && !tournament.kill_race_time_limit_minutes) {
    return { error: 'Kill Race requiere un límite de tiempo configurado' }
  }

  const { error: activateErr } = await supabase
    .from('tournaments')
    .update({ status: 'active' })
    .eq('id', id)

  if (activateErr) return { error: activateErr.message }

  // Enviar notificaciones in-app y simulación de correos electrónicos
  try {
    const { data: participants } = await supabase
      .from('participants')
      .select('display_name, user_id')
      .eq('tournament_id', id)
      .not('user_id', 'is', null)

    if (participants && participants.length > 0) {
      const adminSupabase = await createAdminClient()
      const userIds = Array.from(new Set(participants.map(p => p.user_id).filter(Boolean)))

      if (userIds.length > 0) {
        // 1. Insertar notificaciones in-app
        const notificationsToInsert = userIds.map(uId => ({
          user_id: uId,
          title: `¡El torneo ${tournament.name} ha comenzado!`,
          message: `El torneo '${tournament.name}' al que te inscribiste ha iniciado oficialmente. ¡Buena suerte!`,
          is_read: false
        }))

        await adminSupabase.from('notifications').insert(notificationsToInsert)

        // 2. Consultar emails de auth y simular correos por consola
        const { data: authUsers } = await adminSupabase
          .schema('auth')
          .from('users')
          .select('id, email')
          .in('id', userIds)

        if (authUsers) {
          authUsers.forEach(u => {
            console.log(`\n================================================================================`);
            console.log(`[EMAIL ENVIADO - SIMULACIÓN]`);
            console.log(`Destinatario: ${u.email}`);
            console.log(`Asunto: ¡El torneo "${tournament.name}" ha comenzado!`);
            console.log(`Mensaje: Hola, el torneo al que te inscribiste ya está activo. ¡Buena suerte en la arena!`);
            console.log(`================================================================================\n`);
          })
        }
      }
    }
  } catch (notifyErr: any) {
    console.error('Error al enviar alertas del torneo:', notifyErr.message || notifyErr)
  }

  // Push updated status to AC mirror
  const { data: activated } = await supabase.from('tournaments').select('*').eq('id', id).single()
  if (activated) pushToAC('tournaments', 'upsert', mapTournamentRow(activated as Record<string, unknown>) as unknown as Record<string, unknown>)

  revalidatePath(`/tournaments/${id}`)
  revalidatePath('/tournaments')

  return { success: true }
}

export async function finishTournament(
  id: string,
  championImageUrl?: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership
  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments')
    .select('creator_id, status, slug, is_sanctioned, mode, discipline, badge_url, name')
    .eq('id', id)
    .single()

  if (fetchErr || !tournament) return { error: 'Torneo no encontrado' }
  if (tournament.creator_id !== user.id) return { error: 'Sin permisos' }
  if (tournament.status !== 'active') {
    return { error: 'Solo se pueden finalizar torneos activos' }
  }

  const { error: finishErr } = await supabase
    .from('tournaments')
    .update({
      status: 'finished',
      arena_betting_status: 'closed',
      champion_image_url: championImageUrl || null,
      end_date: new Date().toISOString()
    })
    .eq('id', id)

  if (finishErr) return { error: finishErr.message }

  // --- Financial Calculation ---
  const { data: teamsCount } = await supabase
    .from('teams')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', id)

  const totalTeams = teamsCount || 0
  const tournamentDetails = await supabase
    .from('tournaments')
    .select('entry_fee, prize_1st, prize_2nd, prize_3rd, prize_mvp, organizer_split, streamer_split')
    .eq('id', id)
    .single()

  if (tournamentDetails.data) {
    const t = tournamentDetails.data
    const totalRevenue = totalTeams * Number(t.entry_fee)
    const totalPrizes = Number(t.prize_1st) + Number(t.prize_2nd) + Number(t.prize_3rd) + Number(t.prize_mvp)
    const remainder = totalRevenue - totalPrizes
    
    await supabase.from('tournament_financials').insert({
      tournament_id: id,
      total_revenue: totalRevenue,
      total_prizes: totalPrizes,
      remainder: remainder,
      organizer_payout: remainder * (Number(t.organizer_split) / 100),
      streamer_payout: remainder * (Number(t.streamer_split) / 100)
    })
  }

  // --- FEDERATION AUTO RANKING UPDATE ---
  if (tournament.is_sanctioned) {
    const adminSupabase = await createAdminClient()

    // 1. Get the discipline of the cup (if exists, or default to clash_royale)
    const { data: sanctionedCup } = await adminSupabase
      .from('sanctioned_cups')
      .select('discipline')
      .eq('tournament_id', id)
      .maybeSingle()

    const discipline = sanctionedCup?.discipline || 'clash_royale'

    // Update the corresponding sanctioned cup status to 'finished'
    await adminSupabase
      .from('sanctioned_cups')
      .update({ status: 'finished', end_date: new Date().toISOString() })
      .eq('tournament_id', id)

    // 2. Fetch all team standings with their participants
    const { data: standings } = await adminSupabase
      .from('team_standings')
      .select(`
        rank,
        total_points,
        total_kills,
        team_id,
        teams (
          name,
          participants (
            display_name
          )
        )
      `)
      .eq('tournament_id', id)

    if (standings && standings.length > 0) {
      const pointsScale: Record<number, number> = {
        1: 1000,
        2: 600,
        3: 400,
        4: 200,
        5: 100,
        6: 100,
        7: 100,
        8: 100,
      }

      for (const standing of standings) {
        const rank = standing.rank || 99
        const pointsToAward = pointsScale[rank] || 50
        const isPodium = rank <= 3 ? 1 : 0
        const isWinner = rank === 1 ? 100.00 : 0.00

        const team = standing.teams as any
        const participants = team?.participants || []

        for (const p of participants) {
          const displayName = p.display_name
          if (!displayName) continue

          // Fetch existing player stats
          const { data: existingPlayer } = await adminSupabase
            .from('player_national_stats')
            .select('*')
            .eq('display_name', displayName)
            .eq('discipline', discipline)
            .maybeSingle()

          if (existingPlayer) {
            const newTournamentsPlayed = existingPlayer.tournaments_played + 1
            const newWinRate = Number((((Number(existingPlayer.win_rate) * existingPlayer.tournaments_played) + isWinner) / newTournamentsPlayed).toFixed(2))

            await adminSupabase
              .from('player_national_stats')
              .update({
                points: existingPlayer.points + pointsToAward,
                tournaments_played: newTournamentsPlayed,
                podiums_count: existingPlayer.podiums_count + isPodium,
                win_rate: newWinRate,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingPlayer.id)
          } else {
            await adminSupabase
              .from('player_national_stats')
              .insert({
                display_name: displayName,
                discipline,
                points: pointsToAward,
                tournaments_played: 1,
                podiums_count: isPodium,
                win_rate: isWinner,
                updated_at: new Date().toISOString(),
              })
          }
        }
      }

      // Recalculate rank positions in player_national_stats for this discipline
      const { data: allPlayers } = await adminSupabase
        .from('player_national_stats')
        .select('id, points')
        .eq('discipline', discipline)
        .order('points', { ascending: false })

      if (allPlayers) {
        const rankUpdates = allPlayers.map((player: any, index: number) => ({
          id: player.id,
          rank_position: index + 1
        }))
        await adminSupabase.from('player_national_stats').upsert(rankUpdates)
      }
    }
  }

  // --- PLATFORM-WIDE PUBLIC USER RANKINGS AND BADGES UPDATE ---
  try {
    const adminSupabase = await createAdminClient()
    
    // Fetch standings again using admin client to get team participants
    const { data: standings } = await adminSupabase
      .from('team_standings')
      .select(`
        rank,
        team_id,
        teams (
          name,
          participants (
            user_id,
            display_name
          )
        )
      `)
      .eq('tournament_id', id)

    if (standings && standings.length > 0) {
      const getPlatformRankingPoints = (modeStr: string, r: number): number => {
        const m = (modeStr || 'individual').toLowerCase()
        if (r === 1) {
          if (m === 'individual') return 6.0
          if (m === 'duos') return 4.0
          if (m === 'trios') return 2.0
          return 1.0 // cuartetos / default
        }
        if (r === 2) {
          if (m === 'individual') return 4.0
          if (m === 'duos') return 3.0
          if (m === 'trios') return 1.5
          return 0.75
        }
        if (r === 3) {
          if (m === 'individual') return 3.0
          if (m === 'duos') return 2.0
          if (m === 'trios') return 1.0
          return 0.5
        }
        if (r === 4) {
          if (m === 'individual') return 2.0
          if (m === 'duos') return 1.0
          if (m === 'trios') return 0.5
          return 0.25
        }
        if (r === 5) {
          if (m === 'individual') return 1.0
          if (m === 'duos') return 0.5
          if (m === 'trios') return 0.25
          return 0.1
        }
        return 0
      }

      for (const standing of standings) {
        const rank = standing.rank || 99
        const pointsToAward = getPlatformRankingPoints(tournament.mode || 'individual', rank)
        
        const team = standing.teams as any
        const participants = team?.participants || []

        for (const p of participants) {
          if (!p.user_id) continue

          // A. Insert history record for time-series charts
          await adminSupabase.from('user_points_history').insert({
            user_id: p.user_id,
            tournament_id: id,
            discipline: tournament.discipline || 'warzone',
            points_awarded: pointsToAward,
            rank_achieved: rank
          })

          // B. Update/Upsert aggregate points
          const { data: existingRank } = await adminSupabase
            .from('user_discipline_rankings')
            .select('points')
            .eq('user_id', p.user_id)
            .eq('discipline', tournament.discipline || 'warzone')
            .maybeSingle()

          if (existingRank) {
            await adminSupabase
              .from('user_discipline_rankings')
              .update({
                points: Number(existingRank.points) + pointsToAward,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', p.user_id)
              .eq('discipline', tournament.discipline || 'warzone')
          } else {
            await adminSupabase
              .from('user_discipline_rankings')
              .insert({
                user_id: p.user_id,
                discipline: tournament.discipline || 'warzone',
                points: pointsToAward,
                updated_at: new Date().toISOString()
              })
          }

          // C. Award badge if tournament has a badge_url and user finished in top 3
          if (tournament.badge_url && rank <= 3) {
            await adminSupabase.from('user_badges').insert({
              user_id: p.user_id,
              tournament_id: id,
              badge_url: tournament.badge_url,
              name: `${tournament.name} - Top ${rank}`,
              rank_achieved: rank
            })
          }
        }
      }
    }
  } catch (rankingErr) {
    console.error('[RANKINGS] Error processing platform rankings update:', rankingErr)
  }

  // Push finished status to AC mirror
  const { data: finished } = await supabase.from('tournaments').select('*').eq('id', id).single()
  if (finished) pushToAC('tournaments', 'upsert', mapTournamentRow(finished as Record<string, unknown>) as unknown as Record<string, unknown>)

  revalidatePath(`/tournaments/${id}`)
  revalidatePath('/tournaments')
  revalidatePath('/hall-of-fame')
  // Invalidate the public leaderboard page so the next visit gets fresh status
  if (tournament.slug) revalidatePath(`/t/${tournament.slug}`)

  return { success: true }
}

export async function getTournaments(): Promise<
  { data: Tournament[] } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const admin = await isAdmin()

  let query = supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })

  if (!admin) {
    query = query.eq('creator_id', user.id)
  }

  const { data, error } = await query

  if (error) return { error: error.message }
  return {
    data: (data ?? []).map((row) => mapTournamentRow(row as Record<string, unknown>)),
  }
}

export async function getTournament(
  id: string
): Promise<{ data: Tournament & { scoringRule?: ScoringRule } } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const admin = await isAdmin()

  let query = supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)

  if (!admin) {
    query = query.eq('creator_id', user.id)
  }

  const { data: tournament, error: tErr } = await query.single()

  if (tErr || !tournament) return { error: 'Torneo no encontrado' }

  const { data: rule } = await supabase
    .from('scoring_rules')
    .select('*')
    .eq('tournament_id', id)
    .single()

  return {
    data: {
      ...mapTournamentRow(tournament as Record<string, unknown>),
      scoringRule: rule
        ? mapScoringRuleRow(rule as Record<string, unknown>)
        : undefined,
    },
  }
}

export async function deleteTournament(
  id: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership before deleting
  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments')
    .select('creator_id, name, status')
    .eq('id', id)
    .single()

  if (fetchErr || !tournament) return { error: 'Torneo no encontrado' }

  // Check if user is an ADMIN to allow deletion of other users' tournaments
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isUserAdmin = profile?.role === 'ADMIN'

  if (tournament.creator_id !== user.id && !isUserAdmin) {
    return { error: 'Sin permisos para eliminar este torneo' }
  }

  // Delete tournament — using admin client to bypass creator-only RLS constraints
  const adminSupabase = await createAdminClient()
  const { error: deleteErr } = await adminSupabase
    .from('tournaments')
    .delete()
    .eq('id', id)

  if (deleteErr) return { error: deleteErr.message }

  // Notify AC to remove from mirror
  pushToAC('tournaments', 'delete', { id })

  return { success: true }
}

export async function getHallOfFame(): Promise<
  { data: any[] } | { error: string }
> {
  const supabase = await createClient()

  // 1. Get finished tournaments
  const { data: tournaments, error: tErr } = await supabase
    .from('tournaments')
    .select(`
      *,
      team_standings (
        team_id,
        rank,
        total_points,
        total_kills,
        teams (
          name,
          avatar_url
        )
      )
    `)
    .eq('status', 'finished')
    .order('end_date', { ascending: false })

  if (tErr) return { error: tErr.message }

  // 2. Map and filter only the winner for each
  const result = (tournaments || []).map(t => {
    const winner = t.team_standings?.find((s: any) => s.rank === 1)
    return {
      ...mapTournamentRow(t as Record<string, unknown>),
      winner: winner ? {
        teamId: winner.team_id,
        name: winner.teams?.name,
        avatarUrl: winner.teams?.avatar_url,
        totalPoints: winner.total_points,
        totalKills: winner.total_kills
      } : null
    }
  })

  return { data: result }
}

export async function updateBettingStatus(
  id: string,
  status: 'open' | 'closed' | 'paused'
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tournaments')
    .update({ arena_betting_status: status })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(`/tournaments/${id}`)
  return { success: true }
}

export async function toggleTournamentPrivacy(
  id: string,
  isPrivate: boolean
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership
  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments')
    .select('creator_id')
    .eq('id', id)
    .single()

  if (fetchErr || !tournament) return { error: 'Torneo no encontrado' }

  const admin = await isAdmin()
  if (!admin && tournament.creator_id !== user.id) return { error: 'Sin permisos' }

  const { error } = await supabase
    .from('tournaments')
    .update({ is_private: isPrivate })
    .eq('id', id)

  if (error) return { error: error.message }

  // Push updated status to AC mirror
  const { data: updated } = await supabase.from('tournaments').select('*').eq('id', id).single()
  if (updated) {
    pushToAC(
      'tournaments',
      'upsert',
      mapTournamentRow(updated as Record<string, unknown>) as unknown as Record<string, unknown>
    )
  }

  revalidatePath(`/tournaments/${id}`)
  revalidatePath('/tournaments')
  revalidatePath('/')
  return { success: true }
}

