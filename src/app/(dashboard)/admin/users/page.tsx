import { createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/actions/auth-helpers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { RoleSelect } from './RoleSelect'
import { SubToggle } from './SubToggle'
import { LicenseToggle } from './LicenseToggle'
import { CreateUserForm } from './CreateUserForm'
import { DeleteUserButton } from './DeleteUserButton'

export default async function AdminUsersPage() {
  const admin = await isAdmin()
  if (!admin) redirect('/tournaments')

  const supabase = await createAdminClient()

  // Source of truth: auth.users (todos, tengan perfil o no)
  const { data: authData } = await supabase.auth.admin.listUsers()
  const authUsers = authData?.users ?? []

  // Perfiles existentes
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, role, subscription_status, created_at, has_ranking_license')

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? [])

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-white/40 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios</h1>
          <p className="text-white/40 text-sm">{authUsers.length} registrados</p>
        </div>
      </div>

      <CreateUserForm />

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Email</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Username</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Rol</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Suscripción</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Licencia Fede</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Registro</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Perfil</th>
                <th className="px-5 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Acción Sub</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {authUsers.map((u) => {
                const profile = profileMap.get(u.id)
                return (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-sm text-white/70">{u.email ?? '—'}</td>
                    <td className="px-5 py-3 text-sm text-white/50">
                      {profile?.username ?? <span className="italic text-white/20">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      {profile ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          profile.role === 'ADMIN'
                            ? 'border-neon-cyan/30 text-neon-cyan bg-neon-cyan/10'
                            : profile.role === 'STREAMER'
                            ? 'border-neon-purple/30 text-neon-purple bg-neon-purple/10'
                            : profile.role === 'FEDERATION'
                            ? 'border-green-500/30 text-green-400 bg-green-500/10'
                            : 'border-white/10 text-white/40'
                        }`}>
                          {profile.role}
                        </span>
                      ) : (
                        <span className="text-xs text-yellow-500/60 border border-yellow-500/20 bg-yellow-500/5 px-2 py-0.5 rounded-full">
                          Sin perfil
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {profile ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          profile.subscription_status === 'ACTIVE'
                            ? 'border-green-500/30 text-green-400 bg-green-500/10'
                            : profile.subscription_status === 'PENDING'
                            ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'
                            : 'border-white/5 text-white/20'
                        }`}>
                          {profile.subscription_status}
                        </span>
                      ) : <span className="text-white/20 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      {profile ? (
                        <LicenseToggle streamerId={u.id} initialHasLicense={profile.has_ranking_license} />
                      ) : <span className="text-white/20 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3 text-xs text-white/30">
                      {new Date(u.created_at).toLocaleDateString('es')}
                    </td>
                    <td className="px-5 py-3">
                      {profile ? (
                        <span className="text-xs text-green-400/60">✓ OK</span>
                      ) : (
                        <CreateProfileButton userId={u.id} />
                      )}
                    </td>
                    <td className="px-5 py-3 flex items-center gap-2">
                      {profile ? (
                        <>
                          {profile.role !== 'ADMIN' && (
                            <SubToggle userId={u.id} status={profile.subscription_status} />
                          )}
                          <RoleSelect userId={u.id} currentRole={profile.role} />
                        </>
                      ) : (
                        <span className="text-white/20 text-xs mr-2">—</span>
                      )}
                      <DeleteUserButton userId={u.id} userEmail={u.email ?? '—'} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Inline server action button para crear perfil faltante
import { createMissingProfile } from '@/lib/actions/admin'

function CreateProfileButton({ userId }: { userId: string }) {
  return (
    <form action={createMissingProfile}>
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        className="text-xs text-yellow-400 hover:text-yellow-300 border border-yellow-500/20 hover:border-yellow-500/40 bg-yellow-500/5 px-2 py-0.5 rounded-full transition-colors"
      >
        Crear perfil
      </button>
    </form>
  )
}
