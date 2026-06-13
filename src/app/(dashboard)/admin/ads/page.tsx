import { isAdmin } from '@/lib/actions/auth-helpers'
import { redirect } from 'next/navigation'
import { getAllAds } from '@/lib/actions/ads'
import { AdsClient } from './AdsClient'

export default async function AdminAdsPage() {
  const admin = await isAdmin()
  if (!admin) redirect('/tournaments')

  const res = await getAllAds()
  const ads = 'data' in res && res.data ? res.data : []

  return <AdsClient initialAds={ads} />
}
