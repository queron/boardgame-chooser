import { buildGameFeatureVector } from "./game-features";
import { estimatePlayTime } from "./playtime";
import type {
  CompetitionPreference,
  GameCandidate,
  GameFeatureVector,
  GameNightRecord,
  HardAvoid,
  LegacyCompetitionPreference,
  LearnedPreferenceProfile,
  Participant,
  PreferenceSubmission,
  Recommendation,
} from "./types";

const MAX_SCORE = 100;
const NEUTRAL_PREFERENCE: Omit<PreferenceSubmission, "participantId"> = {
  challenge: 3,
  interaction: 3,
  competition: 3,
  themes: [],
  tones: [],
  maxPlayTime: 180,
  timeFlexibility: "flexible",
  hardAvoids: [],
};

type ParticipantPreference = {
  participant: Participant;
  preference: PreferenceSubmission;
};

type UtilityResult = {
  score: number;
  breakdown: Record<string, number>;
  penalties: string[];
};

export function recommendGames(night: GameNightRecord): Recommendation {
  const playerCount = night.participants.length;
  const participants = resolveParticipantPreferences(night);

  const exclusions = night.games
    .filter((game) => playerCount > 0 && !supportsPlayerCount(game, playerCount))
    .map((game) => ({
      game,
      reason: `${game.title} plays ${game.minPlayers}-${game.maxPlayers}, but ${playerCount} people have joined.`,
    }));

  const rankedGames = night.games
    .filter((game) => playerCount === 0 || supportsPlayerCount(game, playerCount))
    .map((game) => scoreGame(game, participants, playerCount))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    playerCount,
    maxScore: MAX_SCORE,
    rankedGames,
    exclusions,
    suggestedOrder: buildSuggestedOrder(rankedGames.map((ranked) => ranked.game), playerCount),
    explanation: [
      "Player count remains a hard compatibility check against each game's minimum and maximum.",
      "Each attendee is scored separately, then the group score rewards broad appeal and penalizes poor individual fit.",
      "BGG categories and mechanics are normalized into interaction, conflict, cooperation, randomness, strategy, narrative, and party-energy signals.",
      "Hard avoids and strict time limits apply participant-specific penalties instead of being averaged away.",
      "BGG metadata confidence and any learned preference profile only make small adjustments; they do not override the submitted vibe.",
    ],
    generatedAt: new Date().toISOString(),
  };
}

export function supportsPlayerCount(game: GameCandidate, playerCount: number) {
  return game.minPlayers <= playerCount && game.maxPlayers >= playerCount;
}

function resolveParticipantPreferences(night: GameNightRecord): ParticipantPreference[] {
  if (night.participants.length === 0) {
    return [
      {
        participant: {
          id: "open-table",
          displayName: "Open table",
          nightId: night.slug,
          submittedAt: night.createdAt,
        },
        preference: { ...NEUTRAL_PREFERENCE, participantId: "open-table" },
      },
    ];
  }

  return night.participants.map((participant) => {
    const preference = night.preferences.find((item) => item.participantId === participant.id);
    const learnedProfile =
      preference?.learnedProfile ?? night.learnedProfiles?.find((profile) => profile.participantKey === participant.id);
    return {
      participant,
      preference: {
        ...NEUTRAL_PREFERENCE,
        ...preference,
        participantId: participant.id,
        competition: normalizeCompetition(preference?.competition ?? NEUTRAL_PREFERENCE.competition),
        themes: preference?.themes ?? [],
        tones: preference?.tones ?? [],
        timeFlexibility: preference?.timeFlexibility ?? "flexible",
        hardAvoids: preference?.hardAvoids ?? [],
        ...(learnedProfile ? { learnedProfile } : {}),
      },
    };
  });
}

function scoreGame(game: GameCandidate, participants: ParticipantPreference[], playerCount: number) {
  const vector = buildGameFeatureVector(game, playerCount);
  const utilities = participants.map((entry) => ({
    participant: entry.participant,
    utility: scoreParticipantUtility(entry.preference, vector),
  }));
  const utilityScores = utilities.map((item) => item.utility.score);
  const meanScore = average(utilityScores);
  const p25 = percentile(utilityScores, 0.25);
  const minScore = Math.min(...utilityScores);
  const spread = standardDeviation(utilityScores);
  const groupScore = clamp(0.6 * meanScore + 0.25 * p25 + 0.1 * minScore + 5 * vector.confidence - 0.1 * spread, 0, MAX_SCORE);
  const scoreBreakdown = averageBreakdowns(utilities.map((item) => item.utility.breakdown));

  return {
    game,
    score: Math.round(groupScore),
    scoreBreakdown,
    reasons: buildReasons(game, vector, scoreBreakdown, utilities),
    participantScores: utilities.map(({ participant, utility }) => ({
      participantId: participant.id,
      displayName: participant.displayName,
      score: Math.round(utility.score),
      penalties: utility.penalties,
    })),
  };
}

function scoreParticipantUtility(
  preference: PreferenceSubmission,
  vector: GameFeatureVector,
): UtilityResult {
  const competition = normalizeCompetition(preference.competition);
  const learned = preference.learnedProfile;
  const targetComplexity = clamp(1 + preference.challenge * 0.8 + (learned?.complexityBias ?? 0), 1, 5);
  const targetInteraction = clamp01((preference.interaction - 1) / 4 + 0.12 * (learned?.interactionBias ?? 0));
  const targetCompetition = clamp01((competition - 1) / 4);
  const targetMinutes = learned?.preferredDurationMinutes
    ? Math.round((preference.maxPlayTime * 3 + learned.preferredDurationMinutes) / 4)
    : preference.maxPlayTime;

  const playerFit = 20;
  const timeFit = scoreTime(vector.expectedMinutes, targetMinutes, preference.timeFlexibility ?? "flexible");
  const complexityFit = 14 * gaussianFit(vector.complexity, targetComplexity, 1.05);
  const interactionFit = 12 * (1 - Math.abs(vector.interaction - targetInteraction));
  const competitionLevel = vector.cooperation >= 0.65 && vector.conflict < 0.4 ? 0 : vector.conflict >= 0.55 ? 1 : 0.5;
  const competitionFit = 10 * (1 - Math.abs(competitionLevel - targetCompetition));
  const moodFit = 18 * scoreMood(preference, vector, learned);
  const themeFit = 6 * scoreThemes(preference.themes, vector.themeTags);
  const confidenceFit = 4 * clamp01(vector.qualityPrior * 0.6 + vector.confidence * 0.4);
  const avoidPenalty = scoreHardAvoidPenalties(preference.hardAvoids ?? [], vector);

  const rawScore =
    playerFit + timeFit + complexityFit + interactionFit + competitionFit + moodFit + themeFit + confidenceFit - avoidPenalty.total;

  return {
    score: clamp(rawScore, 0, MAX_SCORE),
    breakdown: {
      playerFit,
      timeFit,
      challengeFit: complexityFit,
      interactionFit,
      competitionFit,
      moodFit,
      themeFit,
      confidenceFit,
      penalty: -avoidPenalty.total,
    },
    penalties: avoidPenalty.reasons,
  };
}

function scoreTime(expectedMinutes: number, maxPlayTime: number, flexibility: PreferenceSubmission["timeFlexibility"]) {
  if (expectedMinutes <= maxPlayTime) {
    const tooShortPenalty = expectedMinutes < 0.35 * maxPlayTime ? 2 : 0;
    return clamp(16 - tooShortPenalty, 0, 16);
  }

  const overage = expectedMinutes - maxPlayTime;
  const tolerance = flexibility === "strict" ? Math.max(15, maxPlayTime * 0.12) : Math.max(30, maxPlayTime * 0.28);
  return clamp(16 * Math.exp(-(overage * overage) / (2 * tolerance * tolerance)), 0, 16);
}

function scoreMood(preference: PreferenceSubmission, vector: GameFeatureVector, learned?: LearnedPreferenceProfile) {
  const tones = preference.tones ?? [];
  if (tones.length === 0 && !learned) return 0.65;

  const desired: Record<string, number> = {
    casual: clamp01((1 - vector.teachBurden) * 0.55 + (1 - vector.complexity / 5) * 0.35 + vector.partyEnergy * 0.1),
    banter: clamp01(vector.interaction * 0.65 + vector.partyEnergy * 0.35),
    crunchy: clamp01(vector.strategy * 0.55 + vector.complexity / 5 * 0.45),
    cinematic: clamp01(vector.narrative * 0.75 + vector.randomness * 0.25),
    chaotic: clamp01(vector.randomness * 0.7 + vector.conflict * 0.2 + vector.partyEnergy * 0.1),
    strategic: clamp01(vector.strategy * 0.75 + vector.complexity / 5 * 0.25),
    tactical: clamp01(vector.conflict * 0.55 + vector.strategy * 0.45),
    cooperative: clamp01(vector.cooperation * 0.8 + vector.interaction * 0.2),
  };

  const submittedScore =
    tones.length > 0 ? average(tones.map((tone) => desired[tone] ?? 0.5)) : 0.65;
  const learnedAdjustment = learned
    ? 0.08 *
      ((learned.conflictTolerance ?? 0) * vector.conflict +
        (learned.cooperationAffinity ?? 0) * vector.cooperation +
        (learned.randomnessAffinity ?? 0) * vector.randomness +
        (learned.strategyAffinity ?? 0) * vector.strategy +
        (learned.narrativeAffinity ?? 0) * vector.narrative)
    : 0;
  return clamp01(submittedScore + learnedAdjustment);
}

function scoreThemes(themes: string[], themeTags: string[]) {
  if (!themes.length) return 0.5;
  const selected = new Set(themes.map(normalizeText));
  const available = new Set(themeTags.map(normalizeText));
  const matches = [...selected].filter((theme) => available.has(theme)).length;
  return clamp01(matches / Math.max(selected.size, 1));
}

function scoreHardAvoidPenalties(avoids: HardAvoid[], vector: GameFeatureVector) {
  const reasons: string[] = [];
  let total = 0;
  const add = (condition: boolean, amount: number, reason: string) => {
    if (!condition) return;
    total += amount;
    reasons.push(reason);
  };

  add(avoids.includes("take_that") && vector.conflict >= 0.65 && vector.interaction >= 0.45, 14, "includes take-that style conflict");
  add(avoids.includes("heavy_teach") && vector.teachBurden >= 0.65, 12, "looks like a heavier teach");
  add(avoids.includes("direct_conflict") && vector.conflict >= 0.55, 12, "leans into direct conflict");
  add(avoids.includes("bluffing") && vector.interaction >= 0.7 && vector.conflict >= 0.35, 8, "may involve bluffing or hidden intent");
  add(avoids.includes("coop") && vector.cooperation >= 0.65, 10, "is strongly cooperative");
  add(avoids.includes("downtime") && vector.expectedMinutes >= 150 && vector.interaction < 0.55, 8, "may create downtime at this length");

  return { total: Math.min(total, 35), reasons };
}

function buildReasons(
  game: GameCandidate,
  vector: GameFeatureVector,
  scoreBreakdown: Record<string, number>,
  utilities: { participant: Participant; utility: UtilityResult }[],
) {
  const reasons = [];
  if (scoreBreakdown.playerFit >= 20) reasons.push(`Fits the current ${utilities.length} player count.`);
  if (scoreBreakdown.timeFit >= 12) reasons.push(`Fits the submitted time appetite.`);
  if (scoreBreakdown.challengeFit >= 10) reasons.push(`Its complexity lines up with the requested challenge level.`);
  if (scoreBreakdown.interactionFit >= 8) reasons.push(`Its interaction level matches the group's table energy.`);
  if (scoreBreakdown.competitionFit >= 7) reasons.push(`Its cooperative-to-competitive feel is in range.`);
  if (scoreBreakdown.themeFit >= 3.5) reasons.push(`It matches selected theme interest from the current game pool.`);
  if (scoreBreakdown.confidenceFit >= 2.5 && vector.confidence >= 0.7) reasons.push(`BGG metadata confidence is strong enough to trust the fit.`);

  const lowFits = utilities.filter((item) => item.utility.score < 55);
  if (lowFits.length > 0) {
    reasons.push(`Compromise note: ${lowFits.map((item) => item.participant.displayName).join(", ")} may be less aligned.`);
  }
  const penalties = utilities.flatMap((item) => item.utility.penalties.map((penalty) => `${item.participant.displayName}: ${penalty}`));
  if (penalties.length > 0) reasons.push(`Avoids checked: ${penalties.slice(0, 2).join("; ")}.`);

  if (reasons.length === 0) reasons.push(`${game.title} is compatible, but the match is a compromise.`);
  return reasons.slice(0, 4);
}

function normalizeCompetition(value: CompetitionPreference | LegacyCompetitionPreference) {
  if (typeof value === "number") return clamp(Math.round(value), 1, 5) as CompetitionPreference;
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

function averageBreakdowns(breakdowns: Record<string, number>[]) {
  const keys = new Set(breakdowns.flatMap((breakdown) => Object.keys(breakdown)));
  return Object.fromEntries(
    [...keys].map((key) => [key, average(breakdowns.map((breakdown) => breakdown[key] ?? 0))]),
  );
}

function percentile(values: number[], quantile: number) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * quantile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function standardDeviation(values: number[]) {
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function gaussianFit(value: number, target: number, sigma: number) {
  return Math.exp(-((value - target) ** 2) / (2 * sigma * sigma));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase();
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
