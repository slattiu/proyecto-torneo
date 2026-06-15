'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function searchUsersForFriends(query: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    if (!query || query.trim().length < 2) {
      return { data: [] }
    }

    const adminSupabase = await createAdminClient()
    
    // Check if query is a valid UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.trim())
    
    let queryBuilder = adminSupabase
      .from('profiles')
      .select('id, username, avatar_url, stream_url')
      .neq('id', user.id)

    if (isUuid) {
      queryBuilder = queryBuilder.eq('id', query.trim())
    } else {
      queryBuilder = queryBuilder.ilike('username', `%${query.trim()}%`)
    }

    const { data: profiles, error } = await queryBuilder.limit(10)

    if (error) throw error

    return { data: profiles || [] }
  } catch (err: any) {
    return { error: err.message || 'Error al buscar usuarios' }
  }
}

export async function sendFriendRequest(friendId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    if (user.id === friendId) {
      return { error: 'No puedes agregarte a ti mismo como amigo' }
    }

    const adminSupabase = await createAdminClient()

    // Check if friendship already exists in either direction
    const { data: existing } = await adminSupabase
      .from('friendships')
      .select('id')
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`)
      .maybeSingle()

    if (existing) {
      return { error: 'Ya son amigos o hay una solicitud pendiente' }
    }

    // Insert friendship (default status: accepted for instant friendship)
    const { error } = await adminSupabase
      .from('friendships')
      .insert({
        user_id: user.id,
        friend_id: friendId,
        status: 'accepted'
      })

    if (error) throw error

    revalidatePath('/profile')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error al agregar amigo' }
  }
}

export async function getFriendsList() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const adminSupabase = await createAdminClient()

    // Retrieve friendships where user is user_id or friend_id
    const { data: friendships, error } = await adminSupabase
      .from('friendships')
      .select('*')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)

    if (error) throw error

    if (!friendships || friendships.length === 0) {
      return { data: [] }
    }

    // Extract friend IDs
    const friendIds = friendships.map(f => f.user_id === user.id ? f.friend_id : f.user_id)

    // Fetch friend profiles
    const { data: profiles, error: profilesErr } = await adminSupabase
      .from('profiles')
      .select('id, username, avatar_url, stream_url')
      .in('id', friendIds)

    if (profilesErr) throw profilesErr

    return { data: profiles || [] }
  } catch (err: any) {
    return { error: err.message || 'Error al obtener la lista de amigos' }
  }
}

export async function removeFriend(friendId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autorizado' }

    const adminSupabase = await createAdminClient()

    // Delete friendship in either direction
    const { error } = await adminSupabase
      .from('friendships')
      .delete()
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`)

    if (error) throw error

    revalidatePath('/profile')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error al eliminar amigo' }
  }
}
