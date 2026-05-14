import type {
  CompetitionPreference,
  GameCandidate,
  GameNightRecord,
  LegacyCompetitionPreference,
  PreferenceSubmission,
  Recommendation,
} from "./types";
import { estimatePlayTime } from "./playtime";

const COOP_WORDS = ["cooperative game", "solo / solitaire game"];
const COMPETITIVE_WORDS = ["area majority", "auction", "betting", "economic", "fighting", "negotiation"];
const MAX_SCORE = 101;

export function recommendGames(night: GameNightRecord): Recommendation {
  const playerCount = night.participants.length;
  const preferences = night.preferences;
  const averages = summarizePreferences(preferences);

  const exclusions = night.games
    .filter((game) => playerCount > 0 && !supportsPlayerCount(game, playerCount))
    .map((game) => ({
      game,
      reason: `${game.title} plays ${game.minPlayers}-${game.maxPlayers}, but ${playerCount} people have joined.`,
    }));

  const rankedGames = night.games
    .filter((game) => playerCount === 0 || supportsPlayerCount(game, playerCount))
    .map((game) => scoreGame(game, averages, preferences, playerCount))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    playerCount,
    maxScore: MAX_SCORE,
    rankedGames,
    exclusions,
    suggestedOrder: buildSuggestedOrder(rankedGames.map((ranked) => ranked.game), playerCount),
    explanation: [
      "Player count is a hard compatibility check against each game minimum and maximum.",
      "Play time is scored against the group average maximum using BGG duration or duration range.",
      "Challenge maps to BGG average weight when available.",
      "Interaction, cooperative-to-competitive feel, and mood are inferred from BGG categories and mechanics.",
    ],
    generatedAt: new Date().toISOString(),
  };
}

function supportsPlayerCount(game: GameCandidate, playerCount: number) {
  return game.minPlayers <= playerCount && game.maxPlayers >= playerCount;
}

function summarizePreferences(preferences: PreferenceSubmission[]) {
  if (preferences.length === 0) {
    return {
      challenge: 3,
      interaction: 3,
      maxPlayTime: 180,
      competition: 3 as CompetitionPreference,
      themes: [] as string[],
      tones: [] as string[],
    };
  }

  const challenge = average(preferences.map((pref) => pref.challenge));
  const interaction = average(preferences.map((pref) => pref.interaction));
  const maxPlayTime = Math.max(30, Math.round(average(preferences.map((pref) => pref.maxPlayTime))));
  const tones = mostCommon(preferences.flatMap((pref) => pref.tones));
  const competition = Math.round(average(preferences.map((pref) => normalizeCompetition(pref.competition)))) as CompetitionPreference;

  return {
    challenge,
    interaction,
    maxPlayTime,
    competition,
    themes: [] as string[],
    tones,
  };
}

function scoreGame(
  game: GameCandidate,
  averages: ReturnType<typeof summarizePreferences>,
  preferences: PreferenceSubmission[],
  playerCount: number,
) {
  const tagText = [...game.categories, ...game.mechanics, game.title].join(" ").toLowerCase();
  const targetWeight = 1 + averages.challenge * 0.75;
  const scoreBreakdown = {
    playerFit: 20,
    timeFit: clamp(25 - Math.max(0, estimatePlayTime(game, playerCount) - averages.maxPlayTime) * 0.35, 0, 25),
    challengeFit: clamp(20 - Math.abs((game.weight ?? targetWeight) - targetWeight) * 6, 0, 20),
    interactionFit: scoreInteraction(tagText, averages.interaction),
    competitionFit: scoreCompetition(tagText, averages.competition),
    toneFit: scoreTones(game, tagText, averages.tones, playerCount),
  };

  const score = Math.round(Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0));
  const reasons = buildReasons(game, scoreBreakdown, averages, preferences.length);

  return { game, score, scoreBreakdown, reasons };
}

function scoreInteraction(tagText: string, target: number) {
  const directInteraction = ["negotiation", "trading", "take that", "area majority", "fighting", "bluffing"].some(
    (word) => tagText.includes(word),
  );
  const indirectInteraction = ["worker placement", "auction", "drafting", "race"].some((word) => tagText.includes(word));
  const interactionLevel = directInteraction ? 5 : indirectInteraction ? 3.5 : 2;
  return clamp(15 - Math.abs(interactionLevel - target) * 3.5, 0, 15);
}

function scoreCompetition(tagText: string, preference: CompetitionPreference) {
  const isCooperative = COOP_WORDS.some((word) => tagText.includes(word));
  const isCompetitive = COMPETITIVE_WORDS.some((word) => tagText.includes(word)) || !isCooperative;
  const gameCompetitionLevel = isCooperative && !isCompetitive ? 1 : isCompetitive && !isCooperative ? 5 : 3;
  return clamp(10 - Math.abs(gameCompetitionLevel - preference) * 2.5, 0, 10);
}

function scoreTones(game: GameCandidate, tagText: string, tones: string[], playerCount: number) {
  if (tones.length === 0) return 8;
  let score = 3;
  if (tones.includes("casual") && estimatePlayTime(game, playerCount) <= 90 && (game.weight ?? 3) <= 2.8) score += 4;
  if (tones.includes("banter") && scoreInteraction(tagText, 5) > 8) score += 4;
  if (tones.includes("crunchy") && (game.weight ?? 0) >= 3.2) score += 4;
  if (tones.includes("cinematic") && (tagText.includes("adventure") || tagText.includes("thematic"))) score += 4;
  if (tones.includes("chaotic") && (tagText.includes("dice") || tagText.includes("take that"))) score += 4;
  return clamp(score, 0, 11);
}

function buildReasons(
  game: GameCandidate,
  scoreBreakdown: Record<string, number>,
  averages: ReturnType<typeof summarizePreferences>,
  submissionCount: number,
) {
  const reasons = [];
  if (scoreBreakdown.playerFit >= 20) reasons.push(`Fits the current ${submissionCount || "open"} player count.`);
  if (scoreBreakdown.timeFit >= 18) reasons.push(`Fits inside the ${averages.maxPlayTime} minute time appetite.`);
  if (scoreBreakdown.challengeFit >= 15) reasons.push(`Its complexity lines up with the requested challenge level.`);
  if (scoreBreakdown.competitionFit >= 8) reasons.push(`Its cooperative/competitive feel matches the group preference.`);
  if (scoreBreakdown.toneFit >= 8) reasons.push(`It has the right night energy for the submitted mood.`);
  if (reasons.length === 0) reasons.push(`${game.title} is compatible, but the match is a compromise.`);
  return reasons.slice(0, 4);
}

function normalizeCompetition(value: CompetitionPreference | LegacyCompetitionPreference) {
  if (typeof value === "number") return value;
  if (value === "cooperative") return 1;
  if (value === "competitive") return 5;
  return 3;
}

function buildSuggestedOrder(games: GameCandidate[], playerCount: number) {
  if (games.length === 0) {
    return ["Add compatible games and at least one player preference submission to get a play plan."];
  }

  const [first, second, third] = games;
  if (estimatePlayTime(first, playerCount) >= 150) {
    return [`Make ${first.title} the main event.`, second ? `Keep ${second.title} as the backup if time collapses.` : ""].filter(
      Boolean,
    );
  }

  if (estimatePlayTime(first, playerCount) <= 45 && second) {
    return [`Open with ${first.title} as a quick table-setter.`, `Then play ${second.title} as the main game.`];
  }

  return [
    `Lead with ${first.title}.`,
    second ? `Use ${second.title} as the alternate if the group wants a different feel.` : "",
    third ? `Keep ${third.title} nearby as the late-night pivot.` : "",
  ].filter(Boolean);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function mostCommon(values: string[]) {
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([value]) => value)
    .slice(0, 4);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
