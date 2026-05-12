"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { BggGameDetails, BggSearchResult, CompetitionPreference } from "@/lib/types";

type GameDraft = {
  title: string;
  bggId?: number;
  year?: number;
  minPlayers: number;
  maxPlayers: number;
  playingTime: number;
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

const competitionOptions: (ChoiceOption & { value: CompetitionPreference })[] = [
  { value: "either", label: "Either", description: "Let the game pool decide." },
  { value: "competitive", label: "Competitive", description: "Rivals, scoring, direct tension." },
  { value: "cooperative", label: "Cooperative", description: "Shared win or shared loss." },
];

const themeOptions: ChoiceOption[] = [
  { value: "adventure", label: "Adventure", description: "Quests, danger, discoveries." },
  { value: "fantasy", label: "Fantasy", description: "Magic, monsters, myth." },
  { value: "sciFi", label: "Science Fiction", description: "Future tech, aliens, dystopias." },
  { value: "space", label: "Space Exploration", description: "Planets, rockets, deep space." },
  { value: "pirate", label: "Pirates / Nautical", description: "Ships, treasure, high seas." },
  { value: "horror", label: "Horror / Mystery", description: "Dread, deduction, dark secrets." },
  { value: "ancient", label: "Ancient / Medieval", description: "Empires, kingdoms, old worlds." },
  { value: "modernHistory", label: "Modern History", description: "Recent eras, wars, politics." },
  { value: "civilization", label: "Civilization", description: "Growth, tech, society-building." },
  { value: "economic", label: "Economic", description: "Markets, money, production." },
  { value: "cityBuilding", label: "City Building", description: "Towns, networks, infrastructure." },
  { value: "trainsTransport", label: "Trains / Transport", description: "Routes, logistics, delivery." },
  { value: "nature", label: "Animals / Nature", description: "Wildlife, ecology, farming." },
  { value: "wargame", label: "Wargame", description: "Conflict, campaigns, tactics." },
  { value: "party", label: "Party / Humor", description: "Groups, jokes, social energy." },
  { value: "puzzle", label: "Puzzle / Abstract", description: "Logic, patterns, pure systems." },
  { value: "racingSports", label: "Racing / Sports", description: "Speed, contests, tournaments." },
  { value: "popCulture", label: "Pop Culture", description: "Movies, books, video games." },
];

const gameCategoryOptions: ChoiceOption[] = [
  { value: "Adventure", label: "Adventure", description: "Quests, discovery, danger." },
  { value: "Fantasy", label: "Fantasy", description: "Magic, myth, monsters." },
  { value: "Science Fiction", label: "Science Fiction", description: "Future tech or alien worlds." },
  { value: "Space Exploration", label: "Space Exploration", description: "Planets, rockets, deep space." },
  { value: "Pirates", label: "Pirates", description: "Treasure, raiding, high seas." },
  { value: "Nautical", label: "Nautical", description: "Ships, oceans, navigation." },
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

const emptyGame = (): GameDraft => ({
  title: "",
  minPlayers: 1,
  maxPlayers: 4,
  playingTime: 90,
  categories: [],
  mechanics: [],
  manualOverrides: true,
});

export function JoinNightForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [games, setGames] = useState<GameDraft[]>([emptyGame()]);
  const [challenge, setChallenge] = useState(3);
  const [interaction, setInteraction] = useState(3);
  const [competition, setCompetition] = useState<CompetitionPreference>("either");
  const [themes, setThemes] = useState<string[]>([]);
  const [tones, setTones] = useState<string[]>([]);
  const [maxPlayTime, setMaxPlayTime] = useState(180);
  const [searches, setSearches] = useState<Record<number, BggSearchResult[]>>({});
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function search(index: number) {
    const query = games[index]?.title.trim();
    if (!query) return;
    const response = await fetch(`/api/bgg/search?query=${encodeURIComponent(query)}`);
    const payload = await response.json();
    if (!response.ok) {
      showToast(payload.error ?? "BoardGameGeek search is unavailable. Manual entry still works.");
      return;
    }
    setError("");
    setToast("");
    setSearches((current) => ({ ...current, [index]: payload.results ?? [] }));
  }

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

    const validGames = games.filter((game) => game.title.trim());
    const invalidGame = validGames.find((game) => game.maxPlayers < game.minPlayers);
    if (invalidGame) {
      showToast(`${invalidGame.title}: maximum players must be greater than or equal to minimum players.`);
      setIsSubmitting(false);
      return;
    }

    const participantId = window.localStorage.getItem(`boardgame-chooser:${slug}:participantId`) ?? undefined;
    const response = await fetch(`/api/nights/${slug}/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId,
        displayName,
        games: validGames,
        preference: { challenge, interaction, competition, themes, tones, maxPlayTime },
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Could not save your submission.");
      setIsSubmitting(false);
      return;
    }

    window.localStorage.setItem(`boardgame-chooser:${slug}:participant`, displayName);
    window.localStorage.setItem(`boardgame-chooser:${slug}:participantId`, payload.participant.id);
    router.push(`/n/${slug}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-8">
      <Toast message={toast} onClose={() => setToast("")} />
      <section className="grid gap-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-stone-950">Who is joining?</h2>
        <label className="grid gap-2 text-sm font-medium text-stone-800">
          Your name
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="h-11 rounded-md border border-stone-300 px-3 text-base outline-none focus:border-emerald-600"
            required
          />
        </label>
      </section>

      <section className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-stone-950">Games you can bring</h2>
          <button
            type="button"
            onClick={() => setGames((current) => [...current, emptyGame()].slice(0, 5))}
            className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            Add game
          </button>
        </div>

        {games.map((game, index) => (
          <article key={index} className="grid gap-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <label className="grid gap-2 text-sm font-medium text-stone-800">
                Title
                <input
                  value={game.title}
                  onChange={(event) => updateGame(index, { title: event.target.value, manualOverrides: true })}
                  className="h-11 rounded-md border border-stone-300 px-3 text-base outline-none focus:border-emerald-600"
                  required={index === 0}
                />
              </label>
              <button
                type="button"
                onClick={() => search(index)}
                className="self-end rounded-md bg-stone-900 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-700"
              >
                Search BGG
              </button>
            </div>

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

            <div className="grid gap-3 sm:grid-cols-3">
              <NumberField label="Min players" value={game.minPlayers} onChange={(value) => updateGame(index, { minPlayers: value })} />
              <NumberField label="Max players" value={game.maxPlayers} onChange={(value) => updateGame(index, { maxPlayers: value })} />
              <NumberField label="Minutes" value={game.playingTime} onChange={(value) => updateGame(index, { playingTime: value })} />
            </div>
            {game.maxPlayers < game.minPlayers ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
                Maximum players must be greater than or equal to minimum players.
              </p>
            ) : null}
            <details
              open={!game.bggId}
              className="rounded-md border border-stone-200 bg-stone-50 p-3"
            >
              <summary className="cursor-pointer text-sm font-semibold text-stone-900">
                Recommendation details
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
                  label="BGG-style categories"
                  options={gameCategoryOptions}
                  selected={game.categories}
                  onChange={(categories) => updateGame(index, { categories })}
                />
                <CheckboxGroup
                  label="Mechanics and table feel"
                  options={gameMechanicOptions}
                  selected={game.mechanics}
                  onChange={(mechanics) => updateGame(index, { mechanics })}
                />
              </div>
            </details>
            <p className="text-xs text-stone-500">
              BGG data can be corrected here. Manual details improve the recommendation when lookup is unavailable.
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-xl font-semibold text-stone-950">Tonight&apos;s vibe</h2>
          <p className="text-sm font-medium text-stone-500">{selectedCount(themes, tones)}</p>
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
        </div>

        <RadioCardGroup
          label="Competitive feel"
          options={competitionOptions}
          selected={competition}
          onChange={setCompetition}
        />

        <CheckboxGroup label="Themes" options={themeOptions} selected={themes} onChange={setThemes} />
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
      </section>

      {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
      <button
        disabled={isSubmitting}
        className="h-12 rounded-md bg-emerald-700 px-4 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-400"
      >
        {isSubmitting ? "Saving..." : "Submit games and vibe"}
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

  function showToast(message: string) {
    setError("");
    setToast(message);
  }
}

function fromBgg(game: BggGameDetails): GameDraft {
  return { ...game, manualOverrides: false };
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

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-stone-800">
      {label}
      <input
        type="number"
        min={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 rounded-md border border-stone-300 px-3 text-base outline-none focus:border-emerald-600"
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

function RadioCardGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: (ChoiceOption & { value: CompetitionPreference })[];
  selected: CompetitionPreference;
  onChange: (value: CompetitionPreference) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold text-stone-900">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const checked = selected === option.value;
          return (
            <label
              key={option.value}
              className={choiceClass(checked)}
            >
              <input
                type="radio"
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className={indicatorClass(checked, "radio")} aria-hidden="true" />
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
              <span className={indicatorClass(checked, "checkbox")} aria-hidden="true" />
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

function indicatorClass(checked: boolean, shape: "checkbox" | "radio") {
  return [
    "mt-0.5 grid size-5 shrink-0 place-items-center border",
    shape === "radio" ? "rounded-full" : "rounded",
    checked ? "border-emerald-700 bg-emerald-700 shadow-inner" : "border-stone-400 bg-white",
  ].join(" ");
}

function selectedCount(themes: string[], tones: string[]) {
  const count = themes.length + tones.length;
  return count === 1 ? "1 theme/mood pick" : `${count} theme/mood picks`;
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}
