"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CreateNightForm } from "@/components/CreateNightForm";
import type { GameNightRecord } from "@/lib/types";

type Tab = "new" | "existing";

export function NightPlannerTabs({ nights }: { nights: GameNightRecord[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("new");
  const sortedNights = useMemo(() => sortByDateDescending(nights), [nights]);
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
        {activeTab === "new" ? <CreateNightForm framed={false} /> : <ExistingNightCalendar grouped={grouped} />}
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

function ExistingNightCalendar({ grouped }: { grouped: [string, GameNightRecord[]][] }) {
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
              <NightLink key={night.slug} night={night} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NightLink({ night }: { night: GameNightRecord }) {
  return (
    <Link
      href={`/n/${night.slug}`}
      className="grid gap-1 rounded-md border border-stone-200 bg-stone-50 px-3 py-3 text-stone-900 hover:border-emerald-500 hover:bg-emerald-50"
    >
      <span className="font-semibold">{night.title}</span>
      <span className="text-xs text-stone-600">
        {formatDate(getNightDate(night))} | {night.participants.length} attendees | {night.games.length} games
      </span>
    </Link>
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
