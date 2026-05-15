"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import type { FeedbackReason, GameCandidate, LearnedPreferenceProfile, Participant, PostNightFeedback } from "@/lib/types";

const reasonOptions: { value: FeedbackReason; label: string }[] = [
  { value: "too_long", label: "Too long" },
  { value: "too_heavy", label: "Too heavy" },
  { value: "not_interactive", label: "Not interactive" },
  { value: "too_conflict_heavy", label: "Too much conflict" },
  { value: "great_fit", label: "Great fit" },
  { value: "wrong_player_count", label: "Wrong player count" },
];

export function PostNightFeedbackPanel({
  slug,
  games,
  participants,
  feedback,
}: {
  slug: string;
  games: GameCandidate[];
  participants: Participant[];
  feedback: PostNightFeedback[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [participantId, setParticipantId] = useState("");
  const [gameCandidateId, setGameCandidateId] = useState(games[0]?.id ?? "");
  const [wasPlayed, setWasPlayed] = useState(true);
  const [enjoyment, setEnjoyment] = useState(4);
  const [wouldPlayAgain, setWouldPlayAgain] = useState(true);
  const [reasonTags, setReasonTags] = useState<FeedbackReason[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (games.length === 0) return null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const participant = participants.find((item) => item.id === participantId);
    const response = await fetch(`/api/nights/${slug}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId: participantId || undefined,
        participantName: participant?.displayName,
        gameCandidateId,
        wasPlayed,
        enjoyment: wasPlayed ? enjoyment : undefined,
        wouldPlayAgain: wasPlayed ? wouldPlayAgain : undefined,
        reasonTags,
      }),
    });
    const payload = await parseJsonResponse(response);

    if (!response.ok) {
      showToast(payload.error ?? "Could not save feedback.");
      setIsSubmitting(false);
      return;
    }

    if (payload.learnedProfile) {
      window.localStorage.setItem("boardgame-chooser:learnedProfile", JSON.stringify(payload.learnedProfile));
    }

    setReasonTags([]);
    setIsSubmitting(false);
    showToast("Feedback saved. Future recommendations can use this as a small preference signal.", {
      title: "Thanks, that helps the algorithm",
    });
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h3 className="font-semibold text-stone-950">After the night</h3>
          <p className="mt-1 text-sm text-stone-600">Record what landed so future recommendations can learn gently.</p>
        </div>
        <span className="text-xs font-semibold text-stone-500">{feedback.length} feedback entries</span>
      </div>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-stone-800">
            Game
            <select
              value={gameCandidateId}
              onChange={(event) => setGameCandidateId(event.target.value)}
              className="h-10 rounded-md border border-stone-300 bg-white px-3 text-base outline-none focus:border-emerald-600"
            >
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.title}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-800">
            Who is giving feedback?
            <select
              value={participantId}
              onChange={(event) => setParticipantId(event.target.value)}
              className="h-10 rounded-md border border-stone-300 bg-white px-3 text-base outline-none focus:border-emerald-600"
            >
              <option value="">Group / anonymous</option>
              {participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold text-stone-800">
          <input
            type="checkbox"
            checked={wasPlayed}
            onChange={(event) => setWasPlayed(event.target.checked)}
            className="size-4 accent-emerald-700"
          />
          We played this
        </label>

        {wasPlayed ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-stone-800">
              Enjoyment
              <select
                value={enjoyment}
                onChange={(event) => setEnjoyment(Number(event.target.value))}
                className="h-10 rounded-md border border-stone-300 bg-white px-3 text-base outline-none focus:border-emerald-600"
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}/5
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-stone-800">
              Would play again?
              <select
                value={wouldPlayAgain ? "yes" : "no"}
                onChange={(event) => setWouldPlayAgain(event.target.value === "yes")}
                className="h-10 rounded-md border border-stone-300 bg-white px-3 text-base outline-none focus:border-emerald-600"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>
        ) : null}

        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-stone-900">Reason tags</legend>
          <div className="flex flex-wrap gap-2">
            {reasonOptions.map((option) => {
              const active = reasonTags.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setReasonTags((current) =>
                      current.includes(option.value)
                        ? current.filter((value) => value !== option.value)
                        : [...current, option.value],
                    )
                  }
                  className={[
                    "rounded-md border px-3 py-1.5 text-sm font-semibold",
                    active ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-stone-300 bg-white text-stone-700",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <button
          disabled={isSubmitting}
          className="h-10 justify-self-start rounded-md bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {isSubmitting ? "Saving feedback..." : "Save feedback"}
        </button>
      </form>
    </section>
  );
}

async function parseJsonResponse(response: Response): Promise<{ error?: string; learnedProfile?: LearnedPreferenceProfile }> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: "The server returned an unreadable response. Check the deployment logs." };
  }
}
