import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildGameFeatureVector } from "./game-features";
import type {
  FeedbackReason,
  GameCandidate,
  GameNightRecord,
  LearnedPreferenceProfile,
  Participant,
  PostNightFeedback,
  PreferenceSubmission,
} from "./types";

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
    feedback: [],
    learnedProfiles: [],
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

export async function deleteNight(slug: string) {
  if (supabaseConfigured()) {
    const night = await getNight(slug);
    if (!night) return false;

    const { error } = await supabase().from("game_nights").delete().eq("slug", slug);
    if (error) throw new Error(error.message);
    return true;
  }

  if (productionRequiresSupabase()) {
    throw new Error(
      "Production persistence is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel and run supabase/schema.sql.",
    );
  }

  const nights = await readLocalNights();
  if (!nights[slug]) return false;

  delete nights[slug];
  await fs.mkdir(path.dirname(localStorePath), { recursive: true });
  await fs.writeFile(localStorePath, JSON.stringify(nights, null, 2));
  return true;
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
  rememberLearnedProfile(night, input.preference.learnedProfile, participantId);

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
  rememberLearnedProfile(night, input.preference.learnedProfile, participant.id);

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

export async function addFeedback(
  slug: string,
  input: {
    participantId?: string;
    participantName?: string;
    gameCandidateId: string;
    wasPlayed: boolean;
    enjoyment?: 1 | 2 | 3 | 4 | 5;
    wouldPlayAgain?: boolean;
    reasonTags?: FeedbackReason[];
  },
) {
  const night = await getNight(slug);
  if (!night) return null;

  const feedback: PostNightFeedback = {
    id: crypto.randomUUID(),
    nightId: slug,
    participantId: input.participantId,
    participantName: input.participantName?.trim() || undefined,
    gameCandidateId: input.gameCandidateId,
    wasPlayed: input.wasPlayed,
    enjoyment: input.enjoyment,
    wouldPlayAgain: input.wouldPlayAgain,
    reasonTags: input.reasonTags ?? [],
    submittedAt: new Date().toISOString(),
  };
  night.feedback = [...(night.feedback ?? []), feedback];

  const game = night.games.find((candidate) => candidate.id === input.gameCandidateId);
  const learnedProfile = game ? updateLearnedProfile(night, feedback, game) : undefined;

  const savedNight = await saveNight(night);
  return { night: savedNight, feedback, learnedProfile };
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

function rememberLearnedProfile(night: GameNightRecord, learnedProfile: LearnedPreferenceProfile | undefined, participantId: string) {
  if (!learnedProfile) return;

  const profile = { ...learnedProfile, participantKey: participantId };
  night.learnedProfiles = [
    ...(night.learnedProfiles ?? []).filter((item) => item.participantKey !== participantId),
    profile,
  ];
}

function updateLearnedProfile(night: GameNightRecord, feedback: PostNightFeedback, game: GameCandidate) {
  const participantKey = feedback.participantId ?? (feedback.participantName ? normalizeName(feedback.participantName) : undefined);
  if (!participantKey) return undefined;

  const vector = buildGameFeatureVector(game, night.participants.length);
  const existing = night.learnedProfiles?.find((profile) => profile.participantKey === participantKey);
  const sentiment = feedback.wasPlayed
    ? clamp(((feedback.enjoyment ?? 3) - 3) / 2 + (feedback.wouldPlayAgain === true ? 0.25 : feedback.wouldPlayAgain === false ? -0.25 : 0), -1, 1)
    : -0.25;
  const alpha = 0.22;
  const now = new Date().toISOString();
  const next: LearnedPreferenceProfile = {
    participantKey,
    complexityBias: nudge(existing?.complexityBias, sentiment * ((vector.complexity - 3) / 2), alpha),
    interactionBias: nudge(existing?.interactionBias, sentiment * (vector.interaction - 0.5) * 2, alpha),
    conflictTolerance: nudge(existing?.conflictTolerance, sentiment * (vector.conflict - 0.5) * 2, alpha),
    cooperationAffinity: nudge(existing?.cooperationAffinity, sentiment * (vector.cooperation - 0.5) * 2, alpha),
    randomnessAffinity: nudge(existing?.randomnessAffinity, sentiment * (vector.randomness - 0.5) * 2, alpha),
    strategyAffinity: nudge(existing?.strategyAffinity, sentiment * (vector.strategy - 0.5) * 2, alpha),
    narrativeAffinity: nudge(existing?.narrativeAffinity, sentiment * (vector.narrative - 0.5) * 2, alpha),
    preferredDurationMinutes:
      feedback.wasPlayed && feedback.enjoyment && feedback.enjoyment >= 4
        ? Math.round((existing?.preferredDurationMinutes ?? vector.expectedMinutes) * (1 - alpha) + vector.expectedMinutes * alpha)
        : existing?.preferredDurationMinutes,
    updatedAt: now,
  };

  night.learnedProfiles = [
    ...(night.learnedProfiles ?? []).filter((profile) => profile.participantKey !== participantKey),
    next,
  ];
  return next;
}

function nudge(current = 0, signal: number, alpha: number) {
  return Number(clamp(current * (1 - alpha) + signal * alpha, -1, 1).toFixed(3));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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
