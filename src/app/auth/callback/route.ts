import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)

    // Garantizar que el perfil existe (red de seguridad si el trigger falló)
    if (data.user) {
      const adminSupabase = await createAdminClient()
      const { data: existingProfile } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!existingProfile) {
        const { count } = await adminSupabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })

        await adminSupabase.from('profiles').insert({
          id: data.user.id,
          username: null,
          role: (count ?? 0) === 0 ? 'ADMIN' : 'USER',
        })
      }
    }
  }

  return NextResponse.redirect(`${origin}/tournaments`)
}
