import { z } from 'zod'

export const placementPointsSchema = z.record(
  z.string().regex(/^\d+$/),
  z.number().min(0)
)

export const scoringRuleSchema = z.object({
  killPoints: z.number().min(0).max(100),
  placementPoints: placementPointsSchema,
  useMultiplier: z.boolean().default(false),
})

const tournamentBaseSchema = z.object({
  name: z.string().min(3).max(255),
  description: z.string().max(1000).optional(),
  rulesText: z.string().max(5000).optional(),
  mode: z.enum(['individual', 'duos', 'trios', 'cuartetos', 'quintas']),
  format: z.enum([
    'battle_royale_clasico',
    'kill_race',
    'custom_rooms',
    'eliminacion_directa',
    'fase_de_grupos',
  ]),
  level: z.enum(['casual', 'profesional']),
  totalMatches: z.number().int().positive(),
  killRateEnabled: z.boolean().default(true),
  potTopEnabled: z.boolean().default(true),
  vipEnabled: z.boolean().default(false),
  tiebreakerMatchEnabled: z.boolean().default(false),
  killRaceTimeLimitMinutes: z.number().int().positive().optional(),
  defaultRoundsPerMatch: z.number().int().min(1).max(5).default(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')).or(z.null()),
  maxTeams: z.number().int().min(1).optional().nullable(),
  isPrivate: z.boolean().default(false),
  registrationPassword: z.string().max(100).optional().nullable(),
  registrationStartDate: z.string().optional().nullable(),
  registrationEndDate: z.string().optional().nullable(),
  hideLogoInLeaderboard: z.boolean().default(false),
  clashRoyaleTag: z.string().optional().nullable(),
  discipline: z.string().default('warzone'),
  badgeUrl: z.string().url().optional().or(z.literal('')).or(z.null()),
  maxPointsLimit: z.number().int().min(1).optional().nullable(),
  
  // Finance Model
  entryFee: z.number().min(0).default(0),
  prize1st: z.number().min(0).default(0),
  prize2nd: z.number().min(0).default(0),
  prize3rd: z.number().min(0).default(0),
  prizeMvp: z.number().min(0).default(0),
  organizerSplit: z.number().min(0).max(100).default(50),
  streamerSplit: z.number().min(0).max(100).default(50),

  // Arena Betting
  arenaBettingEnabled: z.boolean().default(false),

  scoringRule: scoringRuleSchema,
})

function refineTournament<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data: z.infer<typeof tournamentBaseSchema>, ctx: z.RefinementCtx) => {
    if (data.level === 'casual' && data.totalMatches > 3) {
      ctx.addIssue({
        code: 'custom',
        path: ['totalMatches'],
        message: 'Torneos casuales: máximo 3 partidas',
      })
    }
    if (
      data.level === 'profesional' &&
      (data.totalMatches < 6 || data.totalMatches > 12)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['totalMatches'],
        message: 'Torneos profesionales: entre 6 y 12 partidas',
      })
    }
    if (data.format === 'kill_race' && !data.killRaceTimeLimitMinutes) {
      ctx.addIssue({
        code: 'custom',
        path: ['killRaceTimeLimitMinutes'],
        message: 'Kill Race requiere un límite de tiempo',
      })
    }
  })
}

export const createTournamentSchema = refineTournament(tournamentBaseSchema)

export const updateTournamentSchema = tournamentBaseSchema.partial()

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>
export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>
export type ScoringRuleInput = z.infer<typeof scoringRuleSchema>

export const teamSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  streamUrl: z.string().url().optional().or(z.literal('')),
})

export const participantSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(100),
  contactId: z.string().max(255).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  streamUrl: z.string().url().optional().or(z.literal('')),
  teamId: z.string().uuid().optional(),
  isCaptain: z.boolean().default(false),
  color: z.string().max(30).optional().or(z.literal('')),
})

export const submissionSchema = z.object({
  tournamentId: z.string().uuid(),
  teamId: z.string().uuid(),
  matchId: z.string().uuid(),
  submittedBy: z.string().uuid(),
  killCount: z.number().int().min(0, 'Kills cannot be negative'),
  rank: z.number().int().min(1, 'El rango debe ser al menos 1').max(100).optional(),
  playerKills: z.record(z.string().uuid(), z.number().int().min(0)).optional(),
  potTop: z.boolean().default(false),
  evidence: z.object({
    storagePath: z.string(),
    fileName: z.string(),
    fileSize: z.number(),
    mimeType: z.string(),
  }),
})

export type CreateTeamInput = z.infer<typeof teamSchema>
export type CreateParticipantInput = z.infer<typeof participantSchema>
export type CreateSubmissionInput = z.infer<typeof submissionSchema>

