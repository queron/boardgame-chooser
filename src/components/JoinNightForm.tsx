"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { estimatePlayTime, formatMinutes, formatPlayTime } from "@/lib/playtime";
import type {
  BggGameDetails,
  BggSearchResult,
  CompetitionPreference,
  GameCandidate,
  GameNightRecord,
  Participant,
  PlayTimeMode,
  PreferenceSubmission,
} from "@/lib/types";

type GameDraft = {
  id?: string;
  title: string;
  bggId?: number;
  year?: number;
  minPlayers: number;
  maxPlayers: number;
  playTimeMode: PlayTimeMode;
  playingTime: number;
  minPlayTime?: number;
  maxPlayTime?: number;
  weight?: number;
  categories: string[];
  mechanics: string[];
  imageUrl?: string;
  manualOverrides: boolean;
};

type ChoiceOption = {
  value: string;
  label: string;
  description: string;
};

type JoinMode = "combined" | "vibe" | "games";

const gameCategoryOptions: ChoiceOption[] = [
  { value: "Adventure", label: "Adventure", description: "Quests, discovery, danger." },
  { value: "Fantasy", label: "Fantasy", description: "Magic, myth, monsters." },
  { value: "Science Fiction", label: "Science Fiction", description: "Future tech or alien worlds." },
  { value: "Space Exploration", label: "Space Exploration", description: "Planets, rockets, deep space." },
  { value: "Horror", label: "Horror", description: "Fear, survival, dark themes." },
  { value: "Murder/Mystery", label: "Murder / Mystery", description: "Clues, secrets, deduction." },
  { value: "Economic", label: "Economic", description: "Markets, production, money." },
  { value: "City Building", label: "City Building", description: "Towns, routes, infrastructure." },
  { value: "Civilization", label: "Civilization", description: "Societies, tech, empires." },
  { value: "Political", label: "Political", description: "Power, influence, negotiation." },
  { value: "Wargame", label: "Wargame", description: "Conflict, tactics, campaigns." },
  { value: "Trains", label: "Trains", description: "Rail networks and logistics." },
  { value: "Animals", label: "Animals / Nature", description: "Wildlife, ecology, farming." },
  { value: "Party Game", label: "Party Game", description: "Group energy and laughter." },
  { value: "Puzzle", label: "Puzzle", description: "Logic, patterns, solving." },
  { value: "Abstract Strategy", label: "Abstract Strategy", description: "Pure systems, minimal theme." },
];

const gameMechanicOptions: ChoiceOption[] = [
  { value: "Cooperative Game", label: "Cooperative", description: "Players win or lose together." },
  { value: "Negotiation", label: "Negotiation", description: "Deals, promises, table talk." },
  { value: "Trading", label: "Trading", description: "Exchange resources or favors." },
  { value: "Auction/Bidding", label: "Auction / Bidding", description: "Price discovery and valuation." },
  { value: "Area Majority / Influence", label: "Area Majority", description: "Compete for control." },
  { value: "Worker Placement", label: "Worker Placement", description: "Take action spaces." },
  { value: "Card Drafting", label: "Card Drafting", description: "Select from shared card pools." },
  { value: "Deck, Bag, and Pool Building", label: "Deck / Bag Building", description: "Build an engine over time." },
  { value: "Dice Rolling", label: "Dice Rolling", description: "Luck, odds, dramatic swings." },
  { value: "Take That", label: "Take That", description: "Directly interfere with others." },
  { value: "Bluffing", label: "Bluffing", description: "Hidden intent and reads." },
  { value: "Deduction", label: "Deduction", description: "Infer hidden information." },
];

const toneOptions: ChoiceOption[] = [
  { value: "casual", label: "Casual", description: "Low pressure, easy rhythm." },
  { value: "banter", label: "Banter", description: "Table talk and interaction." },
  { value: "crunchy", label: "Crunchy", description: "Dense choices and planning." },
  { value: "cinematic", label: "Cinematic", description: "Story moments and big swings." },
  { value: "chaotic", label: "Chaotic", description: "Surprises, dice, volatility." },
];

const challengeScale = ["Featherweight", "Easygoing", "Balanced", "Thinky", "Brain-burning"];
const interactionScale = ["Solitaire-ish", "Low friction", "Balanced", "Table pressure", "Table talk"];
const competitionScale = ["Cooperative", "Co-op leaning", "Flexible", "Competitive leaning", "Competitive"];

const emptyGame = (): GameDraft => ({
  title: "",
  minPlayers: 1,
  maxPlayers: 4,
  playTimeMode: "fixed",
  playingTime: 90,
  categories: [],
  mechanics: [],
  manualOverrides: true,
});

export function JoinNightForm({
  initialNight,
  initialParticipantId,
  initialGameId,
  mode = "combined",
}: {
  initialNight: GameNightRecord;
  initialParticipantId?: string;
  initialGameId?: string;
  mode?: JoinMode;
}) {
  const router = useRouter();
  const slug = initialNight.slug;
  const participants = initialNight.participants;
  const initialParticipant = participants.find((participant) => participant.id === initialParticipantId);
  const initialPreference = initialParticipant
    ? initialNight.preferences.find((item) => item.participantId === initialParticipant.id)
    : undefined;
  const initialGames =
    mode === "games"
      ? initialNight.games.map(fromExistingGame)
      : initialParticipant
        ? initialNight.games.filter((game) => game.submittedBy === initialParticipant.id).map(fromExistingGame)
        : [];
  const [selectedParticipantId, setSelectedParticipantId] = useState(initialParticipantId ?? "");
  const [displayName, setDisplayName] = useState(initialParticipant?.displayName ?? "");
  const [games, setGames] = useState<GameDraft[]>(mode === "games" && initialGames.length === 0 ? [emptyGame()] : initialGames);
  const [bringGames, setBringGames] = useState(mode === "games" || initialGames.length > 0 || Boolean(initialGameId));
  const [challenge, setChallenge] = useState(initialPreference?.challenge ?? 3);
  const [interaction, setInteraction] = useState(initialPreference?.interaction ?? 3);
  const [competition, setCompetition] = useState<CompetitionPreference>(normalizeCompetition(initialPreference?.competition));
  const [tones, setTones] = useState<string[]>(initialPreference?.tones ?? []);
  const [maxPlayTime, setMaxPlayTime] = useState(initialPreference?.maxPlayTime ?? 180);
  const [searches, setSearches] = useState<Record<number, BggSearchResult[]>>({});
  const [searchingIndexes, setSearchingIndexes] = useState<Record<number, boolean>>({});
  const [bggEnabled, setBggEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/bgg/status")
      .then((response) => response.json())
      .then((payload) => setBggEnabled(Boolean(payload.enabled)))
      .catch(() => setBggEnabled(false));
  }, []);

  const search = useCallback(async (index: number, query: string) => {
    setSearchingIndexes((current) => ({ ...current, [index]: true }));
    const response = await fetch(`/api/bgg/search?query=${encodeURIComponent(query)}`);
    const payload = await response.json();
    setSearchingIndexes((current) => ({ ...current, [index]: false }));

    if (!response.ok) {
      setBggEnabled(false);
      setError("");
      setToast(payload.error ?? "BoardGameGeek search is unavailable. Manual entry still works.");
      return;
    }

    setError("");
    setToast("");
    setSearches((current) => ({ ...current, [index]: payload.results ?? [] }));
  }, []);

  useEffect(() => {
    if (!bggEnabled || !bringGames || mode === "vibe") return;

    const timer = window.setTimeout(() => {
      games.forEach((game, index) => {
        const query = game.title.trim();
        if (query.length < 2 || game.bggId) return;
        void search(index, query);
      });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [bggEnabled, bringGames, games, mode, search]);

  async function selectBggGame(index: number, result: BggSearchResult) {
    const response = await fetch(`/api/bgg/thing?id=${result.bggId}`);
    const payload = await response.json();
    if (!response.ok) {
      showToast(payload.error ?? "Could not fetch game details.");
      return;
    }
    setToast("");
    updateGame(index, fromBgg(payload.game));
    setSearches((current) => ({ ...current, [index]: [] }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const validGames = mode !== "vibe" && bringGames ? games.filter((game) => game.title.trim()) : [];
    const invalidGame = validGames.find((game) => game.maxPlayers < game.minPlayers);
    if (invalidGame) {
      showToast(`${invalidGame.title}: maximum players must be greater than or equal to minimum players.`);
      setIsSubmitting(false);
      return;
    }

    const endpoint =
      mode === "vibe"
        ? `/api/nights/${slug}/preferences`
        : mode === "games"
          ? `/api/nights/${slug}/games`
          : `/api/nights/${slug}/submissions`;
    const body =
      mode === "vibe"
        ? {
            participantId: selectedParticipantId || undefined,
            displayName,
            preference: { challenge, interaction, competition, themes: [], tones, maxPlayTime },
          }
        : mode === "games"
          ? {
              games: validGames,
            }
          : {
              participantId: selectedParticipantId || undefined,
              displayName,
              games: validGames,
              preference: { challenge, interaction, competition, themes: [], tones, maxPlayTime },
            };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Could not save your submission.");
      setIsSubmitting(false);
      return;
    }

    if (payload.participant) {
      window.localStorage.setItem(`boardgame-chooser:${slug}:participant`, displayName);
      window.localStorage.setItem(`boardgame-chooser:${slug}:participantId`, payload.participant.id);
    }
    router.push(`/n/${slug}`);
    router.refresh();
  }

  function selectParticipant(participantId: string) {
    setSelectedParticipantId(participantId);
    const participant = participants.find((item) => item.id === participantId);
    if (!participant) {
      setDisplayName("");
      setGames(mode === "games" ? [emptyGame()] : []);
      setBringingGames(mode === "games");
      applyPreference();
      return;
    }

    loadParticipant(participant);
  }

  function loadParticipant(participant: Participant) {
    const preference = initialNight.preferences.find((item) => item.participantId === participant.id);
    const participantGames = initialNight.games
      .filter((game) => game.submittedBy === participant.id)
      .map(fromExistingGame);

    setDisplayName(participant.displayName);
    setGames(participantGames);
    setBringGames(mode === "games" || participantGames.length > 0 || Boolean(initialGameId));
    applyPreference(preference);
  }

  function applyPreference(preference?: PreferenceSubmission) {
    setChallenge(preference?.challenge ?? 3);
    setInteraction(preference?.interaction ?? 3);
    setCompetition(normalizeCompetition(preference?.competition));
    setTones(preference?.tones ?? []);
    setMaxPlayTime(preference?.maxPlayTime ?? 180);
  }

  function setBringingGames(value: boolean) {
    setBringGames(value);
    if (value && games.length === 0) {
      setGames([emptyGame()]);
    }
    if (!value) {
      setGames([]);
      setSearches({});
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-8">
      <Toast message={toast} onClose={() => setToast("")} />
      {mode !== "vibe" && mode !== "games" ? <section className="grid gap-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-stone-950">Who is setting a vibe?</h2>
        {participants.length > 0 ? (
          <label className="grid gap-2 text-sm font-medium text-stone-800">
            Pick an existing attendee
            <select
              value={selectedParticipantId}
              onChange={(event) => selectParticipant(event.target.value)}
              className="h-11 rounded-md border border-stone-300 bg-white px-3 text-base outline-none focus:border-emerald-600"
            >
              <option value="">Add a new attendee</option>
              {participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.displayName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="grid gap-2 text-sm font-medium text-stone-800">
          Attendee name
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="h-11 rounded-md border border-stone-300 px-3 text-base outline-none focus:border-emerald-600"
            required
          />
        </label>
      </section> : null}

      {mode !== "games" ? <section className="grid gap-6 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-xl font-semibold text-stone-950">Tonight&apos;s vibe</h2>
          <p className="text-sm font-medium text-stone-500">{selectedCount(tones)}</p>
        </div>

        <div className="grid gap-5">
          <Range
            label="Challenge"
            value={challenge}
            onChange={setChallenge}
            min={1}
            max={5}
            step={1}
            valueText={challengeScale[challenge - 1]}
            low={challengeScale[0]}
            high={challengeScale[4]}
          />
          <Range
            label="Interaction"
            value={interaction}
            onChange={setInteraction}
            min={1}
            max={5}
            step={1}
            valueText={interactionScale[interaction - 1]}
            low={interactionScale[0]}
            high={interactionScale[4]}
          />
          <Range
            label="Competitive feel"
            value={competition}
            onChange={(value) => setCompetition(value as CompetitionPreference)}
            min={1}
            max={5}
            step={1}
            valueText={competitionScale[competition - 1]}
            low={competitionScale[0]}
            high={competitionScale[4]}
          />
        </div>

        <CheckboxGroup label="Mood" options={toneOptions} selected={tones} onChange={setTones} />
        <Range
          label="Maximum play time"
          value={maxPlayTime}
          onChange={setMaxPlayTime}
          min={30}
          max={360}
          step={30}
          valueText={formatMinutes(maxPlayTime)}
          low="30m"
          high="6h"
        />
      </section> : null}

      {mode !== "vibe" ? <section className="grid gap-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-stone-950">Games you are bringing</h2>
            {mode === "combined" ? (
              <p className="mt-1 text-sm text-stone-600">Optional. Attendance and vibe still count without games.</p>
            ) : null}
          </div>
          {mode === "combined" ? <label className="flex items-center gap-2 text-sm font-semibold text-stone-800">
            <input
              type="checkbox"
              checked={bringGames}
              onChange={(event) => setBringingGames(event.target.checked)}
              className="size-4 accent-emerald-700"
            />
            I am bringing games
          </label> : null}
        </div>

        {bggEnabled === false && bringGames ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            BGG lookup is not configured right now, so title lookup is paused. Manual game details can still be saved.
          </div>
        ) : null}

        {bringGames ? (
          <div className="grid gap-4">
            {games.map((game, index) => (
              <article
                key={game.id ?? index}
                id={game.id === initialGameId ? "selected-game" : undefined}
                className="grid gap-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
              >
                <div className="grid gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <label className="grid flex-1 gap-2 text-sm font-medium text-stone-800">
                      Title
                      <input
                        value={game.title}
                        onChange={(event) =>
                          updateGame(index, { title: event.target.value, bggId: undefined, manualOverrides: true })
                        }
                        className="h-11 rounded-md border border-stone-300 px-3 text-base outline-none focus:border-emerald-600"
                        required={bringGames && index === 0}
                        autoComplete="off"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeGame(index)}
                      className="mt-7 rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  </div>

                  {searchingIndexes[index] ? <p className="text-xs font-medium text-stone-500">Searching BGG...</p> : null}

                  {searches[index]?.length ? (
                    <div className="grid gap-2 rounded-md border border-sky-200 bg-sky-50 p-3">
                      {searches[index].map((result) => (
                        <button
                          type="button"
                          key={result.bggId}
                          onClick={() => selectBggGame(index, result)}
                          className="rounded-md bg-white px-3 py-2 text-left text-sm font-medium text-sky-950 hover:bg-sky-100"
                        >
                          {result.title}
                          {result.year ? ` (${result.year})` : ""}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
                  <div className="grid gap-3 rounded-md border border-stone-200 bg-stone-50 p-3 sm:grid-cols-2">
                    <NumberField
                      label="Min players"
                      value={game.minPlayers}
                      onChange={(value) => updateGame(index, { minPlayers: value })}
                      compact
                    />
                    <NumberField
                      label="Max players"
                      value={game.maxPlayers}
                      onChange={(value) => updateGame(index, { maxPlayers: value })}
                      compact
                    />
                  </div>
                  <PlayTimeFields game={game} onChange={(patch) => updateGame(index, patch)} />
                </div>
                {game.maxPlayers < game.minPlayers ? (
                  <p className="rounded-md bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
                    Maximum players must be greater than or equal to minimum players.
                  </p>
                ) : null}
                <details className="rounded-md border border-stone-200 bg-stone-50 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-stone-900">
                    BGG metadata and scoring details
                  </summary>
                  <div className="mt-4 grid gap-5">
                    <Range
                      label={`Game ${index + 1} complexity`}
                      value={game.weight ?? 3}
                      onChange={(value) => updateGame(index, { weight: value })}
                      min={1}
                      max={5}
                      step={0.5}
                      valueText={`${game.weight ?? 3}/5`}
                      low="Light"
                      high="Heavy"
                    />
                    <CheckboxGroup
                      label="BGG categories"
                      options={gameCategoryOptions}
                      selected={game.categories}
                      onChange={(categories) => updateGame(index, { categories })}
                    />
                    <CheckboxGroup
                      label="BGG mechanics"
                      options={gameMechanicOptions}
                      selected={game.mechanics}
                      onChange={(mechanics) => updateGame(index, { mechanics })}
                    />
                  </div>
                </details>
              </article>
            ))}

            <button
              type="button"
              onClick={() => setGames((current) => [...current, emptyGame()].slice(0, 5))}
              className="h-10 justify-self-start rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 hover:bg-stone-50"
            >
              Add another game
            </button>
          </div>
        ) : null}
      </section> : null}

      {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
      <button
        disabled={isSubmitting}
        className="h-12 rounded-md bg-emerald-700 px-4 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-400"
      >
        {isSubmitting ? "Saving..." : mode === "games" ? "Save games" : mode === "vibe" ? "Save vibe" : "Save attendee details"}
      </button>
    </form>
  );

  function updateGame(index: number, patch: Partial<GameDraft>) {
    setGames((current) =>
      current.map((existing, gameIndex) =>
        gameIndex === index ? { ...existing, ...patch, manualOverrides: patch.manualOverrides ?? true } : existing,
      ),
    );
  }

  function removeGame(index: number) {
    setGames((current) => current.filter((_, gameIndex) => gameIndex !== index));
    setSearches((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
  }

  function showToast(message: string) {
    setError("");
    setToast(message);
  }
}

function fromBgg(game: BggGameDetails): GameDraft {
  return { ...game, playTimeMode: game.playTimeMode ?? "fixed", manualOverrides: false };
}

function fromExistingGame(game: GameCandidate): GameDraft {
  if (game.playTimeMode === "perPlayer") {
    return {
      ...game,
      playTimeMode: "fixed",
      playingTime: estimatePlayTime(game),
    };
  }

  return { ...game, playTimeMode: game.playTimeMode ?? "fixed" };
}

function normalizeCompetition(value: PreferenceSubmission["competition"] | undefined): CompetitionPreference {
  if (typeof value === "number") return Math.min(5, Math.max(1, value)) as CompetitionPreference;
  if (value === "cooperative") return 1;
  if (value === "competitive") return 5;
  return 3;
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null;

  return (
    <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-xl" role="alert" aria-live="assertive">
      <div className="flex items-start justify-between gap-4 rounded-lg border border-rose-200 bg-white p-4 text-sm text-rose-950 shadow-lg">
        <div>
          <p className="font-semibold">BoardGameGeek lookup needs attention</p>
          <p className="mt-1 leading-6">{message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-sm font-semibold text-rose-800 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2"
          aria-label="Dismiss notification"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function PlayTimeFields({ game, onChange }: { game: GameDraft; onChange: (patch: Partial<GameDraft>) => void }) {
  function setMode(playTimeMode: Exclude<PlayTimeMode, "perPlayer">) {
    if (playTimeMode === "range") {
      const minPlayTime = game.minPlayTime ?? game.playingTime;
      const maxPlayTime = game.maxPlayTime ?? game.playingTime;
      onChange({
        playTimeMode,
        minPlayTime,
        maxPlayTime,
        playingTime: Math.round((minPlayTime + maxPlayTime) / 2),
      });
      return;
    }

    onChange({ playTimeMode, minPlayTime: undefined, maxPlayTime: undefined });
  }

  function setRangeMin(minPlayTime: number) {
    const maxPlayTime = game.maxPlayTime ?? minPlayTime;
    onChange({
      minPlayTime,
      maxPlayTime,
      playingTime: Math.round((minPlayTime + maxPlayTime) / 2),
    });
  }

  function setRangeMax(maxPlayTime: number) {
    const minPlayTime = game.minPlayTime ?? maxPlayTime;
    onChange({
      minPlayTime,
      maxPlayTime,
      playingTime: Math.round((minPlayTime + maxPlayTime) / 2),
    });
  }

  function normalizeRange() {
    const minPlayTime = game.minPlayTime ?? game.playingTime;
    const maxPlayTime = game.maxPlayTime ?? game.playingTime;
    if (maxPlayTime >= minPlayTime) return;

    onChange({
      minPlayTime: maxPlayTime,
      maxPlayTime: minPlayTime,
      playingTime: Math.round((minPlayTime + maxPlayTime) / 2),
    });
  }

  return (
    <div className="grid gap-3 rounded-md border border-stone-200 bg-stone-50 p-3">
      <div className="grid min-w-0 gap-3 md:grid-cols-[10rem_minmax(0,1fr)]">
        <label className="grid gap-2 text-sm font-medium text-stone-800">
          Play time
          <select
            value={game.playTimeMode === "perPlayer" ? "fixed" : game.playTimeMode}
            onChange={(event) => setMode(event.target.value as Exclude<PlayTimeMode, "perPlayer">)}
            className="h-11 min-w-0 rounded-md border border-stone-300 bg-white px-3 text-base outline-none focus:border-emerald-600"
          >
            <option value="fixed">BGG total</option>
            <option value="range">BGG range</option>
          </select>
        </label>

        {game.playTimeMode === "range" ? (
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <NumberField
              label="Minimum minutes"
              value={game.minPlayTime ?? game.playingTime}
              onChange={setRangeMin}
              onBlur={normalizeRange}
            />
            <NumberField
              label="Maximum minutes"
              value={game.maxPlayTime ?? game.playingTime}
              onChange={setRangeMax}
              onBlur={normalizeRange}
            />
          </div>
        ) : (
          <NumberField
            label="Total minutes"
            value={game.playingTime}
            onChange={(playingTime) => onChange({ playingTime })}
          />
        )}
      </div>
      {game.playTimeMode === "range" && (game.maxPlayTime ?? game.playingTime) < (game.minPlayTime ?? game.playingTime) ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          The range will be reordered when you leave the field.
        </p>
      ) : null}
      <p className="text-xs font-medium text-stone-600">
        Shown as {formatPlayTime(game)}. Recommendation estimate: {formatMinutes(estimatePlayTime(game))}.
      </p>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  onBlur,
  compact = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  compact?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-stone-800">
      {label}
      <input
        type="number"
        min={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onBlur={onBlur}
        className={[
          "h-11 min-w-0 rounded-md border border-stone-300 px-3 text-base outline-none focus:border-emerald-600",
          compact ? "w-full" : "",
        ].join(" ")}
      />
    </label>
  );
}

function Range({
  label,
  value,
  onChange,
  min,
  max,
  step,
  valueText,
  low,
  high,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  valueText: string;
  low: string;
  high: string;
}) {
  const inputId = `${label.toLowerCase().replaceAll(" ", "-")}-range`;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-semibold text-stone-900">
          {label}
        </label>
        <output
          htmlFor={inputId}
          className="min-w-24 rounded-md bg-emerald-50 px-2.5 py-1 text-right text-sm font-semibold text-emerald-800"
        >
          {valueText}
        </output>
      </div>
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-7 cursor-pointer accent-emerald-700"
      />
      <span className="flex justify-between text-xs font-medium text-stone-500">
        <span>{low}</span>
        <span>{high}</span>
      </span>
    </div>
  );
}

function CheckboxGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: ChoiceOption[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold text-stone-900">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label key={option.value} className={choiceClass(checked)}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(option.value)}
                className="sr-only"
              />
              <span className={indicatorClass(checked)} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="mt-1 block text-xs leading-5 text-stone-600">{option.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function choiceClass(checked: boolean) {
  return [
    "flex min-h-20 cursor-pointer items-start gap-3 rounded-md border px-3 py-3 text-stone-900 outline-none",
    "focus-within:ring-2 focus-within:ring-emerald-700 focus-within:ring-offset-2 hover:border-emerald-500",
    checked ? "border-emerald-700 bg-emerald-50" : "border-stone-200 bg-white",
  ].join(" ");
}

function indicatorClass(checked: boolean) {
  return [
    "mt-0.5 grid size-5 shrink-0 place-items-center rounded border",
    checked ? "border-emerald-700 bg-emerald-700 shadow-inner" : "border-stone-400 bg-white",
  ].join(" ");
}

function selectedCount(tones: string[]) {
  return tones.length === 1 ? "1 mood pick" : `${tones.length} mood picks`;
}
