import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { GameCandidate, GameNightRecord, Participant, PreferenceSubmission } from "./types";

const localStorePath = path.join(process.cwd(), ".local-data", "game-nights.json");

type StoredNights = Record<string, GameNightRecord>;

function supabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function productionRequiresSupabase() {
  return process.env.NODE_ENV === "production" && !supabaseConfigured();
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

  if (productionRequiresSupabase()) {
    return null;
  }

  const nights = await readLocalNights();
  return nights[slug] ?? null;
}

export async function listNights() {
  if (supabaseConfigured()) {
    const { data, error } = await supabase()
      .from("game_nights")
      .select("payload")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return data.map((row) => row.payload as GameNightRecord);
  }

  if (productionRequiresSupabase()) {
    return [];
  }

  const nights = await readLocalNights();
  return Object.values(nights).sort((a, b) => newestDate(b).localeCompare(newestDate(a)));
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

  if (productionRequiresSupabase()) {
    throw new Error(
      "Production persistence is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel and run supabase/schema.sql.",
    );
  }

  const nights = await readLocalNights();
  nights[updatedNight.slug] = updatedNight;
  await fs.mkdir(path.dirname(localStorePath), { recursive: true });
  await fs.writeFile(localStorePath, JSON.stringify(nights, null, 2));
  return updatedNight;
}

export async function updateNightDetails(slug: string, input: { title: string; eventDate?: string }) {
  const night = await getNight(slug);
  if (!night) return null;

  const savedNight = await saveNight({
    ...night,
    title: input.title.trim() || "Board game night",
    eventDate: input.eventDate || undefined,
  });

  return savedNight;
}

export async function addAttendee(slug: string, input: { displayName: string }) {
  const night = await getNight(slug);
  if (!night) return null;

  const normalizedDisplayName = normalizeName(input.displayName);
  const existingParticipant = night.participants.find(
    (participant) => normalizeName(participant.displayName) === normalizedDisplayName,
  );

  if (existingParticipant) {
    return { night, participant: existingParticipant };
  }

  const participant: Participant = {
    id: crypto.randomUUID(),
    displayName: input.displayName.trim(),
    nightId: slug,
    submittedAt: new Date().toISOString(),
  };

  night.participants = [...night.participants, participant];
  const savedNight = await saveNight(night);
  return { night: savedNight, participant };
}

export async function addSubmission(
  slug: string,
  input: {
    participantId?: string;
    displayName: string;
    games: Omit<GameCandidate, "id" | "submittedBy">[];
    preference: Omit<PreferenceSubmission, "participantId">;
  },
) {
  const night = await getNight(slug);
  if (!night) return null;

  const normalizedDisplayName = normalizeName(input.displayName);
  const existingParticipant = night.participants.find(
    (participant) =>
      participant.id === input.participantId ||
      normalizeName(participant.displayName) === normalizedDisplayName,
  );
  const participantId = existingParticipant?.id ?? crypto.randomUUID();
  const submittedAt = new Date().toISOString();
  const participant = {
    id: participantId,
    displayName: input.displayName.trim(),
    nightId: slug,
    submittedAt,
  };

  night.participants = existingParticipant
    ? night.participants.map((current) => (current.id === participantId ? participant : current))
    : [...night.participants, participant];
  night.games = night.games.filter((game) => game.submittedBy !== participantId);
  night.games = [
    ...night.games,
    ...input.games.map((game) => ({
      ...game,
      id: crypto.randomUUID(),
      submittedBy: participantId,
      playTimeMode: game.playTimeMode ?? "fixed",
      categories: game.categories ?? [],
      mechanics: game.mechanics ?? [],
      expansions: game.expansions ?? [],
    })),
  ];
  night.preferences = [
    ...night.preferences.filter((preference) => preference.participantId !== participantId),
    { ...input.preference, participantId },
  ];

  const savedNight = await saveNight(night);
  return { night: savedNight, participant };
}

export async function savePreference(
  slug: string,
  input: {
    participantId?: string;
    displayName: string;
    preference: Omit<PreferenceSubmission, "participantId">;
  },
) {
  const night = await getNight(slug);
  if (!night) return null;

  const participant = upsertParticipant(night, slug, input.participantId, input.displayName);
  night.preferences = [
    ...night.preferences.filter((preference) => preference.participantId !== participant.id),
    { ...input.preference, participantId: participant.id },
  ];

  const savedNight = await saveNight(night);
  return { night: savedNight, participant };
}

export async function saveGames(
  slug: string,
  input: {
    games: Omit<GameCandidate, "id" | "submittedBy">[];
  },
) {
  const night = await getNight(slug);
  if (!night) return null;

  night.games = input.games.map((game) => ({
    ...game,
    id: crypto.randomUUID(),
    playTimeMode: game.playTimeMode ?? "fixed",
    categories: game.categories ?? [],
    mechanics: game.mechanics ?? [],
    expansions: game.expansions ?? [],
  }));

  const savedNight = await saveNight(night);
  return { night: savedNight };
}

function upsertParticipant(
  night: GameNightRecord,
  slug: string,
  participantId: string | undefined,
  displayName: string,
) {
  const normalizedDisplayName = normalizeName(displayName);
  const existingParticipant = night.participants.find(
    (participant) =>
      participant.id === participantId ||
      normalizeName(participant.displayName) === normalizedDisplayName,
  );
  const id = existingParticipant?.id ?? crypto.randomUUID();
  const participant: Participant = {
    id,
    displayName: displayName.trim(),
    nightId: slug,
    submittedAt: new Date().toISOString(),
  };

  night.participants = existingParticipant
    ? night.participants.map((current) => (current.id === id ? participant : current))
    : [...night.participants, participant];

  return participant;
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase();
}

function newestDate(night: GameNightRecord) {
  return night.eventDate || night.updatedAt || night.createdAt;
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
