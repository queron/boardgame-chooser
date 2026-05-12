"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CreateNightForm() {
  const router = useRouter();
  const [title, setTitle] = useState("Next board game night");
  const [eventDate, setEventDate] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const response = await fetch("/api/nights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, eventDate }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Could not create a game night.");
      setIsSubmitting(false);
      return;
    }

    router.push(`/n/${payload.night.slug}`);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <label className="grid gap-2 text-sm font-medium text-stone-800">
        Night name
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-11 rounded-md border border-stone-300 px-3 text-base outline-none focus:border-emerald-600"
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-stone-800">
        Date and time
        <input
          type="datetime-local"
          value={eventDate}
          onChange={(event) => setEventDate(event.target.value)}
          className="h-11 rounded-md border border-stone-300 px-3 text-base outline-none focus:border-emerald-600"
        />
      </label>
      {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
      <button
        disabled={isSubmitting}
        className="h-11 rounded-md bg-emerald-700 px-4 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-400"
      >
        {isSubmitting ? "Creating..." : "Create shared night"}
      </button>
    </form>
  );
}
