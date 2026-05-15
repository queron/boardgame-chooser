import { z } from "zod";

export const createNightSchema = z.object({
  title: z.string().trim().min(1).max(80),
  eventDate: z.string().optional(),
});

export const updateNightSchema = createNightSchema;

const bggExpansionSchema = z.object({
  bggId: z.number().int().positive(),
  title: z.string().trim().min(1).max(160),
  year: z.number().int().optional(),
});

const hardAvoidSchema = z.enum(["take_that", "heavy_teach", "direct_conflict", "bluffing", "coop", "downtime"]);
const feedbackReasonSchema = z.enum([
  "too_long",
  "too_heavy",
  "not_interactive",
  "too_conflict_heavy",
  "great_fit",
  "wrong_player_count",
]);
const learnedProfileSchema = z.object({
  participantKey: z.string().trim().min(1).max(120),
  complexityBias: z.number().min(-1).max(1).default(0),
  interactionBias: z.number().min(-1).max(1).default(0),
  conflictTolerance: z.number().min(-1).max(1).default(0),
  cooperationAffinity: z.number().min(-1).max(1).default(0),
  randomnessAffinity: z.number().min(-1).max(1).default(0),
  strategyAffinity: z.number().min(-1).max(1).default(0),
  narrativeAffinity: z.number().min(-1).max(1).default(0),
  preferredDurationMinutes: z.number().int().min(30).max(600).optional(),
  updatedAt: z.string(),
});

const optionalPositiveInteger = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "number" && value < 1 ? undefined : value),
    z.number().int().min(1).max(max).optional(),
  );

export const gameCandidateInputSchema = z.object({
  bggId: optionalPositiveInteger(Number.MAX_SAFE_INTEGER),
  title: z.string().trim().min(1).max(120),
  year: z.number().int().optional(),
  minPlayers: z.number().int().min(1).max(99),
  maxPlayers: z.number().int().min(1).max(99),
  playTimeMode: z.enum(["fixed", "range", "perPlayer"]).default("fixed"),
  playingTime: z.number().int().min(1).max(600),
  minPlayTime: optionalPositiveInteger(600),
  maxPlayTime: optionalPositiveInteger(600),
  weight: z.preprocess(
    (value) => (typeof value === "number" && value < 1 ? undefined : value),
    z.number().min(1).max(5).optional(),
  ),
  categories: z.array(z.string()).default([]),
  mechanics: z.array(z.string()).default([]),
  expansions: z.array(bggExpansionSchema).default([]),
  imageUrl: z.string().url().optional(),
  bggAverageRating: z.number().min(0).max(10).optional(),
  bggBayesAverage: z.number().min(0).max(10).optional(),
  bggUsersRated: z.number().int().min(0).optional(),
  bggWeightVotes: z.number().int().min(0).optional(),
  bggRank: z.number().int().min(1).optional(),
  metadataConfidence: z.number().min(0).max(1).optional(),
  manualOverrides: z.boolean().default(false),
}).refine((game) => game.maxPlayers >= game.minPlayers, {
  message: "Maximum players must be greater than or equal to minimum players.",
  path: ["maxPlayers"],
}).refine((game) => game.playTimeMode !== "range" || (game.minPlayTime && game.maxPlayTime), {
  message: "Range play time needs both a minimum and maximum.",
  path: ["maxPlayTime"],
}).refine((game) => game.playTimeMode !== "range" || !game.minPlayTime || !game.maxPlayTime || game.maxPlayTime >= game.minPlayTime, {
  message: "Maximum play time must be greater than or equal to minimum play time.",
  path: ["maxPlayTime"],
});

const competitionPreferenceSchema = z.union([
  z.number().int().min(1).max(5),
  z.enum(["cooperative", "either", "competitive"]).transform((value) => {
    if (value === "cooperative") return 1;
    if (value === "competitive") return 5;
    return 3;
  }),
]);

const preferenceInputSchema = z.object({
  challenge: z.number().int().min(1).max(5),
  interaction: z.number().int().min(1).max(5),
  competition: competitionPreferenceSchema,
  themes: z.array(z.string()).max(10).default([]),
  tones: z.array(z.string()).max(6),
  maxPlayTime: z.number().int().min(30).max(360),
  timeFlexibility: z.enum(["strict", "flexible"]).default("flexible"),
  hardAvoids: z.array(hardAvoidSchema).max(6).default([]),
  learnedProfile: learnedProfileSchema.optional(),
});

const participantInputSchema = z.object({
  participantId: z.string().uuid().optional(),
  displayName: z.string().trim().min(1).max(60),
});

export const submissionSchema = participantInputSchema.extend({
  games: z.array(gameCandidateInputSchema).max(5).default([]),
  preference: preferenceInputSchema,
});

export const preferenceSubmissionSchema = participantInputSchema.extend({
  preference: preferenceInputSchema,
});

export const gamesSubmissionSchema = z.object({
  games: z.array(gameCandidateInputSchema).min(1).max(5),
});

export const attendeeInputSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
});

export const feedbackSubmissionSchema = z.object({
  participantId: z.string().uuid().optional(),
  participantName: z.string().trim().max(60).optional(),
  gameCandidateId: z.string().uuid(),
  wasPlayed: z.boolean(),
  enjoyment: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  wouldPlayAgain: z.boolean().optional(),
  reasonTags: z.array(feedbackReasonSchema).max(6).default([]),
});
