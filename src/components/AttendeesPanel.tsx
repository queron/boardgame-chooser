"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Participant } from "@/lib/types";

export function AttendeesPanel({
  slug,
  participants,
  preferenceByParticipant,
}: {
  slug: string;
  participants: Participant[];
  preferenceByParticipant: string[];
}) {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const preferenceIds = new Set(preferenceByParticipant);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const response = await fetch(`/api/nights/${slug}/attendees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Could not add attendee.");
      setIsSubmitting(false);
      return;
    }

    setDisplayName("");
    setIsAdding(false);
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-stone-950">Attendees</h2>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50"
        >
          Add attendee
        </button>
      </div>

      {participants.length === 0 ? (
        <p className="rounded-md bg-stone-50 p-3 text-sm text-stone-600">
          No attendees yet. Add known players now or share the link so people can join.
        </p>
      ) : (
        <ul className="grid gap-2">
          {participants.map((participant) => {
            const hasVibe = preferenceIds.has(participant.id);
            return (
              <li
                key={participant.id}
                className="flex items-center justify-between gap-3 rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-800"
              >
                <span>
                  <span className="font-medium">{participant.displayName}</span>
                  <span className="ml-2 text-xs text-stone-500">{hasVibe ? "vibe saved" : "needs vibe"}</span>
                </span>
                <Link
                  href={`/n/${slug}/vibe?participantId=${participant.id}`}
                  className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-semibold text-stone-800 hover:bg-stone-100"
                >
                  {hasVibe ? "Update vibe" : "Set vibe"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {isAdding ? (
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 rounded-md border border-stone-200 bg-stone-50 p-3">
          <label className="grid gap-2 text-sm font-medium text-stone-800">
            Attendee name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="h-10 rounded-md border border-stone-300 bg-white px-3 text-base outline-none focus:border-emerald-600"
              required
            />
          </label>
          {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              disabled={isSubmitting}
              className="h-10 rounded-md bg-stone-900 px-3 text-sm font-semibold text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              {isSubmitting ? "Adding..." : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDisplayName("");
                setError("");
                setIsAdding(false);
              }}
              className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 hover:bg-stone-100"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
