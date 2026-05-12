import type {
  CompetitionPreference,
  GameCandidate,
  GameNightRecord,
  PreferenceSubmission,
  Recommendation,
} from "./types";

const THEME_KEYWORDS: Record<string, string[]> = {
  adventure: ["adventure", "exploration", "maze", "travel"],
  fantasy: ["fantasy", "mythology", "myth", "medieval", "arabian"],
  sciFi: ["science fiction", "video game theme", "electronic"],
  space: ["space exploration", "space", "science fiction"],
  pirate: ["pirates", "nautical", "exploration"],
  horror: ["horror", "zombies", "murder", "mystery", "mafia", "spies", "secret agents"],
  ancient: ["ancient", "medieval", "renaissance", "mythology", "religious"],
  modernHistory: [
    "historical",
    "age of reason",
    "american west",
    "napoleonic",
    "post-napoleonic",
    "pike and shot",
    "world war i",
    "world war ii",
    "vietnam war",
    "modern warfare",
  ],
  civilization: ["civilization", "territory building", "political", "city building"],
  economic: ["economic", "industry", "manufacturing", "negotiation", "political"],
  cityBuilding: ["city building", "territory building", "environmental"],
  trainsTransport: ["trains", "transportation", "travel", "aviation", "flight"],
  nature: ["animals", "environmental", "farming", "medical", "prehistoric"],
  wargame: [
    "wargame",
    "civil war",
    "american civil war",
    "american revolutionary war",
    "korean war",
    "napoleonic",
    "world war i",
    "world war ii",
    "modern warfare",
  ],
  party: ["party game", "humor", "bluffing", "trivia", "word game", "music"],
  puzzle: ["puzzle", "abstract strategy", "abstract", "deduction", "math", "memory", "number"],
  racingSports: ["racing", "sports", "real-time", "action", "dexterity"],
  popCulture: ["movies", "tv", "radio theme", "comic book", "strip", "novel-based", "video game theme"],
};

const COOP_WORDS = ["cooperative game", "solo / solitaire game"];
const COMPETITIVE_WORDS = ["area majority", "auction", "betting", "economic", "fighting", "negotiation"];

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
    .map((game) => scoreGame(game, averages, preferences))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    playerCount,
    rankedGames,
    exclusions,
    suggestedOrder: buildSuggestedOrder(rankedGames.map((ranked) => ranked.game)),
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
      competition: "either" as CompetitionPreference,
      themes: [] as string[],
      tones: [] as string[],
    };
  }

  const count = preferences.length;
  const challenge = average(preferences.map((pref) => pref.challenge));
  const interaction = average(preferences.map((pref) => pref.interaction));
  const maxPlayTime = Math.max(30, Math.round(average(preferences.map((pref) => pref.maxPlayTime))));
  const themes = mostCommon(preferences.flatMap((pref) => pref.themes));
  const tones = mostCommon(preferences.flatMap((pref) => pref.tones));
  const cooperativeVotes = preferences.filter((pref) => pref.competition === "cooperative").length;
  const competitiveVotes = preferences.filter((pref) => pref.competition === "competitive").length;
  const competition: CompetitionPreference =
    cooperativeVotes > count / 2 ? "cooperative" : competitiveVotes > count / 2 ? "competitive" : "either";

  return {
    challenge,
    interaction,
    maxPlayTime,
    competition,
    themes,
    tones,
  };
}

function scoreGame(
  game: GameCandidate,
  averages: ReturnType<typeof summarizePreferences>,
  preferences: PreferenceSubmission[],
) {
  const tagText = [...game.categories, ...game.mechanics, game.title].join(" ").toLowerCase();
  const targetWeight = 1 + averages.challenge * 0.75;
  const scoreBreakdown = {
    playerFit: 20,
    timeFit: clamp(25 - Math.max(0, game.playingTime - averages.maxPlayTime) * 0.35, 0, 25),
    challengeFit: clamp(20 - Math.abs((game.weight ?? targetWeight) - targetWeight) * 6, 0, 20),
    interactionFit: scoreInteraction(tagText, averages.interaction),
    competitionFit: scoreCompetition(tagText, averages.competition),
    themeFit: scoreThemes(tagText, averages.themes),
    toneFit: scoreTones(game, tagText, averages.tones),
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
  if (preference === "either") return 10;
  const isCooperative = COOP_WORDS.some((word) => tagText.includes(word));
  const isCompetitive = COMPETITIVE_WORDS.some((word) => tagText.includes(word)) || !isCooperative;
  if (preference === "cooperative") return isCooperative ? 10 : 4;
  return isCompetitive ? 10 : 5;
}

function scoreThemes(tagText: string, themes: string[]) {
  if (themes.length === 0) return 8;
  const hits = themes.filter((theme) => THEME_KEYWORDS[theme]?.some((word) => tagText.includes(word)));
  return clamp(4 + hits.length * 5, 0, 14);
}

function scoreTones(game: GameCandidate, tagText: string, tones: string[]) {
  if (tones.length === 0) return 8;
  let score = 3;
  if (tones.includes("casual") && game.playingTime <= 90 && (game.weight ?? 3) <= 2.8) score += 4;
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
  if (scoreBreakdown.themeFit >= 9) reasons.push(`Its tags match the group theme appetite.`);
  if (scoreBreakdown.toneFit >= 8) reasons.push(`It has the right night energy for the submitted mood.`);
  if (reasons.length === 0) reasons.push(`${game.title} is compatible, but the match is a compromise.`);
  return reasons.slice(0, 4);
}

function buildSuggestedOrder(games: GameCandidate[]) {
  if (games.length === 0) {
    return ["Add compatible games and at least one player preference submission to get a play plan."];
  }

  const [first, second, third] = games;
  if (first.playingTime >= 150) {
    return [`Make ${first.title} the main event.`, second ? `Keep ${second.title} as the backup if time collapses.` : ""].filter(
      Boolean,
    );
  }

  if (first.playingTime <= 45 && second) {
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
