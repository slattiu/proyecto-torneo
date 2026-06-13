'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isAdmin } from './auth-helpers'
import { revalidatePath } from 'next/cache'

export interface AdPlacementData {
  id?: string
  slot_name: string
  advertiser_name: string
  image_url: string
  click_through_url?: string
  is_active: boolean
}

export async function getAllAds() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('advertising_placements')
      .select('*')
      .order('slot_name', { ascending: true })

    if (error) throw error
    return { data }
  } catch (err: any) {
    console.error('Error in getAllAds:', err)
    return { error: err.message || 'Error al obtener anuncios' }
  }
}

export async function upsertAdPlacement(ad: AdPlacementData) {
  try {
    const authorized = await isAdmin()
    if (!authorized) return { error: 'No autorizado' }

    const supabase = await createAdminClient()

    let error
    if (ad.id) {
      const { error: updateError } = await supabase
        .from('advertising_placements')
        .update({
          slot_name: ad.slot_name,
          advertiser_name: ad.advertiser_name,
          image_url: ad.image_url,
          click_through_url: ad.click_through_url || null,
          is_active: ad.is_active,
        })
        .eq('id', ad.id)
      error = updateError
    } else {
      const { error: insertError } = await supabase
        .from('advertising_placements')
        .insert({
          slot_name: ad.slot_name,
          advertiser_name: ad.advertiser_name,
          image_url: ad.image_url,
          click_through_url: ad.click_through_url || null,
          is_active: ad.is_active,
        })
      error = insertError
    }

    if (error) throw error

    revalidatePath('/')
    revalidatePath('/t/[slug]', 'page')
    return { success: true }
  } catch (err: any) {
    console.error('Error in upsertAdPlacement:', err)
    return { error: err.message || 'Error al guardar el anuncio' }
  }
}

export async function deleteAdPlacement(id: string) {
  try {
    const authorized = await isAdmin()
    if (!authorized) return { error: 'No autorizado' }

    const supabase = await createAdminClient()
    const { error } = await supabase
      .from('advertising_placements')
      .delete()
      .eq('id', id)

    if (error) throw error

    revalidatePath('/')
    revalidatePath('/t/[slug]', 'page')
    return { success: true }
  } catch (err: any) {
    console.error('Error in deleteAdPlacement:', err)
    return { error: err.message || 'Error al eliminar el anuncio' }
  }
}
