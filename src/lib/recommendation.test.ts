import assert from "node:assert/strict";
import test from "node:test";
import { buildGameFeatureVector, dynamicThemeOptions } from "./game-features";
import { evaluateRecommendation } from "./recommendation-evaluation";
import { recommendGames } from "./recommendation";
import type { GameCandidate, GameNightRecord, PreferenceSubmission } from "./types";

const baseGame = (patch: Partial<GameCandidate>): GameCandidate => ({
  id: patch.id ?? crypto.randomUUID(),
  title: patch.title ?? "Game",
  minPlayers: 1,
  maxPlayers: 5,
  playTimeMode: "fixed",
  playingTime: 60,
  categories: [],
  mechanics: [],
  expansions: [],
  manualOverrides: false,
  ...patch,
});

const preference = (participantId: string, patch: Partial<PreferenceSubmission>): PreferenceSubmission => ({
  participantId,
  challenge: 3,
  interaction: 3,
  competition: 3,
  themes: [],
  tones: [],
  maxPlayTime: 120,
  timeFlexibility: "flexible",
  hardAvoids: [],
  ...patch,
});

test("feature vectors map cooperative, negotiation, take-that, dice, and worker placement signals", () => {
  const cooperative = buildGameFeatureVector(baseGame({ mechanics: ["Cooperative Game"] }));
  const social = buildGameFeatureVector(baseGame({ mechanics: ["Negotiation", "Trading"] }));
  const takeThat = buildGameFeatureVector(baseGame({ mechanics: ["Take That"] }));
  const dice = buildGameFeatureVector(baseGame({ mechanics: ["Dice Rolling"] }));
  const workerPlacement = buildGameFeatureVector(baseGame({ mechanics: ["Worker Placement"] }));

  assert.ok(cooperative.cooperation > 0.8);
  assert.ok(social.interaction > 0.8);
  assert.ok(takeThat.conflict > 0.7);
  assert.ok(dice.randomness > 0.7);
  assert.ok(workerPlacement.strategy > 0.7);
});

test("sparse manual games still produce neutral, lower-confidence feature vectors", () => {
  const vector = buildGameFeatureVector(baseGame({ bggId: undefined, weight: undefined }));

  assert.equal(vector.complexity, 3);
  assert.ok(vector.confidence > 0);
  assert.ok(vector.confidence < 0.6);
});

test("dynamic themes are generated from the current candidate pool", () => {
  const themes = dynamicThemeOptions([
    baseGame({ categories: ["Fantasy", "Adventure"] }),
    baseGame({ categories: ["Science Fiction"] }),
  ]);

  assert.deepEqual(themes.slice(0, 3), ["Adventure", "Fantasy", "Science Fiction"]);
});

test("group aggregation favors broad fit over a polarizing game", () => {
  const night: GameNightRecord = {
    slug: "test",
    title: "Test night",
    status: "open",
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
    participants: [
      { id: "00000000-0000-4000-8000-000000000001", displayName: "Light Player", nightId: "test", submittedAt: "now" },
      { id: "00000000-0000-4000-8000-000000000002", displayName: "Social Player", nightId: "test", submittedAt: "now" },
      { id: "00000000-0000-4000-8000-000000000003", displayName: "Heavy Player", nightId: "test", submittedAt: "now" },
    ],
    preferences: [
      preference("00000000-0000-4000-8000-000000000001", { challenge: 1, tones: ["casual"], hardAvoids: ["heavy_teach"] }),
      preference("00000000-0000-4000-8000-000000000002", { interaction: 5, tones: ["banter"] }),
      preference("00000000-0000-4000-8000-000000000003", { challenge: 4, tones: ["crunchy"] }),
    ],
    games: [
      baseGame({
        id: "polarizing",
        title: "Polarizing Heavy Conflict",
        playingTime: 180,
        weight: 4.6,
        mechanics: ["Worker Placement", "Take That"],
        categories: ["Wargame"],
      }),
      baseGame({
        id: "compromise",
        title: "Broad Compromise",
        playingTime: 90,
        weight: 2.8,
        mechanics: ["Card Drafting"],
        categories: ["Adventure"],
      }),
      baseGame({ id: "excluded", title: "Two Player Only", minPlayers: 2, maxPlayers: 2 }),
    ],
    feedback: [],
    learnedProfiles: [],
  };

  const recommendation = recommendGames(night);

  assert.equal(recommendation.rankedGames[0].game.id, "compromise");
  assert.equal(recommendation.exclusions[0].game.id, "excluded");
});

test("evaluation reports rank and precision for chosen games without live BGG calls", () => {
  const night: GameNightRecord = {
    slug: "eval",
    title: "Evaluation night",
    status: "open",
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
    participants: [{ id: "00000000-0000-4000-8000-000000000004", displayName: "Q", nightId: "eval", submittedAt: "now" }],
    preferences: [preference("00000000-0000-4000-8000-000000000004", { challenge: 2, tones: ["casual"] })],
    games: [
      baseGame({ id: "light", title: "Light Fit", playingTime: 45, weight: 1.8, categories: ["Party Game"] }),
      baseGame({ id: "heavy", title: "Heavy Fit", playingTime: 180, weight: 4.5, categories: ["Economic"] }),
    ],
  };

  const metrics = evaluateRecommendation(night, ["light"]);

  assert.equal(metrics.chosenGameRank, 1);
  assert.equal(metrics.precisionAt3, 1);
  assert.ok(metrics.meanReciprocalRank > 0);
  assert.ok(metrics.calibration >= 0 && metrics.calibration <= 1);
});
