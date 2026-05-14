import { XMLParser } from "fast-xml-parser";
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
  const url = new URL("https://boardgamegeek.com/xmlapi2/thing");
  url.searchParams.set("id", String(id));
  url.searchParams.set("type", "boardgame");
  url.searchParams.set("stats", "1");

  const data = await fetchXml(url);
  const item = asArray(data.items?.item)[0];
  if (!item) return null;

  const links = asArray(item.link);
  const pollAverage = item.statistics?.ratings?.averageweight?.value;

  const minPlayTime = positiveNumberFromNode(item.minplaytime);
  const maxPlayTime = positiveNumberFromNode(item.maxplaytime);
  const playingTime = positiveNumberFromNode(item.playingtime) ?? maxPlayTime ?? minPlayTime ?? 90;
  const weight = Number(pollAverage);

  return {
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
  };
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

function positiveNumberFromNode(node: unknown) {
  const number = numberFromNode(node);
  return number && number > 0 ? number : undefined;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
