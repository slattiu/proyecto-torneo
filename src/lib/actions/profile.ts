'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const updateProfileSchema = z.object({
  username: z.string().min(2, 'Mínimo 2 caracteres').max(30, 'Máximo 30 caracteres').regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guión bajo').nullable().optional(),
  stream_url: z.string().url('URL inválida. Debe comenzar con http:// o https://').or(z.literal('')).nullable().optional(),
})

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const rawUsername = formData.get('username')
  const rawStreamUrl = formData.get('stream_url')
  
  const parsed = updateProfileSchema.safeParse({
    username: rawUsername === '' ? null : (rawUsername ? String(rawUsername) : undefined),
    stream_url: rawStreamUrl === '' ? '' : (rawStreamUrl ? String(rawStreamUrl) : undefined),
  })
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const adminSupabase = await createAdminClient()

  // Fetch existing profile to preserve role, avatar_url, check changes limit and uniqueness
  const { data: existingProfile } = await adminSupabase
    .from('profiles')
    .select('role, username, username_changes_count, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  const role = existingProfile?.role || 'USER'
  const avatar_url = existingProfile?.avatar_url || null
  let changesCount = existingProfile?.username_changes_count || 0

  const newUsername = parsed.data.username
  const currentUsername = existingProfile?.username

  if (newUsername && newUsername !== currentUsername) {
    // Check if duplicate username
    const { data: duplicateUser } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('username', newUsername)
      .neq('id', user.id)
      .maybeSingle()

    if (duplicateUser) {
      return { error: 'El nombre de usuario ya está registrado por otro jugador' }
    }

    // If they had a username before, this counts as a name change
    if (currentUsername) {
      if (changesCount >= 1) {
        return { error: 'Ya has agotado tu cambio de nombre gratuito. Los siguientes cambios son de pago.' }
      }
      changesCount += 1
    }
  }

  // Preserve existing username if not specified
  const finalUsername = newUsername !== undefined ? newUsername : (currentUsername || null)
  const finalStreamUrl = parsed.data.stream_url !== undefined ? (parsed.data.stream_url || null) : (existingProfile?.stream_url || null)

  const { error } = await adminSupabase
    .from('profiles')
    .upsert({ 
      id: user.id, 
      username: finalUsername, 
      role,
      avatar_url,
      username_changes_count: changesCount,
      stream_url: finalStreamUrl,
      updated_at: new Date().toISOString() 
    })

  if (error) return { error: error.message }

  // Sincronizar el cambio de nombre en las inscripciones de torneos existentes
  if (newUsername && newUsername !== currentUsername) {
    try {
      // 1. Actualizar el display_name en la tabla de participantes
      await adminSupabase
        .from('participants')
        .update({ display_name: newUsername })
        .eq('user_id', user.id)

      // 2. Si es torneo individual y el nombre del equipo era su antiguo username, actualizarlo también
      if (currentUsername) {
        const { data: userParts } = await adminSupabase
          .from('participants')
          .select('team_id')
          .eq('user_id', user.id)

        if (userParts && userParts.length > 0) {
          const teamIds = userParts.map(p => p.team_id).filter(Boolean)
          await adminSupabase
            .from('teams')
            .update({ name: newUsername })
            .in('id', teamIds)
            .eq('name', currentUsername)
        }
      }
    } catch (syncErr) {
      console.error('Error al sincronizar el cambio de nombre en los torneos:', syncErr)
    }
  }

  revalidatePath('/profile')
  return { success: true }
}

export async function getPlayerDetails(userId: string) {
  const supabase = await createClient()

  // 1. Fetch user tournament history
  const { data: participations } = await supabase
    .from('participants')
    .select(`
      id,
      tournament_id,
      team_id,
      tournaments (
        id,
        name,
        slug,
        discipline,
        start_date
      ),
      teams (
        id,
        name,
        team_standings (
          rank,
          total_points,
          total_kills
        )
      )
    `)
    .eq('user_id', userId)

  // 2. Fetch badges
  const { data: badges } = await supabase
    .from('user_badges')
    .select('*')
    .eq('user_id', userId)
    .order('awarded_at', { ascending: false })

  // 3. Fetch points history
  const { data: pointsHistory } = await supabase
    .from('user_points_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  return {
    participations: participations || [],
    badges: badges || [],
    pointsHistory: pointsHistory || []
  }
}

export async function uploadProfileAvatar(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const file = formData.get('file') as File | null
  if (!file) return { error: 'No se recibió archivo' }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Tipo de archivo no permitido. Solo imágenes JPG, PNG, WEBP o GIF.' }
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: 'El archivo supera el límite de 5 MB' }
  }

  const ext = file.name.split('.').pop() || 'png'
  const filePath = `profile-avatars/${user.id}-avatar.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const adminSupabase = await createAdminClient()

  // Fetch existing profile to preserve role and avoid resetting it
  const { data: existingProfile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = existingProfile?.role || 'USER'

  const { error: uploadError } = await adminSupabase.storage
    .from('evidences')
    .upload(filePath, buffer, { upsert: true, contentType: file.type })

  if (uploadError) return { error: uploadError.message }

  const { data: { publicUrl } } = adminSupabase.storage.from('evidences').getPublicUrl(filePath)
  const urlWithBust = `${publicUrl}?t=${Date.now()}`

  const { error: updateError } = await adminSupabase
    .from('profiles')
    .upsert({
      id: user.id,
      avatar_url: urlWithBust,
      role,
      updated_at: new Date().toISOString()
    })

  if (updateError) return { error: updateError.message }

  revalidatePath('/profile')
  return { success: true, url: urlWithBust }
}
