'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { teamSchema, participantSchema } from '@/lib/validations/schemas'
import type { CreateTeamInput, CreateParticipantInput } from '@/lib/validations/schemas'
import type { Team, Participant } from '@/types'
import { pushToAC } from './ac-push'

async function assertAdmin(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return (!data || data.role !== 'ADMIN') ? 'Sin permisos' : null
}

// ─── Teams ──────────────────────────────────────────────────────────────────

export async function createTeam(
  tournamentId: string,
  data: CreateTeamInput
): Promise<{ data: Team } | { error: string }> {
  const parsed = teamSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Datos de equipo inválidos' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify tournament ownership
  const { data: tournament, error: authErr } = await supabase
    .from('tournaments')
    .select('id')
    .eq('id', tournamentId)
    .single()

  if (await assertAdmin(supabase, user.id)) {
    return { error: 'Sin permisos para este torneo' }
  }

  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .insert({
      tournament_id: tournamentId,
      name: parsed.data.name,
      avatar_url: parsed.data.avatarUrl || null,
      stream_url: parsed.data.streamUrl || null,
    })
    .select()
    .single()

  if (teamErr) return { error: teamErr.message }

  pushToAC('teams', 'upsert', {
    id: team.id,
    tournamentId: team.tournament_id,
    name: team.name,
    avatarUrl: team.avatar_url,
    streamUrl: team.stream_url,
  })

  // Auto-initialize standings using admin client — the regular user session lacks
  // write permission on team_standings (no INSERT/UPDATE RLS policy for authenticated users).
  // Using the service role bypasses RLS and guarantees the row is created.
  const adminSupabase = await createAdminClient()
  const { error: standingsErr } = await adminSupabase.from('team_standings').upsert({
    tournament_id: tournamentId,
    team_id: team.id,
    total_points: 0,
    total_kills: 0,
    kill_rate: 0,
    pot_top_count: 0,
    vip_score: 0,
    rank: 99,
    previous_rank: 99,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tournament_id,team_id' })

  if (standingsErr) {
    console.error('[createTeam] Failed to initialize team_standings row:', standingsErr.message)
  }

  return {
    data: {
      id: team.id,
      tournamentId: team.tournament_id,
      name: team.name,
      avatarUrl: team.avatar_url,
      streamUrl: team.stream_url,
      vipScore: team.vip_score,
    }
  }
}

export async function deleteTeam(
  tournamentId: string,
  teamId: string
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('id', tournamentId)
    .single()

  if (await assertAdmin(supabase, user.id)) {
    return { error: 'Sin permisos' }
  }

  // 1. Eliminar todos los participantes vinculados a este equipo primero
  const { error: partDeleteErr } = await supabase
    .from('participants')
    .delete()
    .eq('team_id', teamId)
    .eq('tournament_id', tournamentId)

  if (partDeleteErr) return { error: partDeleteErr.message }

  // 2. Eliminar el equipo
  const { error } = await supabase
    .from('teams')
    .delete()
    .eq('id', teamId)
    .eq('tournament_id', tournamentId)

  if (error) return { error: error.message }

  pushToAC('teams', 'delete', { id: teamId })
  return { success: true }
}

// ─── Participants ───────────────────────────────────────────────────────────

export async function addParticipant(
  tournamentId: string,
  data: CreateParticipantInput
): Promise<{ data: Participant } | { error: string }> {
  const parsed = participantSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Datos de participante inválidos' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify tournament ownership
  const { data: tournament, error: authErr } = await supabase
    .from('tournaments')
    .select('id')
    .eq('id', tournamentId)
    .single()

  if (await assertAdmin(supabase, user.id)) {
    return { error: 'Sin permisos para este torneo' }
  }

  const { data: participant, error: partErr } = await supabase
    .from('participants')
    .insert({
      tournament_id: tournamentId,
      display_name: parsed.data.displayName,
      contact_id: parsed.data.contactId || null,
      stream_url: parsed.data.streamUrl || null,
      team_id: parsed.data.teamId || null,
      is_captain: parsed.data.isCaptain,
      color: parsed.data.color || null,
    })
    .select()
    .single()

  if (partErr) return { error: partErr.message }

  pushToAC('participants', 'upsert', {
    id: participant.id,
    tournamentId: participant.tournament_id,
    teamId: participant.team_id,
    displayName: participant.display_name,
    streamUrl: participant.stream_url,
    totalKills: participant.total_kills || 0,
    isCaptain: participant.is_captain,
  })

  return {
    data: {
      id: participant.id,
      tournamentId: participant.tournament_id,
      teamId: participant.team_id,
      displayName: participant.display_name,
      contactId: participant.contact_id,
      streamUrl: participant.stream_url,
      isCaptain: participant.is_captain,
      totalKills: participant.total_kills || 0,
      kdRatio:            participant.kd_ratio          ?? undefined,
      avgKills:           participant.avg_kills          ?? undefined,
      classificationRank: participant.classification_rank ?? undefined,
      brAvgPlacement:     participant.br_avg_placement   ?? undefined,
      color:              participant.color              ?? undefined,
    }
  }
}

export async function deleteParticipant(
  tournamentId: string,
  participantId: string
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('id', tournamentId)
    .single()

  if (await assertAdmin(supabase, user.id)) {
    return { error: 'Sin permisos' }
  }

  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('id', participantId)
    .eq('tournament_id', tournamentId)

  if (error) return { error: error.message }

  pushToAC('participants', 'delete', { id: participantId })
  return { success: true }
}

export async function getTeamsWithParticipants(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  
  // No strict ownership check to allow public rendering if needed eventually,
  // but if we ONLY want admins:
  
  const { data: teams, error: teamsErr } = await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true })

  if (teamsErr) return { error: teamsErr.message }

  const { data: participants, error: partErr } = await supabase
    .from('participants')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true })

  if (partErr) return { error: partErr.message }

  // Map to types
  const mappedTeams: Team[] = teams.map(t => ({
    id: t.id,
    tournamentId: t.tournament_id,
    name: t.name,
    avatarUrl: t.avatar_url,
    streamUrl: t.stream_url,
    vipScore: t.vip_score,
  }))

  const mappedParticipants: Participant[] = participants.map(p => ({
    id: p.id,
    tournamentId: p.tournament_id,
    teamId: p.team_id,
    displayName: p.display_name,
    avatarUrl: p.avatar_url ?? undefined,
    contactId: p.contact_id,
    streamUrl: p.stream_url,
    isCaptain: p.is_captain,
    totalKills: p.total_kills || 0,
    kdRatio:            p.kd_ratio            ?? undefined,
    avgKills:           p.avg_kills            ?? undefined,
    classificationRank: p.classification_rank  ?? undefined,
    brAvgPlacement:     p.br_avg_placement      ?? undefined,
    color:              p.color                 ?? undefined,
  }))

  return { teams: mappedTeams, participants: mappedParticipants }
}

export async function updateParticipantKills(
  tournamentId: string,
  participantId: string,
  kills: number
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify tournament ownership
  const { data: tournament, error: authErr } = await supabase
    .from('tournaments')
    .select('id')
    .eq('id', tournamentId)
    .single()

  if (await assertAdmin(supabase, user.id)) {
    return { error: 'Sin permisos para este torneo' }
  }

  const { error: updateErr } = await supabase
    .from('participants')
    .update({ total_kills: kills })
    .eq('id', participantId)
    .eq('tournament_id', tournamentId)

  if (updateErr) return { error: updateErr.message }

  return { success: true }
}

export async function updateTeam(
  tournamentId: string,
  teamId: string,
  data: Partial<CreateTeamInput>
): Promise<{ data: Team } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('id', tournamentId)
    .single()

  if (await assertAdmin(supabase, user.id)) {
    return { error: 'Sin permisos' }
  }

  const { data: team, error: updateErr } = await supabase
    .from('teams')
    .update({
      name: data.name,
      avatar_url: data.avatarUrl,
      stream_url: data.streamUrl,
    })
    .eq('id', teamId)
    .eq('tournament_id', tournamentId)
    .select()
    .single()

  if (updateErr) return { error: updateErr.message }

  pushToAC('teams', 'upsert', {
    id: team.id,
    tournamentId: team.tournament_id,
    name: team.name,
    avatarUrl: team.avatar_url,
    streamUrl: team.stream_url,
  })

  return {
    data: {
      id: team.id,
      tournamentId: team.tournament_id,
      name: team.name,
      avatarUrl: team.avatar_url,
      streamUrl: team.stream_url,
      vipScore: team.vip_score,
    }
  }
}

export async function updateParticipant(
  tournamentId: string,
  participantId: string,
  data: Partial<CreateParticipantInput>
): Promise<{ data: Participant } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('id', tournamentId)
    .single()

  if (await assertAdmin(supabase, user.id)) {
    return { error: 'Sin permisos' }
  }

  const d = data as any
  const { data: participant, error: updateErr } = await supabase
    .from('participants')
    .update({
      display_name:          data.displayName,
      avatar_url:            d.avatarUrl,
      stream_url:            data.streamUrl,
      is_captain:            data.isCaptain,
      kd_ratio:              d.kdRatio        ?? null,
      avg_kills:             d.avgKills        ?? null,
      classification_rank:   d.classificationRank ?? null,
      br_avg_placement:      d.brAvgPlacement  ?? null,
      color:                 data.color       ?? null,
    })
    .eq('id', participantId)
    .eq('tournament_id', tournamentId)
    .select()
    .single()

  if (updateErr) return { error: updateErr.message }

  pushToAC('participants', 'upsert', {
    id: participant.id,
    tournamentId: participant.tournament_id,
    teamId: participant.team_id,
    displayName: participant.display_name,
    streamUrl: participant.stream_url,
    totalKills: participant.total_kills || 0,
    isCaptain: participant.is_captain,
  })

  return {
    data: {
      id: participant.id,
      tournamentId: participant.tournament_id,
      teamId: participant.team_id,
      displayName: participant.display_name,
      avatarUrl: participant.avatar_url,
      contactId: participant.contact_id,
      streamUrl: participant.stream_url,
      isCaptain: participant.is_captain,
      totalKills: participant.total_kills || 0,
      kdRatio:             participant.kd_ratio         ?? undefined,
      avgKills:            participant.avg_kills         ?? undefined,
      classificationRank:  participant.classification_rank ?? undefined,
      brAvgPlacement:      participant.br_avg_placement  ?? undefined,
      color:               participant.color            ?? undefined,
    }
  }
}

export async function uploadAvatar(
  tournamentId: string,
  entityId: string,
  type: 'team' | 'participant',
  formData: FormData
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'ADMIN') return { error: 'Sin permisos' }

  const file = formData.get('file') as File
  if (!file) return { error: 'No se recibió archivo' }

  const ext = file.name.split('.').pop()
  const filePath = `avatars/${entityId}-${type}-avatar.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const admin = await createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('evidences')
    .upload(filePath, buffer, { upsert: true, contentType: file.type })

  if (uploadError) return { error: uploadError.message }

  const { data: { publicUrl } } = admin.storage.from('evidences').getPublicUrl(filePath)
  const urlWithBust = `${publicUrl}?t=${Date.now()}`

  if (type === 'team') {
    await admin.from('teams').update({ avatar_url: urlWithBust }).eq('id', entityId)
  } else {
    await admin.from('participants').update({ avatar_url: urlWithBust }).eq('id', entityId)
  }

  return { url: urlWithBust }
}
