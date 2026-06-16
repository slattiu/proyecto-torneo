import type { TeamStanding, ScoringRule, Submission } from '@/types'

// ---- Types locales del engine ----

export interface MatchResult {
  teamId: string
  position: number
  kills: number
  potTop: boolean
}

export interface GroupConfig {
  groupId: string
  teamIds: string[]
  advanceCount: number
}

export interface GroupResult {
  groupId: string
  standings: TeamStanding[]
  advancingTeamIds: string[]
}

/**
 * Calcula los puntos de un equipo en una partida.
 * Property 15: result = placementPoints[position] + killPoints * kills
 */
export function calculateMatchPoints(
  rule: ScoringRule,
  position: number,
  kills: number
): number {
  if (rule.useMultiplier) {
    const multiplier = rule.placementPoints[String(position)] !== undefined
      ? Number(rule.placementPoints[String(position)])
      : 1
    return (kills * rule.killPoints) * multiplier
  }
  const placement = rule.placementPoints[String(position)] ?? 0
  return placement + rule.killPoints * kills
}

/**
 * Calcula el total de puntos a través de todas las partidas.
 * Property 15: sum of calculateMatchPoints per match
 */
export function calculateTournamentPoints(
  matchResults: MatchResult[],
  rule: ScoringRule
): number {
  return matchResults.reduce(
    (sum, r) => sum + calculateMatchPoints(rule, r.position, r.kills),
    0
  )
}

/**
 * Calcula el Kill Rate.
 * Property 16: totalKills / totalMatches
 */
export function calculateKillRate(totalKills: number, totalMatches: number): number {
  if (totalMatches === 0) return 0
  return totalKills / totalMatches
}

/**
 * Cuenta los Pot Tops aprobados.
 * Property 17: count of approved submissions where potTop = true
 */
export function calculatePotTopCount(
  submissions: Pick<Submission, 'potTop' | 'status'>[]
): number {
  return submissions.filter((s) => s.potTop && s.status === 'approved').length
}

/**
 * Incluye el VIP score en el total.
 * Property 18: points + vipScore
 */
export function calculateTotalWithVip(points: number, vipScore: number): number {
  return points + vipScore
}

/**
 * Ordena equipos por puntos desc, desempate por kills totales desc,
 * luego por mejor posición en última partida.
 * Properties 19, 20
 */
export function rankTeams(
  standings: Omit<TeamStanding, 'rank' | 'previousRank'>[],
  lastMatchPositions?: Record<string, number>
): TeamStanding[] {
  const sorted = [...standings].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills
    const posA = lastMatchPositions?.[a.teamId] ?? Infinity
    const posB = lastMatchPositions?.[b.teamId] ?? Infinity
    return posA - posB
  })
  return sorted.map((s, i) => ({ ...s, rank: i + 1 }))
}

/**
 * Computa standings completos a partir de submissions aprobadas.
 * Property 21: orden de aprobación no afecta el resultado (confluence)
 */
export function computeStandings(
  approvedSubmissions: Submission[],
  rule: ScoringRule,
  config: {
    totalMatches: number
    teams: { id: string; name: string; avatarUrl?: string; vipScore: number }[]
    lastMatchPositions?: Record<string, number>
  }
): TeamStanding[] {
  const byTeam = new Map<string, Submission[]>()
  for (const team of config.teams) byTeam.set(team.id, [])
  for (const sub of approvedSubmissions) {
    if (!byTeam.has(sub.teamId)) byTeam.set(sub.teamId, [])
    byTeam.get(sub.teamId)!.push(sub)
  }

  const standings = config.teams.map((team) => {
    const subs = byTeam.get(team.id) ?? []
    const totalKills = subs.reduce((sum, s) => sum + s.killCount, 0)
    
    let totalPointsWithoutVip = 0
    let totalPlacementPoints = 0

    if (rule.useMultiplier) {
      totalPointsWithoutVip = subs.reduce((sum, s) => {
        const pos = s.rank || (s.potTop ? 1 : 0)
        return sum + calculateMatchPoints(rule, pos, s.killCount)
      }, 0)
    } else {
      totalPlacementPoints = subs.reduce((sum, s) => {
        const pos = s.rank || (s.potTop ? 1 : 0)
        const pRules = (rule.placementPoints as any) || {}
        const points = pos > 0 ? (Number(pRules[String(pos)]) || 0) : 0
        return sum + points
      }, 0)
      totalPointsWithoutVip = (totalKills * rule.killPoints) + totalPlacementPoints
    }

    const potTopCount = calculatePotTopCount(subs)
    const killRate = calculateKillRate(totalKills, subs.length)
    const totalPoints = calculateTotalWithVip(totalPointsWithoutVip, team.vipScore)

    if (totalPlacementPoints > 0) {
      console.log(`[ENGINE] Team ${team.name} Total Placement Pts: ${totalPlacementPoints}`)
    }

    return {
      teamId: team.id,
      teamName: team.name,
      avatarUrl: team.avatarUrl,
      totalPoints,
      totalKills,
      killRate,
      potTopCount,
      vipScore: team.vipScore,
    }
  })

  return rankTeams(standings, config.lastMatchPositions)
}

/**
 * Calcula standings para Kill Race (solo kills, placement = 0).
 * Property 32
 */
export function calculateKillRaceStandings(
  approvedSubmissions: Submission[],
  teams: { id: string; name: string; avatarUrl?: string; vipScore: number }[]
): TeamStanding[] {
  const killRaceRule: ScoringRule = {
    id: 'kill-race',
    tournamentId: '',
    killPoints: 1,
    placementPoints: {},
  }
  return computeStandings(approvedSubmissions, killRaceRule, { totalMatches: 1, teams })
}

/**
 * Calcula standings por grupo y determina equipos que avanzan.
 * Property 35
 */
export function calculateGroupStageStandings(
  groups: GroupConfig[],
  approvedSubmissions: Submission[],
  rule: ScoringRule,
  allTeams: { id: string; name: string; avatarUrl?: string; vipScore: number }[],
  totalMatches: number
): GroupResult[] {
  return groups.map((group) => {
    const groupTeams = allTeams.filter((t) => group.teamIds.includes(t.id))
    const groupSubs = approvedSubmissions.filter((s) => group.teamIds.includes(s.teamId))
    const standings = computeStandings(groupSubs, rule, { totalMatches, teams: groupTeams })
    const advancingTeamIds = standings.slice(0, group.advanceCount).map((s) => s.teamId)
    return { groupId: group.groupId, standings, advancingTeamIds }
  })
}
