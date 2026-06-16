'use client'

import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createTournamentSchema, type CreateTournamentInput } from '@/lib/validations/schemas'
import { createTournament, updateTournament } from '@/lib/actions/tournaments'
import { ScoringRuleEditor } from './ScoringRuleEditor'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

// ─── Section header ──────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-0.5 h-full min-h-[2.5rem] bg-gradient-to-b from-neon-cyan to-neon-purple rounded-full shrink-0 mt-0.5" />
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─── Mode cards ──────────────────────────────────────────────────────────────

const MODES = [
  { value: 'individual', label: 'Individual', icon: '👤', desc: '1 jugador' },
  { value: 'duos', label: 'Duos', icon: '👥', desc: '2 jugadores' },
  { value: 'trios', label: 'Tríos', icon: '🎮', desc: '3 jugadores' },
  { value: 'cuartetos', label: 'Cuartetos', icon: '🏆', desc: '4 jugadores' },
  { value: 'quintas', label: 'Quintas (5v5)', icon: '🛡️', desc: '5 jugadores' },
] as const

const FORMATS = [
  {
    value: 'battle_royale_clasico',
    label: 'Battle Royale',
    desc: 'Puntos por posición + kills acumulados',
  },
  {
    value: 'kill_race',
    label: 'Kill Race',
    desc: 'Ranking por kills en tiempo límite',
  },
  {
    value: 'custom_rooms',
    label: 'Custom Rooms',
    desc: 'Salas privadas con reglas personalizadas',
  },
  {
    value: 'eliminacion_directa',
    label: 'Eliminación Directa',
    desc: 'Bracket de eliminación por rondas',
  },
  {
    value: 'fase_de_grupos',
    label: 'Fase de Grupos',
    desc: 'Grupos con clasificación a siguiente fase',
  },
] as const

// ─── Main form ───────────────────────────────────────────────────────────────

interface TournamentFormProps {
  onSuccess?: (id: string) => void
  initialData?: any
  tournamentId?: string
}

function formatDateForInput(dateStr?: string | null) {
  if (!dateStr) return ''
  return dateStr.split('T')[0]
}

export function TournamentForm({ onSuccess, initialData, tournamentId }: TournamentFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [uploadingBadge, setUploadingBadge] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleBadgeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingBadge(true)
    setServerError(null)

    try {
      const supabase = createClient()
      const fileExt = file.name.split('.').pop()
      const fileName = `badge-${Date.now()}.${fileExt}`
      const filePath = `badges/${fileName}`

      const { data, error } = await supabase.storage
        .from('evidences')
        .upload(filePath, file, { upsert: true })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('evidences')
        .getPublicUrl(filePath)

      setValue('badgeUrl', publicUrl)
    } catch (err: any) {
      console.error('Error uploading badge:', err)
      setServerError(err.message || 'Error al subir la insignia')
    } finally {
      setUploadingBadge(false)
    }
  }

  const defaultValues = {
    killRateEnabled: initialData?.killRateEnabled ?? true,
    potTopEnabled: initialData?.potTopEnabled ?? true,
    vipEnabled: initialData?.vipEnabled ?? false,
    tiebreakerMatchEnabled: initialData?.tiebreakerMatchEnabled ?? false,
    killRaceTimeLimitMinutes: initialData?.killRaceTimeLimitMinutes ?? 30,
    defaultRoundsPerMatch: initialData?.defaultRoundsPerMatch ?? 1,
    totalMatches: initialData?.totalMatches ?? 3,
    maxPointsLimit: initialData?.maxPointsLimit ?? null,
    entryFee: initialData?.entryFee ?? 40,
    prize1st: initialData?.prize1st ?? 500,
    prize2nd: initialData?.prize2nd ?? 300,
    prize3rd: initialData?.prize3rd ?? 100,
    prizeMvp: initialData?.prizeMvp ?? 250,
    organizerSplit: initialData?.organizerSplit ?? 50,
    streamerSplit: initialData?.streamerSplit ?? 50,
    arenaBettingEnabled: initialData?.arenaBettingEnabled ?? false,
    discipline: initialData?.discipline ?? 'warzone',
    mode: initialData?.mode ?? 'duos',
    format: initialData?.format ?? 'battle_royale_clasico',
    level: initialData?.level ?? 'casual',
    badgeUrl: initialData?.badgeUrl ?? '',
    scoringRule: initialData?.scoringRule ?? {
      killPoints: 1,
      placementPoints: { '1': 15, '2': 12, '3': 10, '4': 8, '5': 6, '6': 4, '7': 2, '8': 1 },
    },
    ...initialData,
    startDate: formatDateForInput(initialData?.startDate),
    endDate: formatDateForInput(initialData?.endDate),
    registrationStartDate: formatDateForInput(initialData?.registrationStartDate),
    registrationEndDate: formatDateForInput(initialData?.registrationEndDate),
  }

  const methods = useForm<CreateTournamentInput>({
    resolver: zodResolver(createTournamentSchema),
    defaultValues,
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = methods

  const level = watch('level')
  const format = watch('format')
  const mode = watch('mode')
  const rulesText = watch('rulesText') ?? ''
  const isPrivate = watch('isPrivate')
  const discipline = watch('discipline')

  const maxMatches = level === 'casual' ? 3 : level === 'profesional' ? 12 : undefined
  const minMatches = level === 'profesional' ? 6 : 1

  async function onSubmit(data: CreateTournamentInput) {
    setServerError(null)
    const cleanedData = { ...data }
    if (!cleanedData.entryFee || cleanedData.entryFee === 0) {
      cleanedData.organizerSplit = 0
      cleanedData.streamerSplit = 0
    }
    
    let result
    if (tournamentId) {
      result = await updateTournament(tournamentId, cleanedData)
    } else {
      result = await createTournament(cleanedData)
    }

    if ('error' in result) {
      setServerError(result.error)
      toast.error(`Error al guardar: ${result.error}`)
      return
    }
    toast.success(tournamentId ? 'Torneo actualizado correctamente' : 'Torneo creado con éxito')
    if (onSuccess) {
      onSuccess(result.data.id)
    } else {
      router.push(`/tournaments/${result.data.id}`)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = (msg: any) => typeof msg === 'string' ? <p className="text-red-400 text-xs mt-1">{msg}</p> : null

  const inputClass =
    'w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 ' +
    'focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 focus:outline-none transition-all duration-150'

  if (!mounted) {
    return (
      <div className="animate-pulse space-y-8 py-4">
        <div className="space-y-3">
          <div className="h-4 bg-white/10 rounded w-1/4"></div>
          <div className="h-10 bg-white/5 rounded-lg"></div>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-white/10 rounded w-1/3"></div>
          <div className="h-24 bg-white/5 rounded-lg"></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-10 bg-white/5 rounded-lg"></div>
          <div className="h-10 bg-white/5 rounded-lg"></div>
        </div>
      </div>
    )
  }

  return (
    <FormProvider {...methods}>
      <form 
        onSubmit={handleSubmit(onSubmit, (errors) => {
          console.error('Validation errors:', errors)
          toast.error('Por favor, completa todos los campos requeridos del formulario.')
        })} 
        className="space-y-10"
      >

        {/* ── Section 1: Información básica ── */}
        <section>
          <SectionHeader title="Información básica" subtitle="Nombre, descripción y fechas del torneo" />
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                Nombre del torneo *
              </label>
              <input
                {...register('name')}
                placeholder="Ej: Torneo Verano 2025"
                className={`${inputClass} text-base font-medium`}
              />
              {err(errors.name?.message)}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                Descripción
              </label>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Describe brevemente el torneo..."
                className={`${inputClass} resize-none`}
              />
              {err(errors.description?.message)}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                  Fecha de inicio
                </label>
                <input
                  type="date"
                  {...register('startDate')}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                  Fecha de fin
                </label>
                <input
                  type="date"
                  {...register('endDate')}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Clash Royale Tag */}
            {discipline === 'clash_royale' && (
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                  Tag del Torneo de Clash Royale (Opcional - Sincronización en Vivo)
                </label>
                <input
                  {...register('clashRoyaleTag')}
                  placeholder="Ej: #2PPG0GG0"
                  className={inputClass}
                />
                <p className="text-xs text-white/45 mt-1">
                  Ingresa el tag del torneo de Clash Royale (ej. #2PPG0GG0) para importar participantes y sincronizar el marcador automáticamente.
                </p>
                {err(errors.clashRoyaleTag?.message)}
              </div>
            )}
          </div>
        </section>

        {/* ── Section 2: Configuración ── */}
        <section>
          <SectionHeader title="Configuración" subtitle="Modalidad, formato y nivel de competencia" />
          <div className="space-y-6">

            {/* Game / Discipline */}
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                Juego / Disciplina *
              </label>
              <select
                {...register('discipline')}
                className={inputClass}
                onChange={(e) => {
                  const val = e.target.value
                  setValue('discipline', val)
                  // Automate templates based on selected game rules
                  if (val === 'clash_royale') {
                    setValue('format', 'custom_rooms')
                    setValue('mode', 'individual')
                    setValue('totalMatches', 1)
                    setValue('defaultRoundsPerMatch', 1)
                    setValue('level', 'casual')
                  } else if (val === 'street_fighter_6' || val === 'super_smash_bros_ultimate') {
                    setValue('format', 'eliminacion_directa')
                    setValue('mode', 'individual')
                    setValue('totalMatches', 1)
                    setValue('defaultRoundsPerMatch', 3) // BO3 por defecto para lucha
                    setValue('level', 'casual')
                  } else if (val === 'league_of_legends' || val === 'valorant') {
                    setValue('format', 'eliminacion_directa')
                    setValue('mode', 'quintas')
                    setValue('totalMatches', 1)
                    setValue('defaultRoundsPerMatch', 1) // BO1 por defecto para MOBA/Tactical
                    setValue('level', 'casual')
                  } else if (val === 'free_fire') {
                    setValue('format', 'battle_royale_clasico')
                    setValue('mode', 'cuartetos')
                    setValue('totalMatches', 3)
                    setValue('defaultRoundsPerMatch', 1)
                  } else {
                    setValue('format', 'battle_royale_clasico')
                    setValue('mode', 'duos')
                    setValue('totalMatches', 3)
                    setValue('defaultRoundsPerMatch', 1)
                  }
                }}
              >
                <option value="warzone" className="bg-neutral-900 text-white">Call of Duty: Warzone 🪂</option>
                <option value="clash_royale" className="bg-neutral-900 text-white">Clash Royale 👑</option>
                <option value="fortnite" className="bg-neutral-900 text-white">Fortnite ⛏️</option>
                <option value="free_fire" className="bg-neutral-900 text-white">Free Fire 🔥</option>
                <option value="call_of_duty_mobile" className="bg-neutral-900 text-white">Call of Duty Mobile 🔫</option>
                <option value="street_fighter_6" className="bg-neutral-900 text-white">Street Fighter 6 👊</option>
                <option value="super_smash_bros_ultimate" className="bg-neutral-900 text-white">Super Smash Bros Ultimate 💥</option>
                <option value="league_of_legends" className="bg-neutral-900 text-white">League of Legends 🏆</option>
                <option value="valorant" className="bg-neutral-900 text-white">Valorant 🎯</option>
              </select>
              {err(errors.discipline?.message)}
            </div>

            {/* Tournament Badge Url (Insignia) */}
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                Insignia del Torneo (Imagen URL o Cargar Archivo) *
              </label>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  required
                  {...register('badgeUrl')}
                  placeholder="Ej: https://res.cloudinary.com/.../badge.png"
                  className={`${inputClass} flex-1`}
                />
                
                <label className="shrink-0 flex items-center justify-center px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white hover:bg-white/10 hover:border-white/20 transition-all duration-150 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBadgeUpload}
                    disabled={uploadingBadge}
                    className="hidden"
                  />
                  <svg className="w-4 h-4 mr-2 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  {uploadingBadge ? 'Subiendo...' : 'Subir Local (.png, .gif)'}
                </label>
              </div>
              
              <p className="text-xs text-white/45 mt-1.5">
                Sube un archivo desde tu equipo (admite GIFs animados) o ingresa una URL. Se otorgará automáticamente a los ganadores (Top 3) al finalizar el torneo.
              </p>
              {err(errors.badgeUrl?.message)}
            </div>

            {/* Tournament Mode */}
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
                Modalidad *
              </label>
              {['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate'].includes(discipline) ? (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 flex items-center gap-3">
                  <span className="text-xl">👤</span>
                  <div>
                    <p className="font-semibold text-white">Individual (1v1)</p>
                    <p className="text-xs text-white/40">Forzado automáticamente para esta disciplina.</p>
                  </div>
                </div>
              ) : ['league_of_legends', 'valorant'].includes(discipline) ? (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 flex items-center gap-3">
                  <span className="text-xl">🛡️</span>
                  <div>
                    <p className="font-semibold text-white">Quintas (5v5)</p>
                    <p className="text-xs text-white/40">Forzado automáticamente para esta disciplina de equipos.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {MODES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setValue('mode', m.value)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-150
                        ${mode === m.value
                          ? 'border-neon-cyan bg-neon-cyan/10 text-white'
                          : 'border-transparent bg-white/5 text-white/50 hover:border-neon-purple/50 hover:text-white/80'
                        }`}
                    >
                      <span className="text-2xl">{m.icon}</span>
                      <span className="text-sm font-medium">{m.label}</span>
                      <span className="text-xs opacity-60">{m.desc}</span>
                    </button>
                  ))}
                </div>
              )}
              {err(errors.mode?.message)}
            </div>

            {/* Competition Format */}
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
                Formato de competencia *
              </label>
              {discipline === 'clash_royale' ? (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 flex items-center gap-3">
                  <span className="text-xl">👑</span>
                  <div>
                    <p className="font-semibold text-white">Custom Rooms / Torneo Sincronizado por API</p>
                    <p className="text-xs text-white/40">Forzado automáticamente. Los resultados se importarán mediante el tag del torneo.</p>
                  </div>
                </div>
              ) : ['street_fighter_6', 'super_smash_bros_ultimate', 'league_of_legends', 'valorant'].includes(discipline) ? (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 flex items-center gap-3">
                  <span className="text-xl">🏆</span>
                  <div>
                    <p className="font-semibold text-white">Eliminación Directa (Playoffs / Brackets)</p>
                    <p className="text-xs text-white/40">Forzado automáticamente. Cuadro de eliminatorias de avance directo.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {FORMATS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setValue('format', f.value)}
                      className={`flex items-center gap-4 px-4 py-3 rounded-xl border-2 text-left transition-all duration-150
                        ${format === f.value
                          ? 'border-neon-cyan bg-neon-cyan/10'
                          : 'border-transparent bg-white/5 hover:border-neon-purple/50'
                        }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-150
                          ${format === f.value ? 'bg-neon-cyan' : 'bg-white/20'}`}
                      />
                      <div>
                        <p className={`text-sm font-medium transition-colors duration-150
                          ${format === f.value ? 'text-white' : 'text-white/60'}`}>
                          {f.label}
                        </p>
                        <p className="text-xs text-white/30 mt-0.5">{f.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {err(errors.format?.message)}
            </div>

            {/* Tournament Level (Shooters only) */}
            {(!discipline || !['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate', 'league_of_legends', 'valorant'].includes(discipline)) && (
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
                  Nivel *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      value: 'casual',
                      label: 'Casual',
                      desc: 'Hasta 3 partidas · Sin verificación obligatoria',
                    },
                    {
                      value: 'profesional',
                      label: 'Profesional',
                      desc: '6–12 partidas · Verificación de evidencias requerida',
                    },
                  ].map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => setValue('level', l.value as 'casual' | 'profesional')}
                      className={`flex flex-col gap-1.5 p-4 rounded-xl border-2 text-left transition-all duration-150
                        ${level === l.value
                          ? 'border-neon-purple bg-neon-purple/10'
                          : 'border-transparent bg-white/5 hover:border-neon-purple/30'
                        }`}
                    >
                      <span className={`text-sm font-semibold transition-colors duration-150
                        ${level === l.value ? 'text-neon-purple' : 'text-white/60'}`}>
                        {l.label}
                      </span>
                      <span className="text-xs text-white/30">{l.desc}</span>
                    </button>
                  ))}
                </div>
                {err(errors.level?.message)}
              </div>
            )}

            {/* Total Matches (Shooters only) */}
            {(!discipline || !['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate', 'league_of_legends', 'valorant'].includes(discipline)) && (
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                  Total de partidas *
                  {level === 'casual' && (
                    <span className="ml-2 text-white/30 normal-case font-normal">(máx. 3)</span>
                  )}
                  {level === 'profesional' && (
                    <span className="ml-2 text-white/30 normal-case font-normal">(6–12)</span>
                  )}
                </label>
                <input
                  type="number"
                  min={minMatches}
                  max={maxMatches}
                  {...register('totalMatches', { valueAsNumber: true })}
                  className="w-32 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm
                    focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 focus:outline-none
                    transition-all duration-150"
                />
                {err(errors.totalMatches?.message)}
              </div>
            )}

            {/* Límite de Puntos (Max Points) */}
            {(!discipline || !['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate', 'league_of_legends', 'valorant'].includes(discipline)) && (
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                  Límite de Puntos (Max Points)
                  <span className="ml-2 text-white/30 normal-case font-normal">(Dejar vacío para no usar límite)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  {...register('maxPointsLimit', { 
                    valueAsNumber: true,
                    setValueAs: (v) => v === '' || isNaN(v) ? null : v
                  })}
                  placeholder="Ej. 150"
                  className="w-48 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm
                    focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 focus:outline-none
                    transition-all duration-150"
                />
                {errors.maxPointsLimit && <p className="text-red-400 text-xs mt-1">{errors.maxPointsLimit.message}</p>}
              </div>
            )}

            {/* Rounds per Match (Fighting & MOBA only) */}
            {discipline && ['street_fighter_6', 'super_smash_bros_ultimate', 'league_of_legends', 'valorant'].includes(discipline) && (
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                  Rondas por Partida (Best of BO) *
                  <span className="ml-2 text-white/30 normal-case font-normal">(Ej: 3 para BO3, 5 para BO5)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  {...register('defaultRoundsPerMatch', { valueAsNumber: true })}
                  className="w-32 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm
                    focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 focus:outline-none
                    transition-all duration-150"
                />
                {err(errors.defaultRoundsPerMatch?.message)}
              </div>
            )}

            {/* Kill Race Time Limit */}
            {format === 'kill_race' && (
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                  Límite de tiempo Kill Race (minutos) *
                </label>
                <input
                  type="number"
                  min={1}
                  {...register('killRaceTimeLimitMinutes', { valueAsNumber: true })}
                  placeholder="Ej: 30"
                  className="w-40 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm
                    focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 focus:outline-none
                    transition-all duration-150"
                />
                {err(errors.killRaceTimeLimitMinutes?.message)}
              </div>
            )}
          </div>
        </section>

        {/* ── Section 3: Métricas ── */}
        {!['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate', 'league_of_legends', 'valorant'].includes(discipline) && (
          <section>
            <SectionHeader title="Métricas" subtitle="Activa las métricas que se mostrarán en el leaderboard" />
            <div className="space-y-3">
              {[
                {
                  field: 'killRateEnabled' as const,
                  label: 'Kill Rate',
                  desc: 'Promedio de kills por partida',
                },
                {
                  field: 'potTopEnabled' as const,
                  label: 'Pot Top',
                  desc: 'Veces que el equipo terminó en el top',
                },
                {
                  field: 'vipEnabled' as const,
                  label: 'Top Fragger (MVP)',
                  desc: 'Métrica especial para destacar al mejor jugador del equipo',
                },
                {
                  field: 'tiebreakerMatchEnabled' as const,
                  label: 'Partida de desempate',
                  desc: 'Permite programar una partida extra en caso de empate',
                },
              ].map(({ field, label, desc }) => {
                const value = watch(field)
                return (
                  <button
                    key={field}
                    type="button"
                    onClick={() => setValue(field, !value)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-150
                      ${value
                        ? 'border-neon-cyan/30 bg-neon-cyan/5'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                      }`}
                  >
                    <div className="text-left">
                      <p className={`text-sm font-medium transition-colors duration-150
                        ${value ? 'text-white' : 'text-white/50'}`}>
                        {label}
                      </p>
                      <p className="text-xs text-white/30 mt-0.5">{desc}</p>
                    </div>
                    {/* Toggle pill */}
                    <div
                      className={`relative w-10 h-5 rounded-full transition-colors duration-150 shrink-0
                        ${value ? 'bg-neon-cyan' : 'bg-white/10'}`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-150
                          ${value ? 'translate-x-5' : 'translate-x-0.5'}`}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Section: Inscripciones y Privacidad ── */}
        <section className="space-y-6">
          <SectionHeader title="Inscripciones y Privacidad" subtitle="Configura los límites de inscripción y acceso" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                Límite de Equipos (Cupo Máximo)
              </label>
              <input
                type="number"
                min="1"
                {...register('maxTeams', { valueAsNumber: true })}
                placeholder="Ej. 20 (Dejar vacío para ilimitados)"
                className={inputClass}
              />
              {errors.maxTeams && <p className="text-red-400 text-xs mt-1">{errors.maxTeams.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                Fecha Inicio de Inscripciones
              </label>
              <input
                type="date"
                {...register('registrationStartDate')}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                Fecha Límite de Inscripciones
              </label>
              <input
                type="date"
                {...register('registrationEndDate')}
                className={inputClass}
              />
            </div>

            {/* Private toggle & password */}
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setValue('isPrivate', !isPrivate)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-150
                  ${isPrivate
                    ? 'border-neon-purple/30 bg-neon-purple/5'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                  }`}
              >
                <div className="text-left">
                  <p className={`text-sm font-medium transition-colors duration-150
                    ${isPrivate ? 'text-white' : 'text-white/50'}`}>
                    Torneo Privado
                  </p>
                  <p className="text-xs text-white/30 mt-0.5">Requiere ingresar contraseña para inscribirse</p>
                </div>
                <div
                  className={`relative w-10 h-5 rounded-full transition-colors duration-150 shrink-0
                    ${isPrivate ? 'bg-neon-purple' : 'bg-white/10'}`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-150
                      ${isPrivate ? 'translate-x-5' : 'translate-x-0.5'}`}
                  />
                </div>
              </button>

              {isPrivate && (
                <div>
                  <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                    Contraseña de Inscripción *
                  </label>
                  <input
                    required
                    {...register('registrationPassword')}
                    placeholder="Ej. CLAVE123"
                    className={inputClass}
                  />
                  {errors.registrationPassword && <p className="text-red-400 text-xs mt-1">{errors.registrationPassword.message}</p>}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Section 4: Scoring Rule ── */}
        {!['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate', 'league_of_legends', 'valorant'].includes(discipline) && (
          <section>
            <SectionHeader
              title="Sistema de puntuación"
              subtitle="Define los puntos por kill y por posición de llegada"
            />
            <ScoringRuleEditor />
          </section>
        )}

        {/* ── Section 5: Rules text ── */}
        <section>
          <SectionHeader title="Reglamento" subtitle="Texto libre con las reglas del torneo (visible al público)" />
          <div>
            <textarea
              {...register('rulesText')}
              rows={8}
              placeholder="Escribe aquí las reglas del torneo..."
              className={`${inputClass} resize-none`}
            />
          </div>
        </section>
        
        {/* ── Section 6: Finanzas e Integración ── */}
        <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-8">
          <div>
            <SectionHeader title="Modelo Financiero" subtitle="Configura inscripciones, premios y repartición de ganancias" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Entry Fee & Prizes */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                    Costo de inscripción (por equipo)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">$</span>
                    <input
                      type="number"
                      {...register('entryFee', { valueAsNumber: true })}
                      className={`${inputClass} !pl-8`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-white/40 mb-1.5">1er Puesto</label>
                    <input type="number" {...register('prize1st', { valueAsNumber: true })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/40 mb-1.5">2do Puesto</label>
                    <input type="number" {...register('prize2nd', { valueAsNumber: true })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/40 mb-1.5">3er Puesto</label>
                    <input type="number" {...register('prize3rd', { valueAsNumber: true })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/40 mb-1.5">MVP (Top Fragger)</label>
                    <input type="number" {...register('prizeMvp', { valueAsNumber: true })} className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Revenue Splits */}
              {watch('entryFee') > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-xs font-bold text-neon-cyan uppercase tracking-widest mb-4">Repartición del Sobrante</p>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs mb-2">
                          <span className="text-white/60">Organizador</span>
                          <span className="text-white">{watch('organizerSplit')}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" max="100" 
                          {...register('organizerSplit', { valueAsNumber: true })}
                          className="w-full accent-neon-cyan h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                          onChange={(e) => setValue('streamerSplit', 100 - parseInt(e.target.value))}
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-2">
                          <span className="text-white/60">Streamer</span>
                          <span className="text-white">{watch('streamerSplit')}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" max="100" 
                          value={watch('streamerSplit')}
                          readOnly
                          className="w-full accent-neon-purple h-1.5 bg-white/10 rounded-lg appearance-none opacity-50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-white/5">
            <SectionHeader title="ArenaCrypto Integration" subtitle="Habilita las apuestas de la comunidad" />
            <button
              type="button"
              onClick={() => setValue('arenaBettingEnabled', !watch('arenaBettingEnabled'))}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-150
                ${watch('arenaBettingEnabled')
                  ? 'border-neon-cyan bg-neon-cyan/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${watch('arenaBettingEnabled') ? 'bg-neon-cyan text-black' : 'bg-white/10 text-white/40'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-white uppercase tracking-tight">Habilitar Apuestas Públicas</p>
                  <p className="text-xs text-white/40">Los fans podrán apostar por sus equipos favoritos en ArenaCrypto.</p>
                </div>
              </div>
              <div className={`w-12 h-6 rounded-full relative transition-colors ${watch('arenaBettingEnabled') ? 'bg-neon-cyan' : 'bg-white/20'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${watch('arenaBettingEnabled') ? 'left-7' : 'left-1'}`} />
              </div>
            </button>
          </div>
        </section>

        {/* ── Server error ── */}
        {serverError && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
            {serverError}
          </div>
        )}

        {/* ── Submit ── */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3 rounded-xl font-semibold text-sm text-white
              bg-gradient-to-r from-neon-cyan to-neon-purple
              hover:opacity-90 active:scale-[0.97]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-150 shadow-lg shadow-neon-cyan/10"
          >
            {isSubmitting
              ? (tournamentId ? 'Guardando...' : 'Creando torneo...')
              : (tournamentId ? 'Guardar Cambios' : 'Crear torneo')}
          </button>
        </div>
      </form>
    </FormProvider>
  )
}
