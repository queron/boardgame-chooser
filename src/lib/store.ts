import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { GameCandidate, GameNightRecord, PreferenceSubmission } from "./types";

const localStorePath = path.join(process.cwd(), ".local-data", "game-nights.json");

type StoredNights = Record<string, GameNightRecord>;

function supabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export async function createNight(input: { title: string; eventDate?: string }) {
  const now = new Date().toISOString();
  const night: GameNightRecord = {
    slug: await uniqueSlug(),
    title: input.title.trim() || "Board game night",
    eventDate: input.eventDate || undefined,
    status: "open",
    createdAt: now,
    updatedAt: now,
    participants: [],
    games: [],
    preferences: [],
  };

  await saveNight(night);
  return night;
}

export async function getNight(slug: string) {
  if (supabaseConfigured()) {
    const { data, error } = await supabase().from("game_nights").select("payload").eq("slug", slug).single();
    if (error || !data) return null;
    return data.payload as GameNightRecord;
  }

  const nights = await readLocalNights();
  return nights[slug] ?? null;
}

export async function saveNight(night: GameNightRecord) {
  const updatedNight = { ...night, updatedAt: new Date().toISOString() };

  if (supabaseConfigured()) {
    const { error } = await supabase()
      .from("game_nights")
      .upsert({ slug: updatedNight.slug, payload: updatedNight, updated_at: updatedNight.updatedAt });
    if (error) throw new Error(error.message);
    return updatedNight;
  }

  const nights = await readLocalNights();
  nights[updatedNight.slug] = updatedNight;
  await fs.mkdir(path.dirname(localStorePath), { recursive: true });
  await fs.writeFile(localStorePath, JSON.stringify(nights, null, 2));
  return updatedNight;
}

export async function addSubmission(
  slug: string,
  input: {
    displayName: string;
    games: Omit<GameCandidate, "id" | "submittedBy">[];
    preference: Omit<PreferenceSubmission, "participantId">;
  },
) {
  const night = await getNight(slug);
  if (!night) return null;

  const participantId = crypto.randomUUID();
  const submittedAt = new Date().toISOString();
  const participant = {
    id: participantId,
    displayName: input.displayName.trim(),
    nightId: slug,
    submittedAt,
  };

  night.participants = [...night.participants, participant];
  night.games = [
    ...night.games,
    ...input.games.map((game) => ({
      ...game,
      id: crypto.randomUUID(),
      submittedBy: participantId,
      categories: game.categories ?? [],
      mechanics: game.mechanics ?? [],
    })),
  ];
  night.preferences = [...night.preferences, { ...input.preference, participantId }];

  return saveNight(night);
}

async function uniqueSlug() {
  let slug = makeSlug();
  while (await getNight(slug)) {
    slug = makeSlug();
  }
  return slug;
}

function makeSlug() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

async function readLocalNights(): Promise<StoredNights> {
  try {
    const content = await fs.readFile(localStorePath, "utf8");
    return JSON.parse(content) as StoredNights;
  } catch {
    return {};
  }
}
