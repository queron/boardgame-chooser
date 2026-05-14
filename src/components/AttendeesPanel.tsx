"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
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
  const { showToast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const preferenceIds = new Set(preferenceByParticipant);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const response = await fetch(`/api/nights/${slug}/attendees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    const payload = await response.json();

    if (!response.ok) {
      showToast(payload.error ?? "Could not add attendee.");
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

      <div className="mb-4 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
        <p className="font-semibold">Step 1: Add yourself and set your vibe</p>
        <p className="mt-1 leading-5">Add your name, then use Set vibe to tell the group what kind of night you want.</p>
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
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className="inline-flex min-w-0 items-center gap-2 font-medium">
                    <PersonIcon />
                    {participant.displayName}
                  </span>
                  <span className="text-xs text-stone-500">{hasVibe ? "vibe saved" : "needs vibe"}</span>
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

function PersonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 shrink-0 text-stone-500"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
