"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameNightRecord } from "@/lib/types";

export function NightDetailsEditor({ night }: { night: GameNightRecord }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(night.title);
  const [eventDate, setEventDate] = useState(toDateTimeInput(night.eventDate));
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const response = await fetch(`/api/nights/${night.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, eventDate }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Could not update the night.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setIsEditing(false);
    router.refresh();
  }

  function cancel() {
    setTitle(night.title);
    setEventDate(toDateTimeInput(night.eventDate));
    setError("");
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <form onSubmit={onSubmit} className="grid w-full max-w-2xl gap-3 rounded-md border border-stone-200 bg-stone-50 p-3">
        <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
          <label className="grid gap-1 text-sm font-medium text-stone-800">
            Night name
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-10 min-w-0 rounded-md border border-stone-300 bg-white px-3 text-base outline-none focus:border-emerald-600"
              required
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-stone-800">
            Date and time
            <input
              type="datetime-local"
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
              className="h-10 min-w-0 rounded-md border border-stone-300 bg-white px-3 text-base outline-none focus:border-emerald-600"
            />
          </label>
        </div>
        {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button
            disabled={isSubmitting}
            className="h-9 rounded-md bg-stone-900 px-3 text-sm font-semibold text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={cancel}
            className="h-9 rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 hover:bg-stone-100"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-3xl font-semibold text-stone-950">{night.title}</h1>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-semibold text-stone-800 hover:bg-stone-100"
        >
          Edit
        </button>
      </div>
      <p className="mt-2 text-sm text-stone-600">
        {night.eventDate ? `Scheduled for ${formatDate(night.eventDate)}` : "No date set"} | Invite code {night.slug}
      </p>
    </div>
  );
}

function toDateTimeInput(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 16);

  const localDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
