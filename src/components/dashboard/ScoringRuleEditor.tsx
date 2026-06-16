'use client'

import { useFormContext } from 'react-hook-form'
import type { CreateTournamentInput } from '@/lib/validations/schemas'

const PRESETS = {
  battle_royale: {
    label: 'Battle Royale estándar',
    points: { '1': 15, '2': 12, '3': 10, '4': 8, '5': 6, '6': 4, '7': 2, '8': 1 },
    useMultiplier: false,
  },
  kill_race: {
    label: 'Kill Race',
    points: { '1': 0, '2': 0, '3': 0, '4': 0 },
    useMultiplier: false,
  },
  wsow: {
    label: 'WSOW Multipliers',
    points: {
      '1': 2.0,
      '2': 1.5,
      '3': 1.5,
      '4': 1.5,
      '5': 1.5,
      '6': 1.25,
      '7': 1.25,
      '8': 1.25,
      '9': 1.25,
      '10': 1.25,
      '11': 1.25,
      '12': 1.25,
      '13': 1.25,
      '14': 1.25,
      '15': 1.25
    },
    useMultiplier: true,
  },
  custom: {
    label: 'Custom',
    points: {},
    useMultiplier: false,
  },
} as const

type PresetKey = keyof typeof PRESETS

export function ScoringRuleEditor() {
  const { register, watch, setValue, formState: { errors } } = useFormContext<CreateTournamentInput>()

  const killPoints = watch('scoringRule.killPoints') ?? 1
  const placementPoints = watch('scoringRule.placementPoints') ?? {}
  const useMultiplier = watch('scoringRule.useMultiplier') ?? false

  // Convert record to sorted array for display
  const rows = Object.entries(placementPoints as Record<string, number>)
    .map(([pos, pts]) => ({ pos: Number(pos), pts: Number(pts) }))
    .sort((a, b) => a.pos - b.pos)

  function applyPreset(key: PresetKey) {
    setValue('scoringRule.placementPoints', PRESETS[key].points as Record<string, number>)
    setValue('scoringRule.useMultiplier', PRESETS[key].useMultiplier)
  }

  function addRow() {
    const nextPos = rows.length > 0 ? Math.max(...rows.map((r) => r.pos)) + 1 : 1
    setValue('scoringRule.placementPoints', {
      ...placementPoints,
      [String(nextPos)]: useMultiplier ? 1.0 : 0,
    })
  }

  function removeRow(pos: number) {
    const updated = { ...placementPoints }
    delete updated[String(pos)]
    setValue('scoringRule.placementPoints', updated)
  }

  function updateRow(oldPos: number, newPos: number, pts: number) {
    const updated = { ...placementPoints }
    delete updated[String(oldPos)]
    updated[String(newPos)] = pts
    setValue('scoringRule.placementPoints', updated)
  }

  // Preview calculation
  const firstPos = rows[0]
  const previewPlacementValue = firstPos ? Number(firstPos.pts) : (useMultiplier ? 1.0 : 0)
  const previewKills = 5
  const previewTotal = useMultiplier
    ? (previewKills * killPoints) * previewPlacementValue
    : previewPlacementValue + killPoints * previewKills

  return (
    <div className="space-y-5">
      {/* Scoring Type Selection */}
      <div>
        <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
          Sistema de Puntuación
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setValue('scoringRule.useMultiplier', false)
              // Reset values if they were floats
              const resetPoints = { ...placementPoints }
              Object.keys(resetPoints).forEach(key => {
                resetPoints[key] = Math.round(resetPoints[key])
              })
              setValue('scoringRule.placementPoints', resetPoints)
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all duration-150 ${
              !useMultiplier
                ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30'
                : 'bg-white/5 text-white/50 border-white/10 hover:text-white/80'
            }`}
          >
            Suma de puntos (Estándar)
          </button>
          <button
            type="button"
            onClick={() => {
              setValue('scoringRule.useMultiplier', true)
              // Convert values to float format if 0
              const resetPoints = { ...placementPoints }
              Object.keys(resetPoints).forEach(key => {
                if (resetPoints[key] === 0) resetPoints[key] = 1.0
              })
              setValue('scoringRule.placementPoints', resetPoints)
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all duration-150 ${
              useMultiplier
                ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30'
                : 'bg-white/5 text-white/50 border-white/10 hover:text-white/80'
            }`}
          >
            Multiplicador por puesto (Shooters / WSOW)
          </button>
        </div>
      </div>

      {/* Kill Points */}
      <div>
        <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
          Puntos por Kill
        </label>
        <input
          type="number"
          min={0}
          max={100}
          step={0.5}
          {...register('scoringRule.killPoints', { valueAsNumber: true })}
          className="w-32 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm
            focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 focus:outline-none
            transition-all duration-150"
        />
        {errors.scoringRule && 'killPoints' in errors.scoringRule && errors.scoringRule.killPoints && (
          <p className="text-red-400 text-xs mt-1">{String(errors.scoringRule.killPoints.message)}</p>
        )}
      </div>

      {/* Placement Points/Multipliers Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
            {useMultiplier ? 'Multiplicador por Posición' : 'Puntos por Posición'}
          </label>
          {/* Preset buttons */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className="px-2.5 py-1 rounded text-xs text-white/50 border border-white/10
                  hover:border-neon-purple/40 hover:text-white/80 transition-all duration-150"
              >
                {PRESETS[key].label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-white/40 uppercase tracking-wider">
                  Posición
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-white/40 uppercase tracking-wider">
                  {useMultiplier ? 'Multiplicador (x)' : 'Puntos'}
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-white/30 text-xs">
                    Sin posiciones configuradas. Agrega una o usa un preset.
                  </td>
                </tr>
              )}
              {rows.map(({ pos, pts }) => (
                <tr key={pos} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={1}
                      defaultValue={pos}
                      onBlur={(e) => updateRow(pos, Number(e.target.value), pts)}
                      className="w-16 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-sm
                        focus:border-neon-cyan/50 focus:outline-none transition-all duration-150"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      step={useMultiplier ? 0.01 : 1}
                      defaultValue={pts}
                      onBlur={(e) => updateRow(pos, pos, Number(e.target.value))}
                      className="w-24 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-sm
                        focus:border-neon-cyan/50 focus:outline-none transition-all duration-150"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => removeRow(pos)}
                      className="w-7 h-7 flex items-center justify-center rounded text-white/30
                        hover:text-red-400 hover:bg-red-400/10 transition-all duration-150"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={addRow}
          className="mt-3 flex items-center gap-1.5 text-xs text-neon-cyan/70 hover:text-neon-cyan
            transition-colors duration-150"
        >
          <span className="text-base leading-none">+</span>
          {useMultiplier ? 'Agregar posición / multiplicador' : 'Agregar posición'}
        </button>
      </div>

      {/* Live preview */}
      {rows.length > 0 && (
        <div className="rounded-xl bg-neon-cyan/5 border border-neon-cyan/20 px-4 py-3">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Previsualización de Puntos</p>
          <p className="text-sm text-white/80">
            1° lugar + {previewKills} kills ={' '}
            <span className="text-neon-cyan font-semibold">{previewTotal.toFixed(2).replace(/\.00$/, '')} pts</span>
            <span className="text-white/30 ml-2 text-xs">
              {useMultiplier
                ? `(${previewKills} kills × ${killPoints} pts × ${previewPlacementValue}x multiplicador)`
                : `(${previewPlacementValue} posición + ${killPoints} × ${previewKills} kills)`
              }
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
