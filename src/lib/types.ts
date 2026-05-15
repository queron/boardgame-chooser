export type NightStatus = "open" | "locked";

export type CompetitionPreference = number;
export type LegacyCompetitionPreference = "competitive" | "cooperative" | "either";
export type PlayTimeMode = "fixed" | "range" | "perPlayer";
export type TimeFlexibility = "strict" | "flexible";
export type HardAvoid =
  | "take_that"
  | "heavy_teach"
  | "direct_conflict"
  | "bluffing"
  | "coop"
  | "downtime";
export type FeedbackReason =
  | "too_long"
  | "too_heavy"
  | "not_interactive"
  | "too_conflict_heavy"
  | "great_fit"
  | "wrong_player_count";

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
  expansions: BggExpansion[];
  imageUrl?: string;
  bggAverageRating?: number;
  bggBayesAverage?: number;
  bggUsersRated?: number;
  bggWeightVotes?: number;
  bggRank?: number;
  metadataConfidence?: number;
  submittedBy?: string;
  manualOverrides: boolean;
};

export type LearnedPreferenceProfile = {
  participantKey: string;
  complexityBias: number;
  interactionBias: number;
  conflictTolerance: number;
  cooperationAffinity: number;
  randomnessAffinity: number;
  strategyAffinity: number;
  narrativeAffinity: number;
  preferredDurationMinutes?: number;
  updatedAt: string;
};

export type PreferenceSubmission = {
  participantId: string;
  challenge: number;
  interaction: number;
  competition: CompetitionPreference | LegacyCompetitionPreference;
  themes: string[];
  tones: string[];
  maxPlayTime: number;
  timeFlexibility?: TimeFlexibility;
  hardAvoids?: HardAvoid[];
  learnedProfile?: LearnedPreferenceProfile;
};

export type GameNightRecord = GameNight & {
  participants: Participant[];
  games: GameCandidate[];
  preferences: PreferenceSubmission[];
  feedback?: PostNightFeedback[];
  learnedProfiles?: LearnedPreferenceProfile[];
};

export type RankedGame = {
  game: GameCandidate;
  score: number;
  reasons: string[];
  scoreBreakdown: Record<string, number>;
  participantScores?: {
    participantId: string;
    displayName: string;
    score: number;
    penalties: string[];
  }[];
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

export type BggExpansion = BggSearchResult;

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
  expansions: BggExpansion[];
  imageUrl?: string;
  bggAverageRating?: number;
  bggBayesAverage?: number;
  bggUsersRated?: number;
  bggWeightVotes?: number;
  bggRank?: number;
  metadataConfidence?: number;
};

export type GameFeatureDimension =
  | "interaction"
  | "conflict"
  | "cooperation"
  | "randomness"
  | "strategy"
  | "narrative"
  | "partyEnergy"
  | "teachBurden";

export type GameFeatureVector = Record<GameFeatureDimension, number> & {
  expectedMinutes: number;
  durationUncertainty: number;
  complexity: number;
  themeTags: string[];
  confidence: number;
  qualityPrior: number;
};

export type PostNightFeedback = {
  id: string;
  nightId: string;
  participantId?: string;
  participantName?: string;
  gameCandidateId: string;
  wasPlayed: boolean;
  enjoyment?: 1 | 2 | 3 | 4 | 5;
  wouldPlayAgain?: boolean;
  reasonTags?: FeedbackReason[];
  submittedAt: string;
};
