'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { pushToAC } from './ac-push'

export async function registerTournament(
  tournamentId: string,
  formData: {
    teamName: string
    streamUrl?: string
    participants: { displayName: string; contactId?: string; streamUrl?: string; userId?: string }[]
    password?: string
  }
): Promise<{ success: boolean } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado. Por favor, inicia sesión.' }

    // 1. Obtener detalles del torneo
    const { data: tournament, error: tourneyErr } = await supabase
      .from('tournaments')
      .select('id, name, mode, status, is_private, registration_password, max_teams')
      .eq('id', tournamentId)
      .single()

    if (tourneyErr || !tournament) {
      return { error: 'No se encontró el torneo.' }
    }

    if (tournament.status !== 'pending' && tournament.status !== 'active') {
      return { error: 'Las inscripciones están cerradas para este torneo.' }
    }

    // Validar Contraseña si el torneo es privado
    if (tournament.is_private) {
      if (!formData.password || formData.password.trim() !== tournament.registration_password) {
        return { error: 'Contraseña de inscripción incorrecta.' }
      }
    }

    // Validar Límite de Equipos (Capacidad Máxima)
    if (tournament.max_teams && tournament.max_teams > 0) {
      const { count, error: countErr } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId)
      
      if (!countErr && count !== null && count >= tournament.max_teams) {
        return { error: 'El torneo ha alcanzado el límite máximo de inscripciones (Cupos Llenos).' }
      }
    }

    // 2. Verificar si el usuario ya está registrado en este torneo
    const { data: existingPlayer } = await supabase
      .from('participants')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)
      .limit(1)

    if (existingPlayer && existingPlayer.length > 0) {
      return { error: 'Ya estás inscrito en este torneo.' }
    }

    // Verificar si alguno de los compañeros seleccionados ya está inscrito en este torneo
    const userIdsToCheck = pList
      .map(p => p.userId)
      .filter((id): id is string => !!id)

    if (userIdsToCheck.length > 0) {
      const { data: existingTeammates } = await supabase
        .from('participants')
        .select('user_id, display_name')
        .eq('tournament_id', tournamentId)
        .in('user_id', userIdsToCheck)

      if (existingTeammates && existingTeammates.length > 0) {
        const alreadyReg = existingTeammates[0]
        const inputMember = pList.find(p => p.userId === alreadyReg.user_id)
        const nameToShow = inputMember?.displayName || alreadyReg.display_name
        return { error: `El jugador '${nameToShow}' ya está inscrito en este torneo en otro equipo.` }
      }
    }

    // 3. Validar el tamaño del equipo según el modo del torneo
    const maxPerTeam = { individual: 1, duos: 2, trios: 3, cuartetos: 4, quintas: 5 }[tournament.mode] || 1
    const pList = formData.participants.filter(p => p.displayName.trim() !== '')

    if (tournament.mode === 'individual') {
      if (pList.length === 0) {
        return { error: 'El nombre del jugador es requerido.' }
      }
    } else {
      if (!formData.teamName.trim()) {
        return { error: 'El nombre del equipo es requerido.' }
      }
      if (pList.length === 0) {
        return { error: 'Debes ingresar al menos un participante.' }
      }
      if (pList.length > maxPerTeam) {
        return { error: `Un equipo en modo ${tournament.mode} solo puede tener un máximo de ${maxPerTeam} integrantes.` }
      }
    }

    // 4. Usar cliente admin para realizar inserciones seguras saltando RLS (ya que los usuarios generales no tienen permisos directos de inserción)
    const adminSupabase = await createAdminClient()

    // 5. Verificar si el nombre del equipo o del jugador individual ya está registrado
    const finalTeamName = tournament.mode === 'individual' ? pList[0].displayName.trim() : formData.teamName.trim()
    const { data: teamExists } = await adminSupabase
      .from('teams')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('name', finalTeamName)
      .limit(1)

    if (teamExists && teamExists.length > 0) {
      return { error: `El nombre '${finalTeamName}' ya está registrado en este torneo.` }
    }

    // 6. Insertar Equipo
    const { data: team, error: teamErr } = await adminSupabase
      .from('teams')
      .insert({
        tournament_id: tournamentId,
        name: finalTeamName,
        stream_url: formData.streamUrl || null
      })
      .select()
      .single()

    if (teamErr || !team) {
      return { error: teamErr?.message || 'Error al registrar el equipo.' }
    }

    // Sincronizar equipo a ArenaCrypto
    pushToAC('teams', 'upsert', {
      id: team.id,
      tournamentId: team.tournament_id,
      name: team.name,
      avatarUrl: team.avatar_url,
      streamUrl: team.stream_url,
    })

    // 7. Insertar Participantes
    for (let i = 0; i < pList.length; i++) {
      const pData = pList[i]
      const isCaptain = i === 0 // El primer participante listado (típicamente el que registra) es el capitán

      const { data: participant, error: partErr } = await adminSupabase
        .from('participants')
        .insert({
          tournament_id: tournamentId,
          team_id: team.id,
          display_name: pData.displayName.trim(),
          contact_id: pData.contactId || null,
          stream_url: pData.streamUrl || null,
          is_captain: isCaptain,
          user_id: isCaptain ? user.id : (pData.userId || null) // Asignamos el user_id del amigo si está disponible
        })
        .select()
        .single()

      if (partErr) {
        console.error('Error al insertar participante:', partErr.message)
      } else if (participant) {
        pushToAC('participants', 'upsert', {
          id: participant.id,
          tournamentId: participant.tournament_id,
          teamId: participant.team_id,
          displayName: participant.display_name,
          streamUrl: participant.stream_url,
          totalKills: participant.total_kills || 0,
          isCaptain: participant.is_captain,
        })
      }
    }

    // 8. Inicializar la tabla de posiciones (Standings) del equipo
    const { error: standingsErr } = await adminSupabase
      .from('team_standings')
      .upsert({
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
      console.error('[registerTournament] Failed to initialize team_standings:', standingsErr.message)
    }

    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Ocurrió un error inesperado al procesar la inscripción.' }
  }
}
