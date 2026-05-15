"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { dynamicThemeOptions } from "@/lib/game-features";
import { estimatePlayTime, formatMinutes, formatPlayTime } from "@/lib/playtime";
import type {
  BggExpansion,
  BggGameDetails,
  BggSearchResult,
  CompetitionPreference,
  GameCandidate,
  GameNightRecord,
  HardAvoid,
  LearnedPreferenceProfile,
  Participant,
  PlayTimeMode,
  PreferenceSubmission,
  TimeFlexibility,
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
  expansions: BggExpansion[];
  expansionOptions: BggExpansion[];
  imageUrl?: string;
  bggAverageRating?: number;
  bggBayesAverage?: number;
  bggUsersRated?: number;
  bggWeightVotes?: number;
  bggRank?: number;
  metadataConfidence?: number;
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
  { value: "casual", label: "Relaxed", description: "Low pressure, easy rhythm." },
  { value: "banter", label: "Talky", description: "Table talk and interaction." },
  { value: "crunchy", label: "Strategic", description: "Dense choices and planning." },
  { value: "cinematic", label: "Cinematic", description: "Story moments and big swings." },
  { value: "chaotic", label: "Chaotic", description: "Surprises, dice, volatility." },
  { value: "tactical", label: "Tactical", description: "Positioning and confrontation." },
  { value: "cooperative", label: "Cooperative", description: "Shared puzzle-solving." },
];

const hardAvoidOptions: ChoiceOption[] = [
  { value: "take_that", label: "Take-that", description: "Targeted interference." },
  { value: "heavy_teach", label: "Heavy teach", description: "Long or dense rules explanation." },
  { value: "direct_conflict", label: "Direct conflict", description: "Combat or repeated attacks." },
  { value: "bluffing", label: "Bluffing", description: "Deception and hidden intent." },
  { value: "coop", label: "Co-op", description: "Everyone against the game." },
  { value: "downtime", label: "Long downtime", description: "Waiting around between turns." },
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
  expansions: [],
  expansionOptions: [],
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
  const { showToast } = useToast();
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
  const [themes, setThemes] = useState<string[]>(initialPreference?.themes ?? []);
  const [tones, setTones] = useState<string[]>(initialPreference?.tones ?? []);
  const [maxPlayTime, setMaxPlayTime] = useState(initialPreference?.maxPlayTime ?? 180);
  const [timeFlexibility, setTimeFlexibility] = useState<TimeFlexibility>(initialPreference?.timeFlexibility ?? "flexible");
  const [hardAvoids, setHardAvoids] = useState<HardAvoid[]>(initialPreference?.hardAvoids ?? []);
  const [learnedProfile] = useState<LearnedPreferenceProfile | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    try {
      const saved = window.localStorage.getItem("boardgame-chooser:learnedProfile");
      return saved ? (JSON.parse(saved) as LearnedPreferenceProfile) : undefined;
    } catch {
      return undefined;
    }
  });
  const [searches, setSearches] = useState<Record<number, BggSearchResult[]>>({});
  const [searchingIndexes, setSearchingIndexes] = useState<Record<number, boolean>>({});
  const [bggEnabled, setBggEnabled] = useState<boolean | null>(null);
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
      showToast(payload.error ?? "BoardGameGeek search is unavailable. Manual entry still works.", {
        title: "BoardGameGeek lookup needs attention",
      });
      return;
    }

    setSearches((current) => ({ ...current, [index]: payload.results ?? [] }));
  }, [showToast]);

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

  useEffect(() => {
    if (!bggEnabled || mode !== "games") return;

    games.forEach((game, index) => {
      if (!game.bggId || game.expansionOptions.length > game.expansions.length) return;
      void fetch(`/api/bgg/thing?id=${game.bggId}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (!payload?.game?.expansions?.length) return;
          updateGame(index, {
            expansionOptions: mergeExpansions(game.expansions, payload.game.expansions),
            manualOverrides: game.manualOverrides,
          });
        })
        .catch(() => undefined);
    });
  }, [bggEnabled, games, mode]);

  async function selectBggGame(index: number, result: BggSearchResult) {
    const response = await fetch(`/api/bgg/thing?id=${result.bggId}`);
    const payload = await response.json();
    if (!response.ok) {
      showToast(payload.error ?? "Could not fetch game details.", {
        title: "BoardGameGeek lookup needs attention",
      });
      return;
    }
    updateGame(index, fromBgg(payload.game));
    setSearches((current) => ({ ...current, [index]: [] }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const validGames = mode !== "vibe" && bringGames ? games.filter((game) => game.title.trim()) : [];
    const invalidGame = validGames.find((game) => game.maxPlayers < game.minPlayers);
    if (invalidGame) {
      showToast(`${invalidGame.title}: maximum players must be greater than or equal to minimum players.`);
      setIsSubmitting(false);
      return;
    }
    const submissionGames = validGames.map(toSubmissionGame);

    const endpoint =
      mode === "vibe"
        ? `/api/nights/${slug}/preferences`
        : mode === "games"
          ? `/api/nights/${slug}/games`
          : `/api/nights/${slug}/submissions`;
    const preference = {
      challenge,
      interaction,
      competition,
      themes,
      tones,
      maxPlayTime,
      timeFlexibility,
      hardAvoids,
      ...(learnedProfile ? { learnedProfile } : {}),
    };
    const body =
      mode === "vibe"
        ? {
            participantId: selectedParticipantId || undefined,
            displayName,
            preference,
          }
        : mode === "games"
          ? {
              games: submissionGames,
            }
          : {
              participantId: selectedParticipantId || undefined,
              displayName,
              games: submissionGames,
              preference,
            };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();

    if (!response.ok) {
      showToast(payload.error ?? "Could not save your submission.");
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
    setThemes(preference?.themes ?? []);
    setTones(preference?.tones ?? []);
    setMaxPlayTime(preference?.maxPlayTime ?? 180);
    setTimeFlexibility(preference?.timeFlexibility ?? "flexible");
    setHardAvoids(preference?.hardAvoids ?? []);
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

        <CheckboxGroup label="Tonight should feel..." options={toneOptions} selected={tones} onChange={setTones} limit={2} />
        <Range
          label="Maximum comfortable play time"
          value={maxPlayTime}
          onChange={setMaxPlayTime}
          min={30}
          max={360}
          step={30}
          valueText={formatMinutes(maxPlayTime)}
          low="30m"
          high="6h"
        />
        <SegmentedControl
          label="Time flexibility"
          value={timeFlexibility}
          options={[
            { value: "strict", label: "Strict" },
            { value: "flexible", label: "Flexible" },
          ]}
          onChange={(value) => setTimeFlexibility(value as TimeFlexibility)}
        />
        <CheckboxGroup
          label="Hard avoids tonight"
          options={hardAvoidOptions}
          selected={hardAvoids}
          onChange={(value) => setHardAvoids(value as HardAvoid[])}
        />
        <DynamicThemePicker
          games={[...initialNight.games, ...games.map(draftToCandidatePreview)]}
          selected={themes}
          onChange={setThemes}
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
                {game.expansionOptions.length > 0 ? (
                  <ExpansionPicker
                    options={game.expansionOptions}
                    selected={game.expansions}
                    onChange={(expansions) => updateGame(index, { expansions })}
                  />
                ) : game.bggId ? (
                  <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">
                    No BGG expansions were found for this title.
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
              onClick={() => setGames((current) => [...current, emptyGame()])}
              className="h-10 justify-self-start rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 hover:bg-stone-50"
            >
              Add another game
            </button>
          </div>
        ) : null}
      </section> : null}

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

}

function toSubmissionGame(game: GameDraft): Omit<GameCandidate, "id" | "submittedBy"> {
  return {
    ...(game.bggId && game.bggId > 0 ? { bggId: game.bggId } : {}),
    title: game.title,
    ...(game.year ? { year: game.year } : {}),
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    playTimeMode: game.playTimeMode,
    playingTime: game.playingTime > 0 ? game.playingTime : 90,
    ...(game.playTimeMode === "range" && game.minPlayTime && game.maxPlayTime
      ? { minPlayTime: game.minPlayTime, maxPlayTime: game.maxPlayTime }
      : {}),
    ...(game.weight && game.weight >= 1 ? { weight: game.weight } : {}),
    categories: game.categories,
    mechanics: game.mechanics,
    expansions: game.expansions.filter((expansion) => expansion.bggId > 0),
    ...(game.imageUrl ? { imageUrl: game.imageUrl } : {}),
    ...(game.bggAverageRating !== undefined ? { bggAverageRating: game.bggAverageRating } : {}),
    ...(game.bggBayesAverage !== undefined ? { bggBayesAverage: game.bggBayesAverage } : {}),
    ...(game.bggUsersRated !== undefined ? { bggUsersRated: game.bggUsersRated } : {}),
    ...(game.bggWeightVotes !== undefined ? { bggWeightVotes: game.bggWeightVotes } : {}),
    ...(game.bggRank !== undefined ? { bggRank: game.bggRank } : {}),
    ...(game.metadataConfidence !== undefined ? { metadataConfidence: game.metadataConfidence } : {}),
    manualOverrides: game.manualOverrides,
  };
}

function draftToCandidatePreview(game: GameDraft): GameCandidate {
  return {
    id: game.id ?? game.title,
    ...toSubmissionGame({ ...game, title: game.title || "Untitled game" }),
  };
}

function fromBgg(game: BggGameDetails): GameDraft {
  return {
    ...game,
    playTimeMode: game.playTimeMode ?? "fixed",
    playingTime: game.playingTime > 0 ? game.playingTime : 90,
    minPlayTime: game.minPlayTime && game.minPlayTime > 0 ? game.minPlayTime : undefined,
    maxPlayTime: game.maxPlayTime && game.maxPlayTime > 0 ? game.maxPlayTime : undefined,
    weight: game.weight && game.weight >= 1 ? game.weight : undefined,
    expansions: [],
    expansionOptions: game.expansions ?? [],
    manualOverrides: false,
  };
}

function fromExistingGame(game: GameCandidate): GameDraft {
  if (game.playTimeMode === "perPlayer") {
    return {
      ...game,
      playTimeMode: "fixed",
      playingTime: estimatePlayTime(game),
      expansions: game.expansions ?? [],
      expansionOptions: game.expansions ?? [],
    };
  }

  return {
    ...game,
    playTimeMode: game.playTimeMode ?? "fixed",
    expansions: game.expansions ?? [],
    expansionOptions: game.expansions ?? [],
  };
}

function normalizeCompetition(value: PreferenceSubmission["competition"] | undefined): CompetitionPreference {
  if (typeof value === "number") return Math.min(5, Math.max(1, value)) as CompetitionPreference;
  if (value === "cooperative") return 1;
  if (value === "competitive") return 5;
  return 3;
}

function mergeExpansions(selected: BggExpansion[], available: BggExpansion[]) {
  return Array.from([...selected, ...available].reduce((map, expansion) => map.set(expansion.bggId, expansion), new Map<number, BggExpansion>()).values()).sort(
    (a, b) => a.title.localeCompare(b.title),
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

function ExpansionPicker({
  options,
  selected,
  onChange,
}: {
  options: BggExpansion[];
  selected: BggExpansion[];
  onChange: (value: BggExpansion[]) => void;
}) {
  const [filter, setFilter] = useState("");
  const selectedIds = new Set(selected.map((expansion) => expansion.bggId));
  const visibleOptions = options.filter((expansion) =>
    expansion.title.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()),
  );

  function toggle(expansion: BggExpansion) {
    onChange(
      selectedIds.has(expansion.bggId)
        ? selected.filter((item) => item.bggId !== expansion.bggId)
        : [...selected, expansion].sort((a, b) => a.title.localeCompare(b.title)),
    );
  }

  return (
    <section className="grid gap-3 rounded-md border border-stone-200 bg-stone-50 p-3">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Expansions</h3>
          <p className="mt-1 text-xs text-stone-600">Select any expansions available for this game tonight.</p>
        </div>
        <span className="text-xs font-medium text-stone-500">
          {selected.length} selected
        </span>
      </div>
      {options.length > 8 ? (
        <label className="grid gap-1 text-sm font-medium text-stone-800">
          Filter expansions
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="h-10 rounded-md border border-stone-300 bg-white px-3 text-base outline-none focus:border-emerald-600"
          />
        </label>
      ) : null}
      <div className="grid max-h-64 gap-2 overflow-auto pr-1 sm:grid-cols-2">
        {visibleOptions.map((expansion) => {
          const checked = selectedIds.has(expansion.bggId);
          return (
            <label
              key={expansion.bggId}
              className={[
                "flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm text-stone-900",
                checked ? "border-emerald-700 bg-emerald-50" : "border-stone-200 bg-white hover:border-emerald-500",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(expansion)}
                className="size-4 accent-emerald-700"
              />
              <span className="min-w-0">
                <span className="block font-semibold">{expansion.title}</span>
                {expansion.year ? <span className="text-xs text-stone-500">{expansion.year}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
    </section>
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
  limit,
}: {
  label: string;
  options: ChoiceOption[];
  selected: string[];
  onChange: (value: string[]) => void;
  limit?: number;
}) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
      return;
    }
    if (limit && selected.length >= limit) {
      onChange([...selected.slice(1), value]);
      return;
    }
    onChange([...selected, value]);
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

function SegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold text-stone-900">{label}</legend>
      <div className="grid grid-cols-2 gap-1 rounded-md bg-stone-100 p-1">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={[
                "h-10 rounded px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2",
                active ? "bg-white text-stone-950 shadow-sm" : "text-stone-600 hover:text-stone-950",
              ].join(" ")}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function DynamicThemePicker({
  games,
  selected,
  onChange,
}: {
  games: GameCandidate[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const options = dynamicThemeOptions(games)
    .filter(Boolean)
    .map((theme) => ({
      value: theme,
      label: theme,
      description: "Present in the current game pool.",
    }));

  if (options.length === 0) return null;

  return (
    <CheckboxGroup
      label="Themes you are especially up for"
      options={options}
      selected={selected.filter((theme) => options.some((option) => option.value === theme))}
      onChange={onChange}
      limit={3}
    />
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
