'use server'

import { createClient } from '@/lib/supabase/server'

export type Profile = {
  id: string
  username: string | null
  role: 'ADMIN' | 'FEDERATION' | 'STREAMER' | 'USER'
  subscriptionStatus: 'NONE' | 'PENDING' | 'ACTIVE' | 'EXPIRED'
  subscriptionExpiry: string | null
}

/**
 * Fetches the profile of the current authenticated user.
 */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  return {
    id: profile.id,
    username: profile.username,
    role: profile.role,
    subscriptionStatus: profile.subscription_status,
    subscriptionExpiry: profile.subscription_expiry
  }
}

/**
 * Checks if the current user is an admin or federation member.
 */
export async function isAdmin() {
  const profile = await getProfile()
  return profile?.role === 'ADMIN' || profile?.role === 'FEDERATION'
}

/**
 * Checks if the current user is specifically Super Admin (role = ADMIN).
 */
export async function isSuperAdmin() {
  const profile = await getProfile()
  return profile?.role === 'ADMIN'
}

/**
 * Checks if the current user has an active subscription.
 */
export async function isActiveStreamer() {
  const profile = await getProfile()
  if (profile?.role === 'USER') return false
  return profile?.role === 'ADMIN' || profile?.role === 'FEDERATION' || profile?.subscriptionStatus === 'ACTIVE'
}
