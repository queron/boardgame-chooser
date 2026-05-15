import { XMLParser } from "fast-xml-parser";
import { createClient } from "@supabase/supabase-js";
import { calculateMetadataConfidence } from "./game-features";
import type { BggGameDetails, BggSearchResult } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

type BggXmlSearchData = {
  items?: {
    item?: BggXmlNode | BggXmlNode[];
  };
};

type BggXmlNode = Record<string, unknown>;

export async function searchBgg(query: string): Promise<BggSearchResult[]> {
  const [exactData, broadData] = await Promise.all([fetchSearch(query, true), fetchSearch(query, false)]);
  const results = [...parseSearchResults(exactData), ...parseSearchResults(broadData)];
  return Array.from(new Map(results.map((result) => [result.bggId, result])).values()).slice(0, 8);
}

async function fetchSearch(query: string, exact: boolean) {
  const url = new URL("https://boardgamegeek.com/xmlapi2/search");
  url.searchParams.set("query", query);
  url.searchParams.set("type", "boardgame");
  if (exact) url.searchParams.set("exact", "1");

  return fetchXml(url);
}

function parseSearchResults(data: BggXmlSearchData): BggSearchResult[] {
  return asArray(data.items?.item)
    .slice(0, 8)
    .map((item) => ({
      bggId: Number(item.id),
      title: valueFromNode(primaryName(item.name)) || "Untitled game",
      year: numberFromNode(item.yearpublished),
    }))
    .filter((item) => Number.isFinite(item.bggId));
}

export async function getBggGame(id: number): Promise<BggGameDetails | null> {
  const cached = await getCachedBggGame(id);
  if (cached) return cached;

  const url = new URL("https://boardgamegeek.com/xmlapi2/thing");
  url.searchParams.set("id", String(id));
  url.searchParams.set("type", "boardgame");
  url.searchParams.set("stats", "1");

  const data = await fetchXml(url);
  const item = asArray(data.items?.item)[0];
  if (!item) return null;

  const links = asArray(item.link);
  const ratings = isXmlNode(item.statistics) && isXmlNode(item.statistics.ratings) ? item.statistics.ratings : {};
  const pollAverage = ratings.averageweight?.value;

  const minPlayTime = positiveNumberFromNode(item.minplaytime);
  const maxPlayTime = positiveNumberFromNode(item.maxplaytime);
  const playingTime = positiveNumberFromNode(item.playingtime) ?? maxPlayTime ?? minPlayTime ?? 90;
  const weight = Number(pollAverage);

  const bggAverageRating = finiteNumber(ratings.average?.value);
  const bggBayesAverage = finiteNumber(ratings.bayesaverage?.value);
  const bggUsersRated = finiteNumber(ratings.usersrated?.value);
  const bggWeightVotes = finiteNumber(ratings.numweights?.value);
  const bggRank = parseBoardGameRank(ratings.ranks);
  const game = {
    bggId: Number(item.id),
    title: valueFromNode(primaryName(item.name)) || "Untitled game",
    year: numberFromNode(item.yearpublished),
    minPlayers: positiveNumberFromNode(item.minplayers) ?? 1,
    maxPlayers: positiveNumberFromNode(item.maxplayers) ?? 99,
    playTimeMode: minPlayTime && maxPlayTime && minPlayTime !== maxPlayTime ? "range" : "fixed",
    playingTime,
    minPlayTime,
    maxPlayTime,
    weight: Number.isFinite(weight) && weight >= 1 ? Number(weight.toFixed(2)) : undefined,
    categories: linkValues(links, "boardgamecategory"),
    mechanics: linkValues(links, "boardgamemechanic"),
    expansions: expansionLinks(links),
    imageUrl: typeof item.image === "string" ? item.image : undefined,
    ...(bggAverageRating !== undefined ? { bggAverageRating: Number(bggAverageRating.toFixed(2)) } : {}),
    ...(bggBayesAverage !== undefined ? { bggBayesAverage: Number(bggBayesAverage.toFixed(2)) } : {}),
    ...(bggUsersRated !== undefined ? { bggUsersRated: Math.round(bggUsersRated) } : {}),
    ...(bggWeightVotes !== undefined ? { bggWeightVotes: Math.round(bggWeightVotes) } : {}),
    ...(bggRank !== undefined ? { bggRank } : {}),
  } satisfies BggGameDetails;

  const gameWithConfidence = {
    ...game,
    metadataConfidence: calculateMetadataConfidence(game),
  };
  await saveCachedBggGame(gameWithConfidence);
  return gameWithConfidence;
}

function linkValues(links: Record<string, unknown>[], type: string) {
  return links
    .filter((link) => link.type === type && typeof link.value === "string")
    .map((link) => String(link.value));
}

function expansionLinks(links: Record<string, unknown>[]) {
  const expansions = links
    .filter((link) => link.type === "boardgameexpansion")
    .map((link) => ({
      bggId: Number(link.id),
      title: typeof link.value === "string" ? link.value : "Untitled expansion",
    }))
    .filter((link) => Number.isFinite(link.bggId) && link.bggId > 0);

  return Array.from(new Map(expansions.map((expansion) => [expansion.bggId, expansion])).values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  );
}

async function fetchXml(url: URL) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "boardgame-chooser/0.1 contact: local-development",
      ...(process.env.BGG_APP_TOKEN ? { Authorization: `Bearer ${process.env.BGG_APP_TOKEN}` } : {}),
    },
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    throw new Error(`BoardGameGeek responded with ${response.status}`);
  }

  return parser.parse(await response.text());
}

function supabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

async function getCachedBggGame(id: number) {
  if (!supabaseConfigured()) return null;

  try {
    const { data, error } = await supabase()
      .from("bgg_games_cache")
      .select("normalized_json")
      .eq("bgg_id", id)
      .maybeSingle();
    if (error || !data?.normalized_json) return null;
    return data.normalized_json as BggGameDetails;
  } catch {
    return null;
  }
}

async function saveCachedBggGame(game: BggGameDetails) {
  if (!supabaseConfigured()) return;

  try {
    await supabase().from("bgg_games_cache").upsert({
      bgg_id: game.bggId,
      title: game.title,
      year: game.year ?? null,
      normalized_json: game,
      refreshed_at: new Date().toISOString(),
      source_version: "algorithm-2.0",
    });
  } catch {
    // Cache writes must not break the user-facing lookup flow.
  }
}

function primaryName(name: unknown) {
  const names = asArray(name);
  return names.find((entry) => isXmlNode(entry) && entry.type === "primary") ?? names[0];
}

function valueFromNode(node: unknown) {
  if (!node) return undefined;
  if (typeof node === "string") return node;
  if (isXmlNode(node) && "value" in node) return String(node.value);
  return undefined;
}

function isXmlNode(node: unknown): node is Record<string, unknown> {
  return Boolean(node && typeof node === "object");
}

function numberFromNode(node: unknown) {
  const value = valueFromNode(node);
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function parseBoardGameRank(ranks: unknown) {
  if (!isXmlNode(ranks)) return undefined;
  const rank = asArray(ranks.rank).find(
    (entry) => isXmlNode(entry) && entry.name === "boardgame" && finiteNumber(entry.value) !== undefined,
  );
  return isXmlNode(rank) ? finiteNumber(rank.value) : undefined;
}

function positiveNumberFromNode(node: unknown) {
  const number = numberFromNode(node);
  return number && number > 0 ? number : undefined;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
