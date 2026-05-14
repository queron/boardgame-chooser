export type NightStatus = "open" | "locked";

export type CompetitionPreference = number;
export type LegacyCompetitionPreference = "competitive" | "cooperative" | "either";
export type PlayTimeMode = "fixed" | "range" | "perPlayer";

export type GameNight = {
  slug: string;
  title: string;
  eventDate?: string;
  status: NightStatus;
  createdAt: string;
  updatedAt: string;
};

export type Participant = {
  id: string;
  displayName: string;
  nightId: string;
  submittedAt: string;
};

export type GameCandidate = {
  id: string;
  bggId?: number;
  title: string;
  year?: number;
  minPlayers: number;
  maxPlayers: number;
  playTimeMode?: PlayTimeMode;
  playingTime: number;
  minPlayTime?: number;
  maxPlayTime?: number;
  weight?: number;
  categories: string[];
  mechanics: string[];
  imageUrl?: string;
  submittedBy?: string;
  manualOverrides: boolean;
};

export type PreferenceSubmission = {
  participantId: string;
  challenge: number;
  interaction: number;
  competition: CompetitionPreference | LegacyCompetitionPreference;
  themes: string[];
  tones: string[];
  maxPlayTime: number;
};

export type GameNightRecord = GameNight & {
  participants: Participant[];
  games: GameCandidate[];
  preferences: PreferenceSubmission[];
};

export type RankedGame = {
  game: GameCandidate;
  score: number;
  reasons: string[];
  scoreBreakdown: Record<string, number>;
};

export type Recommendation = {
  playerCount: number;
  maxScore: number;
  rankedGames: RankedGame[];
  exclusions: { game: GameCandidate; reason: string }[];
  suggestedOrder: string[];
  explanation: string[];
  generatedAt: string;
};

export type BggSearchResult = {
  bggId: number;
  title: string;
  year?: number;
};

export type BggGameDetails = BggSearchResult & {
  minPlayers: number;
  maxPlayers: number;
  playTimeMode?: PlayTimeMode;
  playingTime: number;
  minPlayTime?: number;
  maxPlayTime?: number;
  weight?: number;
  categories: string[];
  mechanics: string[];
  imageUrl?: string;
};
