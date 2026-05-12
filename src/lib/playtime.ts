import type { GameCandidate } from "./types";

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export function estimatePlayTime(
  game: Pick<GameCandidate, "playingTime" | "minPlayTime" | "maxPlayTime" | "minPlayers" | "maxPlayers" | "playTimeMode">,
  playerCount?: number,
) {
  if (game.playTimeMode === "perPlayer") {
    return Math.round(game.playingTime * (playerCount ?? Math.max(game.minPlayers, Math.ceil(game.maxPlayers / 2))));
  }

  if (game.playTimeMode === "range" && game.minPlayTime && game.maxPlayTime) {
    return Math.round((game.minPlayTime + game.maxPlayTime) / 2);
  }

  return game.playingTime;
}

export function formatPlayTime(game: Pick<GameCandidate, "playingTime" | "minPlayTime" | "maxPlayTime" | "playTimeMode">) {
  if (game.playTimeMode === "perPlayer") {
    return `${formatMinutes(game.playingTime)} / player`;
  }

  if (game.playTimeMode === "range" && game.minPlayTime && game.maxPlayTime && game.minPlayTime !== game.maxPlayTime) {
    return `${formatMinutes(game.minPlayTime)}-${formatMinutes(game.maxPlayTime)}`;
  }

  return formatMinutes(game.playingTime);
}
