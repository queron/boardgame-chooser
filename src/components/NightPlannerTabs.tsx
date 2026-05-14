"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CreateNightForm } from "@/components/CreateNightForm";
import { useToast } from "@/components/ToastProvider";
import type { GameNightRecord } from "@/lib/types";

type Tab = "new" | "existing";

export function NightPlannerTabs({ nights }: { nights: GameNightRecord[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("new");
  const [savedNights, setSavedNights] = useState(nights);
  const sortedNights = useMemo(() => sortByDateDescending(savedNights), [savedNights]);
  const grouped = useMemo(() => groupByMonth(sortedNights), [sortedNights]);

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="grid grid-cols-2 gap-1 rounded-md bg-stone-100 p-1" role="tablist" aria-label="Night planner">
        <TabButton active={activeTab === "new"} onClick={() => setActiveTab("new")}>
          New night
        </TabButton>
        <TabButton active={activeTab === "existing"} onClick={() => setActiveTab("existing")}>
          Existing nights
        </TabButton>
      </div>

      <div className="mt-6">
        {activeTab === "new" ? (
          <CreateNightForm framed={false} />
        ) : (
          <ExistingNightCalendar
            grouped={grouped}
            onDeleted={(slug) => setSavedNights((current) => current.filter((night) => night.slug !== slug))}
          />
        )}
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "h-10 rounded px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2",
        active ? "bg-white text-stone-950 shadow-sm" : "text-stone-600 hover:text-stone-950",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ExistingNightCalendar({
  grouped,
  onDeleted,
}: {
  grouped: [string, GameNightRecord[]][];
  onDeleted: (slug: string) => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [nightToDelete, setNightToDelete] = useState<GameNightRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function confirmDelete() {
    if (!nightToDelete) return;

    setIsDeleting(true);

    const response = await fetch(`/api/nights/${nightToDelete.slug}`, { method: "DELETE" });
    const payload = await parseJsonResponse(response);

    if (!response.ok) {
      showToast(payload.error ?? "Could not delete this night.");
      setIsDeleting(false);
      return;
    }

    onDeleted(nightToDelete.slug);
    setNightToDelete(null);
    setIsDeleting(false);
    router.refresh();
  }

  if (grouped.length === 0) {
    return (
      <p className="rounded-md border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
        No saved nights yet. Create one here and it will appear in this calendar.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {grouped.map(([month, monthNights]) => (
        <div key={month} className="grid gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">{month}</h2>
          <div className="grid gap-2">
            {monthNights.map((night) => (
              <NightRow key={night.slug} night={night} onDelete={() => setNightToDelete(night)} />
            ))}
          </div>
        </div>
      ))}
      {nightToDelete ? (
        <DeleteNightDialog
          night={nightToDelete}
          isDeleting={isDeleting}
          onCancel={() => {
            if (!isDeleting) {
              setNightToDelete(null);
            }
          }}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}

function NightRow({ night, onDelete }: { night: GameNightRecord; onDelete: () => void }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-3">
      <Link href={`/n/${night.slug}`} className="grid min-w-0 gap-1 text-stone-900 hover:text-emerald-700">
        <span className="truncate font-semibold">{night.title}</span>
        <span className="text-xs text-stone-600">
          {formatDate(getNightDate(night))} | {night.participants.length} attendees | {night.games.length} games
        </span>
      </Link>
      <button
        type="button"
        onClick={onDelete}
        className="rounded border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 hover:border-rose-500 hover:bg-rose-50"
      >
        Delete
      </button>
    </div>
  );
}

function DeleteNightDialog({
  night,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  night: GameNightRecord;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-stone-950/35 px-4" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-night-title"
        aria-describedby="delete-night-description"
        className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-5 shadow-xl"
      >
        <h2 id="delete-night-title" className="text-lg font-semibold text-stone-950">
          Delete this night?
        </h2>
        <p id="delete-night-description" className="mt-2 text-sm leading-6 text-stone-600">
          This will permanently delete <strong className="font-semibold text-stone-900">{night.title}</strong> and
          remove its attendees, games, and vibes.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="h-10 rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-900 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-10 rounded-md bg-rose-700 px-4 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {isDeleting ? "Deleting..." : "Delete night"}
          </button>
        </div>
      </div>
    </div>
  );
}

function sortByDateDescending(nights: GameNightRecord[]) {
  return [...nights].sort((a, b) => getNightDate(b).getTime() - getNightDate(a).getTime());
}

function groupByMonth(nights: GameNightRecord[]): [string, GameNightRecord[]][] {
  const groups = new Map<string, GameNightRecord[]>();
  for (const night of nights) {
    const date = getNightDate(night);
    const label = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric" }).format(date);
    groups.set(label, [...(groups.get(label) ?? []), night]);
  }
  return Array.from(groups.entries());
}

function getNightDate(night: GameNightRecord) {
  return new Date(night.eventDate || night.updatedAt || night.createdAt);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" }).format(
    value,
  );
}

async function parseJsonResponse(response: Response): Promise<{ error?: string }> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: "The server returned an unreadable response. Check the deployment logs." };
  }
}
