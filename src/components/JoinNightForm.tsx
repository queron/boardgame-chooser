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

const themeOptions = [
  ["fantasy", "Fantasy"],
  ["sciFi", "Sci-fi"],
  ["pirate", "Pirate"],
  ["historical", "Historical"],
  ["abstract", "Abstract"],
  ["horror", "Horror"],
];

const toneOptions = [
  ["casual", "Casual"],
  ["banter", "Banter"],
  ["crunchy", "Crunchy"],
  ["cinematic", "Cinematic"],
  ["chaotic", "Chaotic"],
];

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function search(index: number) {
    const query = games[index]?.title.trim();
    if (!query) return;
    const response = await fetch(`/api/bgg/search?query=${encodeURIComponent(query)}`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "BoardGameGeek search is unavailable. Manual entry still works.");
      return;
    }
    setError("");
    setSearches((current) => ({ ...current, [index]: payload.results ?? [] }));
  }

  async function selectBggGame(index: number, result: BggSearchResult) {
    const response = await fetch(`/api/bgg/thing?id=${result.bggId}`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Could not fetch game details.");
      return;
    }
    updateGame(index, fromBgg(payload.game));
    setSearches((current) => ({ ...current, [index]: [] }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const validGames = games.filter((game) => game.title.trim());
    const response = await fetch(`/api/nights/${slug}/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
    router.push(`/n/${slug}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-8">
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
            <p className="text-xs text-stone-500">
              BGG data can be corrected here. Edited values are saved as manual overrides.
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-stone-950">Tonight&apos;s vibe</h2>
        <Range label="Challenge" value={challenge} onChange={setChallenge} low="Easygoing" high="Brain-burning" />
        <Range label="Interaction" value={interaction} onChange={setInteraction} low="Heads down" high="Table talk" />

        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-stone-800">Competitive feel</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["either", "competitive", "cooperative"] as CompetitionPreference[]).map((option) => (
              <label key={option} className="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-2 text-sm">
                <input
                  type="radio"
                  checked={competition === option}
                  onChange={() => setCompetition(option)}
                  className="accent-emerald-700"
                />
                {option[0].toUpperCase() + option.slice(1)}
              </label>
            ))}
          </div>
        </fieldset>

        <CheckboxGroup label="Themes" options={themeOptions} selected={themes} onChange={setThemes} />
        <CheckboxGroup label="Mood" options={toneOptions} selected={tones} onChange={setTones} />
        <Range label="Maximum play time" value={maxPlayTime} onChange={setMaxPlayTime} min={30} max={360} step={30} low="30m" high="6h" />
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
}

function fromBgg(game: BggGameDetails): GameDraft {
  return { ...game, manualOverrides: false };
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
  min = 1,
  max = 5,
  step = 1,
  low,
  high,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  low: string;
  high: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-stone-800">
      <span className="flex justify-between">
        {label}
        <span className="text-stone-500">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-emerald-700"
      />
      <span className="flex justify-between text-xs font-medium text-stone-500">
        <span>{low}</span>
        <span>{high}</span>
      </span>
    </label>
  );
}

function CheckboxGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[][];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold text-stone-800">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map(([value, text]) => (
          <label key={value} className="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(value)}
              onChange={() => toggle(value)}
              className="accent-emerald-700"
            />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
