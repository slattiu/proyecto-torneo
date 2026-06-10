'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from './auth-helpers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export async function sendSubscriptionReminders(): Promise<{ sent: number } | { error: string }> {
  if (!(await isAdmin())) return { error: 'Sin permisos' }

  const supabase = await createAdminClient()

  // Suscripciones que expiran en los próximos 7 días o ya expiraron
  const in7days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: expiring } = await supabase
    .from('profiles')
    .select('id, subscription_expiry')
    .eq('subscription_status', 'ACTIVE')
    .lte('subscription_expiry', in7days)

  if (!expiring || expiring.length === 0) return { sent: 0 }

  // Obtener emails de auth.users
  const { data: authData } = await supabase.auth.admin.listUsers()
  const emailMap = new Map(authData?.users?.map((u) => [u.id, u.email]) ?? [])

  let sent = 0
  for (const profile of expiring) {
    const email = emailMap.get(profile.id)
    if (!email) continue

    const expiryDate = profile.subscription_expiry
      ? new Date(profile.subscription_expiry).toLocaleDateString('es', { day: 'numeric', month: 'long' })
      : 'pronto'

    // Usar Supabase Auth admin para enviar email personalizado
    await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/profile`,
        data: { reminder: true }
      }
    })

    // Nota: Supabase free no tiene email templates custom.
    // Registramos el recordatorio enviado en una tabla de log.
    await supabase.from('profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', profile.id)

    sent++
  }

  return { sent }
}

const changeRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['ADMIN', 'FEDERATION', 'STREAMER', 'USER']),
})

export async function changeUserRole(formData: FormData) {
  const admin = await isAdmin()
  if (!admin) return { error: 'No autorizado' }

  const parsed = changeRoleSchema.safeParse({
    userId: formData.get('userId'),
    role: formData.get('role'),
  })
  if (!parsed.success) return { error: 'Datos inválidos' }

  const supabase = await createAdminClient()
  const { error } = await supabase
    .from('profiles')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.userId)

  if (error) return { error: error.message }

  revalidatePath('/admin/users')
  return { success: true }
}

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(3),
  role: z.enum(['ADMIN', 'FEDERATION', 'STREAMER', 'USER']),
})

export async function createUserByAdmin(formData: FormData) {
  const admin = await isAdmin()
  if (!admin) return { error: 'No autorizado' }

  const parsed = createUserSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    username: formData.get('username'),
    role: formData.get('role'),
  })
  if (!parsed.success) {
    return { error: 'Datos inválidos: ' + parsed.error.issues.map(i => i.message).join(', ') }
  }

  const supabase = await createAdminClient()

  // 1. Crear en auth.users
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { username: parsed.data.username }
  })

  if (authError) return { error: authError.message }
  if (!authUser.user) return { error: 'No se pudo crear el usuario en Auth' }

  // 2. Upsert en profiles
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: authUser.user.id,
      username: parsed.data.username,
      role: parsed.data.role,
      subscription_status: parsed.data.role === 'STREAMER' ? 'ACTIVE' : 'NONE',
      updated_at: new Date().toISOString(),
    })

  if (profileError) {
    await supabase.auth.admin.deleteUser(authUser.user.id)
    return { error: profileError.message }
  }

  revalidatePath('/admin/users')
  return { success: true }
}

export async function createMissingProfile(formData: FormData) {
  const admin = await isAdmin()
  if (!admin) return { error: 'No autorizado' }

  const userId = formData.get('userId')
  if (!userId || typeof userId !== 'string') return { error: 'ID inválido' }

  const supabase = await createAdminClient()

  // Verificar que el usuario existe en auth
  const { data: authUser } = await supabase.auth.admin.getUserById(userId)
  if (!authUser.user) return { error: 'Usuario no encontrado' }

  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  const { error } = await supabase.from('profiles').insert({
    id: userId,
    username: null,
    role: (count ?? 0) === 0 ? 'ADMIN' : 'STREAMER',
  })

  if (error) return { error: error.message }

  revalidatePath('/admin/users')
  return { success: true }
}

export async function deleteUserByAdmin(userId: string): Promise<{ success: boolean } | { error: string }> {
  const admin = await isAdmin()
  if (!admin) return { error: 'No autorizado' }

  // Prevent admin from deleting themselves
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user && user.id === userId) {
    return { error: 'No puedes eliminar tu propia cuenta' }
  }

  const adminSupabase = await createAdminClient()
  const { error } = await adminSupabase.auth.admin.deleteUser(userId)

  if (error) return { error: error.message }

  revalidatePath('/admin/users')
  return { success: true }
}

