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

export const gameCandidateInputSchema = z.object({
  bggId: z.number().int().positive().optional(),
  title: z.string().trim().min(1).max(120),
  year: z.number().int().optional(),
  minPlayers: z.number().int().min(1).max(99),
  maxPlayers: z.number().int().min(1).max(99),
  playTimeMode: z.enum(["fixed", "range", "perPlayer"]).default("fixed"),
  playingTime: z.number().int().min(1).max(600),
  minPlayTime: z.number().int().min(1).max(600).optional(),
  maxPlayTime: z.number().int().min(1).max(600).optional(),
  weight: z.number().min(1).max(5).optional(),
  categories: z.array(z.string()).default([]),
  mechanics: z.array(z.string()).default([]),
  expansions: z.array(bggExpansionSchema).default([]),
  imageUrl: z.string().url().optional(),
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
