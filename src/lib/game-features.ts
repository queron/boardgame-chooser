import { estimatePlayTime } from "./playtime";
import type { GameCandidate, GameFeatureDimension, GameFeatureVector } from "./types";

type FeatureContribution = Partial<Record<GameFeatureDimension, number>>;

const DEFAULT_CONFIDENCE = 0.35;
const FEATURE_KEYS: GameFeatureDimension[] = [
  "interaction",
  "conflict",
  "cooperation",
  "randomness",
  "strategy",
  "narrative",
  "partyEnergy",
  "teachBurden",
];

export const BGG_MECHANIC_FEATURES: Record<string, FeatureContribution> = {
  "Acting": { interaction: 0.7, partyEnergy: 0.9 },
  "Alliances": { interaction: 0.9, conflict: 0.4, partyEnergy: 0.3 },
  "Area Majority / Influence": { interaction: 0.5, conflict: 0.7, strategy: 0.5 },
  "Auction/Bidding": { interaction: 0.5, strategy: 0.5 },
  "Betting and Bluffing": { interaction: 0.8, conflict: 0.5, partyEnergy: 0.5 },
  "Bluffing": { interaction: 0.8, conflict: 0.4, partyEnergy: 0.5 },
  "Campaign / Battle Card Driven": { narrative: 0.5, strategy: 0.6, teachBurden: 0.3 },
  "Card Drafting": { interaction: 0.35, strategy: 0.55 },
  "Cooperative Game": { cooperation: 1, interaction: 0.3 },
  "Deck, Bag, and Pool Building": { strategy: 0.7, teachBurden: 0.2 },
  "Deduction": { interaction: 0.4, strategy: 0.5 },
  "Dice Rolling": { randomness: 0.75, partyEnergy: 0.25 },
  "Fighting": { conflict: 0.9, interaction: 0.5 },
  "Hidden Roles": { interaction: 0.9, conflict: 0.45, partyEnergy: 0.75 },
  "Negotiation": { interaction: 0.95, conflict: 0.3, partyEnergy: 0.4 },
  "Player Elimination": { conflict: 0.9, teachBurden: 0.15 },
  "Push Your Luck": { randomness: 0.75, partyEnergy: 0.45 },
  "Role Playing": { narrative: 0.9, interaction: 0.5 },
  "Solo / Solitaire Game": { cooperation: 0.4, interaction: 0.05 },
  "Take That": { conflict: 0.85, interaction: 0.55, partyEnergy: 0.35 },
  "Team-Based Game": { cooperation: 0.75, interaction: 0.6 },
  "Trading": { interaction: 0.85, strategy: 0.3, partyEnergy: 0.3 },
  "Worker Placement": { strategy: 0.75, teachBurden: 0.35 },
};

export const BGG_CATEGORY_FEATURES: Record<string, FeatureContribution & { theme?: string }> = {
  "Abstract Strategy": { strategy: 0.75, narrative: 0, theme: "Abstract" },
  "Adventure": { narrative: 0.85, randomness: 0.15, theme: "Adventure" },
  "Animals": { narrative: 0.35, theme: "Animals" },
  "Bluffing": { interaction: 0.75, conflict: 0.35, partyEnergy: 0.5, theme: "Bluffing" },
  "Card Game": { strategy: 0.25, theme: "Cards" },
  "City Building": { strategy: 0.55, narrative: 0.35, theme: "City Building" },
  "Civilization": { strategy: 0.75, narrative: 0.6, teachBurden: 0.45, theme: "Civilization" },
  "Deduction": { interaction: 0.45, strategy: 0.5, theme: "Mystery" },
  "Economic": { strategy: 0.8, interaction: 0.35, teachBurden: 0.25, theme: "Economic" },
  "Fantasy": { narrative: 0.7, theme: "Fantasy" },
  "Fighting": { conflict: 0.8, interaction: 0.45, theme: "Conflict" },
  "Historical": { narrative: 0.55, strategy: 0.25, theme: "Historical" },
  "Horror": { narrative: 0.85, randomness: 0.2, theme: "Horror" },
  "Murder/Mystery": { narrative: 0.6, interaction: 0.5, strategy: 0.45, theme: "Mystery" },
  "Negotiation": { interaction: 0.9, conflict: 0.25, theme: "Negotiation" },
  "Party Game": { interaction: 0.85, partyEnergy: 1, teachBurden: -0.25, theme: "Party" },
  "Political": { interaction: 0.75, conflict: 0.35, strategy: 0.45, theme: "Political" },
  "Puzzle": { strategy: 0.65, interaction: -0.2, theme: "Puzzle" },
  "Science Fiction": { narrative: 0.7, theme: "Science Fiction" },
  "Space Exploration": { narrative: 0.75, strategy: 0.25, theme: "Space" },
  "Trains": { strategy: 0.65, interaction: 0.25, theme: "Trains" },
  "Wargame": { conflict: 0.9, strategy: 0.8, teachBurden: 0.6, theme: "Wargame" },
};

export function buildGameFeatureVector(game: GameCandidate, playerCount?: number): GameFeatureVector {
  const expectedMinutes = estimatePlayTime(game, playerCount);
  const durationUncertainty =
    game.playTimeMode === "range" && game.minPlayTime && game.maxPlayTime
      ? clamp01((game.maxPlayTime - game.minPlayTime) / Math.max(game.maxPlayTime, 1))
      : game.playTimeMode === "perPlayer"
        ? 0.35
        : 0.1;
  const complexity = clamp(game.weight ?? 3, 1, 5);
  const features = Object.fromEntries(FEATURE_KEYS.map((key) => [key, 0])) as Record<GameFeatureDimension, number>;
  const themeTags = new Set<string>();

  for (const category of game.categories ?? []) {
    const contribution = lookupContribution(BGG_CATEGORY_FEATURES, category);
    applyContribution(features, contribution);
    if (contribution?.theme) themeTags.add(contribution.theme);
  }

  for (const mechanic of game.mechanics ?? []) {
    applyContribution(features, lookupContribution(BGG_MECHANIC_FEATURES, mechanic));
  }

  const hasBggMetadata = Boolean(game.bggId || game.categories?.length || game.mechanics?.length || game.weight);
  const metadataConfidence = game.metadataConfidence ?? calculateMetadataConfidence(game, hasBggMetadata);
  const qualityPrior = calculateQualityPrior(game);

  return {
    expectedMinutes,
    durationUncertainty,
    complexity,
    interaction: clamp01(features.interaction),
    conflict: clamp01(features.conflict),
    cooperation: clamp01(features.cooperation),
    randomness: clamp01(features.randomness),
    strategy: clamp01(features.strategy + Math.max(0, (complexity - 2.5) / 5)),
    narrative: clamp01(features.narrative),
    partyEnergy: clamp01(features.partyEnergy + (expectedMinutes <= 45 ? 0.15 : 0)),
    teachBurden: clamp01(features.teachBurden + Math.max(0, (complexity - 2.5) / 4) + (expectedMinutes > 150 ? 0.2 : 0)),
    themeTags: Array.from(themeTags).sort(),
    confidence: metadataConfidence,
    qualityPrior,
  };
}

export function dynamicThemeOptions(games: GameCandidate[], limit = 8) {
  const counts = new Map<string, number>();
  for (const game of games) {
    for (const tag of buildGameFeatureVector(game).themeTags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

export function calculateMetadataConfidence(game: Pick<GameCandidate, "bggId" | "categories" | "mechanics" | "weight" | "bggUsersRated" | "bggWeightVotes">, hasBggMetadata = true) {
  const coreMetadata =
    (game.bggId ? 0.2 : 0) +
    (game.weight ? 0.15 : 0) +
    (game.categories?.length ? 0.15 : 0) +
    (game.mechanics?.length ? 0.15 : 0);
  const usersRated = Math.log1p(game.bggUsersRated ?? 0) / Math.log1p(5000);
  const weightVotes = Math.log1p(game.bggWeightVotes ?? 0) / Math.log1p(1000);
  return clamp01((hasBggMetadata ? DEFAULT_CONFIDENCE : 0.15) + coreMetadata + 0.25 * usersRated + 0.15 * weightVotes);
}

function calculateQualityPrior(game: GameCandidate) {
  const rating = game.bggBayesAverage ?? game.bggAverageRating;
  if (!rating) return 0.5;
  return clamp01((rating - 5) / 3);
}

function lookupContribution<T extends FeatureContribution>(table: Record<string, T>, key: string): T | undefined {
  return table[key] ?? table[normalizeLabel(key)];
}

function applyContribution(features: Record<GameFeatureDimension, number>, contribution?: FeatureContribution) {
  if (!contribution) return;
  for (const key of FEATURE_KEYS) {
    features[key] += contribution[key] ?? 0;
  }
}

function normalizeLabel(value: string) {
  return value.replaceAll(" and ", " & ").replaceAll(" / ", "/").trim();
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
