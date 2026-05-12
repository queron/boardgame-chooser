import { XMLParser } from "fast-xml-parser";
import type { BggGameDetails, BggSearchResult } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

export async function searchBgg(query: string): Promise<BggSearchResult[]> {
  const url = new URL("https://boardgamegeek.com/xmlapi2/search");
  url.searchParams.set("query", query);
  url.searchParams.set("type", "boardgame");

  const data = await fetchXml(url);
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

  return {
    bggId: Number(item.id),
    title: valueFromNode(primaryName(item.name)) || "Untitled game",
    year: numberFromNode(item.yearpublished),
    minPlayers: numberFromNode(item.minplayers) ?? 1,
    maxPlayers: numberFromNode(item.maxplayers) ?? 99,
    playingTime: numberFromNode(item.playingtime) ?? numberFromNode(item.maxplaytime) ?? 90,
    minPlayTime: numberFromNode(item.minplaytime),
    maxPlayTime: numberFromNode(item.maxplaytime),
    weight: pollAverage ? Number(Number(pollAverage).toFixed(2)) : undefined,
    categories: links.filter((link) => link.type === "boardgamecategory").map((link) => link.value),
    mechanics: links.filter((link) => link.type === "boardgamemechanic").map((link) => link.value),
    imageUrl: typeof item.image === "string" ? item.image : undefined,
  };
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

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
