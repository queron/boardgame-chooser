import type { GameNightRecord } from "./types";
import { recommendGames } from "./recommendation";

export type RecommendationEvaluation = {
  chosenGameRank?: number;
  precisionAt3: number;
  meanReciprocalRank: number;
  leastMiseryScore: number;
  calibration: number;
};

export function evaluateRecommendation(night: GameNightRecord, chosenGameIds: string[]): RecommendationEvaluation {
  const recommendation = recommendGames(night);
  const rankedIds = recommendation.rankedGames.map((ranked) => ranked.game.id);
  const ranks = chosenGameIds
    .map((id) => rankedIds.indexOf(id))
    .filter((index) => index >= 0)
    .map((index) => index + 1);
  const chosenGameRank = ranks.length ? Math.min(...ranks) : undefined;
  const precisionAt3 =
    chosenGameIds.length === 0 ? 0 : chosenGameIds.filter((id) => rankedIds.slice(0, 3).includes(id)).length / chosenGameIds.length;
  const meanReciprocalRank = ranks.length ? average(ranks.map((rank) => 1 / rank)) : 0;
  const leastMiseryScore = Math.min(
    ...recommendation.rankedGames.flatMap((ranked) => ranked.participantScores?.map((score) => score.score) ?? [ranked.score]),
  );
  const calibration = recommendation.rankedGames.length
    ? average(recommendation.rankedGames.map((ranked) => explanationCalibration(ranked.reasons.length, ranked.score, recommendation.maxScore)))
    : 0;

  return {
    chosenGameRank,
    precisionAt3,
    meanReciprocalRank,
    leastMiseryScore: Number.isFinite(leastMiseryScore) ? leastMiseryScore : 0,
    calibration,
  };
}

function explanationCalibration(reasonCount: number, score: number, maxScore: number) {
  const normalizedReasons = Math.min(reasonCount, 4) / 4;
  const normalizedScore = score / maxScore;
  return 1 - Math.abs(normalizedReasons - normalizedScore);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}
