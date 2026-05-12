import { z } from "zod";

export const createNightSchema = z.object({
  title: z.string().trim().min(1).max(80),
  eventDate: z.string().optional(),
});

export const gameCandidateInputSchema = z.object({
  bggId: z.number().int().positive().optional(),
  title: z.string().trim().min(1).max(120),
  year: z.number().int().optional(),
  minPlayers: z.number().int().min(1).max(99),
  maxPlayers: z.number().int().min(1).max(99),
  playingTime: z.number().int().min(1).max(600),
  minPlayTime: z.number().int().min(1).max(600).optional(),
  maxPlayTime: z.number().int().min(1).max(600).optional(),
  weight: z.number().min(1).max(5).optional(),
  categories: z.array(z.string()).default([]),
  mechanics: z.array(z.string()).default([]),
  imageUrl: z.string().url().optional(),
  manualOverrides: z.boolean().default(false),
});

export const submissionSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  games: z.array(gameCandidateInputSchema).min(1).max(5),
  preference: z.object({
    challenge: z.number().int().min(1).max(5),
    interaction: z.number().int().min(1).max(5),
    competition: z.enum(["competitive", "cooperative", "either"]),
    themes: z.array(z.string()).max(6),
    tones: z.array(z.string()).max(6),
    maxPlayTime: z.number().int().min(30).max(360),
  }),
});
