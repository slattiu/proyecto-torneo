'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const updateProfileSchema = z.object({
  username: z.string().min(2, 'Mínimo 2 caracteres').max(30, 'Máximo 30 caracteres').regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guión bajo').nullable().optional(),
})

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const raw = formData.get('username')
  const parsed = updateProfileSchema.safeParse({
    username: raw === '' ? null : raw,
  })
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const adminSupabase = await createAdminClient()
  const { error } = await adminSupabase
    .from('profiles')
    .upsert({ 
      id: user.id, 
      username: parsed.data.username, 
      updated_at: new Date().toISOString() 
    })

  if (error) return { error: error.message }

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
