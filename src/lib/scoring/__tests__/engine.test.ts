import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  calculateMatchPoints,
  calculateKillRate,
  calculatePotTopCount,
  calculateTotalWithVip,
  rankTeams,
  computeStandings,
  calculateKillRaceStandings,
  calculateGroupStageStandings,
} from '../engine'
import type { ScoringRule, Submission } from '@/types'

// ---- Arbitraries ----

const placementTableArb = (maxPos: number) =>
  fc.record(
    Object.fromEntries(
      Array.from({ length: maxPos }, (_, i) => [
        String(i + 1),
        fc.integer({ min: 0, max: 50 }),
      ])
    )
  ) as fc.Arbitrary<Record<string, number>>

const scoringRuleArb = (maxPos = 20): fc.Arbitrary<ScoringRule> =>
  fc.record({
    id: fc.constant('rule-1'),
    tournamentId: fc.constant('t-1'),
    killPoints: fc.float({ min: 0, max: 10, noNaN: true }),
    placementPoints: placementTableArb(maxPos),
  })

const submissionArb = (teamIds: string[], matchIds: string[]): fc.Arbitrary<Submission> =>
  fc.record({
    id: fc.uuid(),
    tournamentId: fc.constant('t-1'),
    teamId: fc.constantFrom(...teamIds),
    matchId: fc.constantFrom(...matchIds),
    submittedBy: fc.constant('p-1'),
    killCount: fc.integer({ min: 0, max: 30 }),
    potTop: fc.boolean(),
    status: fc.constant('approved' as const),
    rejectionReason: fc.constant(undefined),
    submittedAt: fc.constant(new Date().toISOString()),
  })

// ---- Tests ----

describe('Scoring Engine — Property-Based Tests', () => {

  it('Feature: tournament-leaderboard-platform, Property 15: scoring formula correctness', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 50 }),
        scoringRuleArb(),
        (position, kills, rule) => {
          const result = calculateMatchPoints(rule, position, kills)
          const expected =
            (rule.placementPoints[String(position)] ?? 0) + rule.killPoints * kills
          expect(result).toBeCloseTo(expected, 5)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Feature: tournament-leaderboard-platform, Property 16: Kill_Rate formula accuracy', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 1, max: 12 }),
        (totalKills, totalMatches) => {
          const result = calculateKillRate(totalKills, totalMatches)
          expect(result).toBeCloseTo(totalKills / totalMatches, 5)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Feature: tournament-leaderboard-platform, Property 17: Pot_Top count accuracy', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            potTop: fc.boolean(),
            status: fc.constantFrom(
              'approved' as const,
              'pending' as const,
              'rejected' as const
            ),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (submissions) => {
          const result = calculatePotTopCount(submissions)
          const expected = submissions.filter(
            (s) => s.potTop && s.status === 'approved'
          ).length
          expect(result).toBe(expected)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Feature: tournament-leaderboard-platform, Property 18: VIP score included in total', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000, noNaN: true }),
        fc.float({ min: 0, max: 500, noNaN: true }),
        (points, vipScore) => {
          const result = calculateTotalWithVip(points, vipScore)
          expect(result).toBeCloseTo(points + vipScore, 5)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Feature: tournament-leaderboard-platform, Property 19: Leaderboard descending order invariant', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            teamId: fc.uuid(),
            teamName: fc.string({ minLength: 1, maxLength: 20 }),
            totalPoints: fc.float({ min: 0, max: 1000, noNaN: true }),
            totalKills: fc.integer({ min: 0, max: 100 }),
            killRate: fc.float({ min: 0, max: 50, noNaN: true }),
            potTopCount: fc.integer({ min: 0, max: 20 }),
            vipScore: fc.float({ min: 0, max: 100, noNaN: true }),
          }),
          { minLength: 2, maxLength: 20 }
        ),
        (teams) => {
          const ranked = rankTeams(teams)
          for (let i = 0; i < ranked.length - 1; i++) {
            expect(ranked[i].totalPoints).toBeGreaterThanOrEqual(ranked[i + 1].totalPoints)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Feature: tournament-leaderboard-platform, Property 20: Tiebreaker by total kills', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (sharedPoints, killsA, killsB) => {
          fc.pre(killsA !== killsB)
          const teams = [
            {
              teamId: 'A', teamName: 'Team A',
              totalPoints: sharedPoints, totalKills: killsA,
              killRate: 0, potTopCount: 0, vipScore: 0,
            },
            {
              teamId: 'B', teamName: 'Team B',
              totalPoints: sharedPoints, totalKills: killsB,
              killRate: 0, potTopCount: 0, vipScore: 0,
            },
          ]
          const ranked = rankTeams(teams)
          const rankA = ranked.find((r) => r.teamId === 'A')!.rank
          const rankB = ranked.find((r) => r.teamId === 'B')!.rank
          if (killsA > killsB) {
            expect(rankA).toBeLessThan(rankB)
          } else {
            expect(rankB).toBeLessThan(rankA)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Feature: tournament-leaderboard-platform, Property 21: Approval order independence (confluence)', () => {
    const teamIds = ['t1', 't2', 't3']
    const matchIds = ['m1', 'm2']
    const teams = teamIds.map((id) => ({ id, name: id, vipScore: 0 }))

    fc.assert(
      fc.property(
        fc.array(submissionArb(teamIds, matchIds), { minLength: 1, maxLength: 15 }),
        scoringRuleArb(),
        (submissions, rule) => {
          const shuffled = [...submissions].sort(() => (Math.random() > 0.5 ? 1 : -1))
          const s1 = computeStandings(submissions, rule, { totalMatches: 2, teams })
          const s2 = computeStandings(shuffled, rule, { totalMatches: 2, teams })
          for (const standing of s1) {
            const match = s2.find((s) => s.teamId === standing.teamId)
            expect(match?.rank).toBe(standing.rank)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Feature: tournament-leaderboard-platform, Property 32: Kill_Race placement points are zero', () => {
    const teamIds = ['t1', 't2']
    const matchIds = ['m1']
    const teams = teamIds.map((id) => ({ id, name: id, vipScore: 0 }))

    fc.assert(
      fc.property(
        fc.array(submissionArb(teamIds, matchIds), { minLength: 1, maxLength: 10 }),
        (submissions) => {
          const standings = calculateKillRaceStandings(submissions, teams)
          for (let i = 0; i < standings.length - 1; i++) {
            expect(standings[i].totalKills).toBeGreaterThanOrEqual(standings[i + 1].totalKills)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Feature: tournament-leaderboard-platform, Property 35: Group stage advancement correctness', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 4 }),
        scoringRuleArb(),
        (advanceCount, teamCount, rule) => {
          fc.pre(advanceCount <= teamCount)
          const teamIds = Array.from({ length: teamCount }, (_, i) => `t${i}`)
          const teams = teamIds.map((id) => ({ id, name: id, vipScore: 0 }))
          const groups = [{ groupId: 'g1', teamIds, advanceCount }]
          const results = calculateGroupStageStandings(groups, [], rule, teams, 1)
          expect(results[0].advancingTeamIds).toHaveLength(advanceCount)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Feature: tournament-leaderboard-platform, calculateMatchPoints works correctly with multipliers', () => {
    const multiplierRule: ScoringRule = {
      id: 'rule-mult',
      tournamentId: 't-1',
      killPoints: 1.5,
      placementPoints: {
        '1': 2.0,
        '2': 1.5,
        '3': 1.25,
      },
      useMultiplier: true,
    }

    // 1st place with 10 kills -> 10 kills * 1.5 killPoints * 2.0 multiplier = 30 points
    expect(calculateMatchPoints(multiplierRule, 1, 10)).toBe(30)

    // 2nd place with 4 kills -> 4 * 1.5 * 1.5 = 9 points
    expect(calculateMatchPoints(multiplierRule, 2, 4)).toBe(9)

    // 4th place (unconfigured placement, defaults to 1.0x) with 6 kills -> 6 * 1.5 * 1.0 = 9 points
    expect(calculateMatchPoints(multiplierRule, 4, 6)).toBe(9)
  })
})

