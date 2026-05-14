"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

export function AddAttendeeForm({ slug }: { slug: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsOpen(false);
    setIsSubmitting(false);
    router.refresh();
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 hover:bg-stone-50"
      >
        Add attendee
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-md border border-stone-200 bg-stone-50 p-3">
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
            setIsOpen(false);
          }}
          className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 hover:bg-stone-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
