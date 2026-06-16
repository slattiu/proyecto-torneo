// TypeScript types for Tournament Leaderboard Platform
// TODO: Task 2.3 — Full type definitions

export type TournamentMode = 'individual' | 'duos' | 'trios' | 'cuartetos' | 'quintas';
export type CompetitionFormat =
  | 'battle_royale_clasico'
  | 'kill_race'
  | 'custom_rooms'
  | 'eliminacion_directa'
  | 'fase_de_grupos';
export type TournamentLevel = 'casual' | 'profesional';
export type TournamentStatus = 'draft' | 'pending' | 'active' | 'finished';
export type TournamentType =
  | 'battle_royale'
  | 'kill_race'
  | 'deathmatch'
  | 'eliminacion_directa'
  | 'custom';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface Tournament {
  id: string;
  creatorId: string;
  name: string;
  description?: string;
  rulesText?: string;
  slug: string;
  mode: TournamentMode;
  format: CompetitionFormat;
  level: TournamentLevel;
  status: TournamentStatus;
  totalMatches: number;
  matchesCompleted: number;
  killRateEnabled: boolean;
  potTopEnabled: boolean;
  vipEnabled: boolean;
  tiebreakerMatchEnabled: boolean;
  killRaceTimeLimitMinutes?: number;
  defaultRoundsPerMatch: number;
  startDate?: string;
  endDate?: string;
  championImageUrl?: string;
  logoUrl?: string;
  hideLogoInLeaderboard?: boolean;

  // Finance Model
  entryFee: number;
  prize1st: number;
  prize2nd: number;
  prize3rd: number;
  prizeMvp: number;
  organizerSplit: number;
  streamerSplit: number;

  // Arena Betting
  arenaBettingEnabled: boolean;
  arenaBettingStatus: 'open' | 'closed' | 'paused';
  totalLiveViewers: number;

  // Arena Crypto sync
  tournamentType: TournamentType;

  // Registration & Capacity
  maxTeams?: number | null;
  isPrivate?: boolean;
  registrationPassword?: string | null;
  registrationStartDate?: string | null;
  registrationEndDate?: string | null;
  clashRoyaleTag?: string | null;
  discipline: string;
  badgeUrl?: string | null;
}

export interface ScoringRule {
  id: string;
  tournamentId: string;
  killPoints: number;
  placementPoints: Record<string, number>;
  useMultiplier?: boolean;
}

export interface Team {
  id: string;
  tournamentId: string;
  name: string;
  avatarUrl?: string;
  streamUrl?: string;
  vipScore: number;
}

export interface Participant {
  id: string;
  tournamentId: string;
  teamId?: string;
  displayName: string;
  avatarUrl?: string;
  contactId?: string;
  streamUrl?: string;
  isCaptain: boolean;
  totalKills: number;
  kdRatio?: number;
  avgKills?: number;
  classificationRank?: string;
  brAvgPlacement?: number;
  color?: string;
}

export interface Submission {
  id: string;
  tournamentId: string;
  teamId: string;
  matchId: string;
  submittedBy: string;
  killCount: number;
  rank?: number;
  potTop: boolean;
  status: SubmissionStatus;
  rejectionReason?: string;
  submittedAt: string;
  aiStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  aiData?: any;
  aiConfidence?: number;
  aiError?: string;
  playerKills?: Record<string, number>;
}

export interface Match {
  id: string;
  tournamentId: string;
  name: string;
  matchNumber: number;
  isCompleted: boolean;
  isWarmup: boolean;
  isActive: boolean;
  parentMatchId?: string;
  roundNumber: number;
  mapName?: string;
  createdAt: string;
}

export interface TeamStanding {
  teamId: string;
  teamName: string;
  avatarUrl?: string;
  streamUrl?: string;
  streams?: { name: string; url: string }[];
  totalPoints: number;
  totalKills: number;
  killRate: number;
  potTopCount: number;
  vipScore: number;
  rank: number;
  previousRank?: number;
}

export interface LeaderboardTheme {
  presetName?: string;
  primaryColor: string;
  backgroundType: 'solid' | 'gradient' | 'image';
  backgroundValue: string;
  fontFamily: string;
  logoUrl?: string;
  bannerUrl?: string;
  columnOrder: string[];
  visibleColumns: Record<string, boolean>;
}

export interface BracketRound {
  roundNumber: number;
  roundName: string;
  matchups: BracketMatchup[];
}

export interface BracketMatchup {
  id: string;
  teamA?: Team;
  teamB?: Team;
  winner?: Team;
  isBye: boolean;
}

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  order: number;
}
