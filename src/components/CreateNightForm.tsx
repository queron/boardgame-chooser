"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

export function CreateNightForm({ framed = true }: { framed?: boolean }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [title, setTitle] = useState("Next board game night");
  const [eventDate, setEventDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const response = await fetch("/api/nights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, eventDate }),
    });
    const payload = await parseJsonResponse(response);

    if (!response.ok) {
      showToast(payload.error ?? "Could not create a game night.");
      setIsSubmitting(false);
      return;
    }

    if (!payload.night?.slug) {
      showToast("The server created an unreadable game night response.");
      setIsSubmitting(false);
      return;
    }

    router.push(`/n/${payload.night.slug}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className={[
        "grid gap-5",
        framed ? "rounded-lg border border-stone-200 bg-white p-5 shadow-sm" : "",
      ].join(" ")}
    >
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
      <button
        disabled={isSubmitting}
        className="h-11 rounded-md bg-emerald-700 px-4 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-400"
      >
        {isSubmitting ? "Creating..." : "Create shared night"}
      </button>
    </form>
  );
}

async function parseJsonResponse(response: Response): Promise<{ error?: string; night?: { slug: string } }> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: "The server returned an unreadable response. Check the deployment logs." };
  }
}
