import Link from "next/link";
import { notFound } from "next/navigation";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ShareActions } from "@/components/ShareActions";
import { formatPlayTime } from "@/lib/playtime";
import { recommendGames } from "@/lib/recommendation";
import { getNight } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function NightDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const night = await getNight(slug);
  if (!night) notFound();

  const recommendation = recommendGames(night);
  const submitterName = new Map(night.participants.map((participant) => [participant.id, participant.displayName]));

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-8">
        <header className="grid gap-5 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <Link href="/" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">
                Board Game Chooser
              </Link>
              <h1 className="mt-2 text-3xl font-semibold text-stone-950">{night.title}</h1>
              <p className="mt-2 text-sm text-stone-600">
                {night.eventDate ? `Scheduled for ${formatDate(night.eventDate)}` : "No date set"} · Invite code {night.slug}
              </p>
            </div>
            <ShareActions slug={slug} />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Metric label="Players submitted" value={night.participants.length} />
          <Metric label="Games in pool" value={night.games.length} />
          <Metric label="Compatible games" value={night.games.length - recommendation.exclusions.length} />
        </section>

        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="grid content-start gap-5">
            <Panel title="Players">
              {night.participants.length === 0 ? (
                <EmptyState text="No one has submitted yet. Share the link and let the table form itself." />
              ) : (
                <ul className="grid gap-2">
                  {night.participants.map((participant) => (
                    <li key={participant.id} className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-800">
                      {participant.displayName}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Game pool">
              {night.games.length === 0 ? (
                <EmptyState text="The pool is empty. Each player can add up to five games from BGG or manually." />
              ) : (
                <div className="grid gap-3">
                  {night.games.map((game) => (
                    <article key={game.id} className="rounded-md border border-stone-200 p-3">
                      <h3 className="font-semibold text-stone-950">{game.title}</h3>
                      <p className="mt-1 text-xs text-stone-600">
                        {game.minPlayers}-{game.maxPlayers} players · {formatPlayTime(game)} · brought by{" "}
                        {submitterName.get(game.submittedBy) ?? "someone"}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </Panel>
          </section>

          <ResultsPanel recommendation={recommendation} />
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-stone-600">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-stone-950">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-stone-950">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-md bg-stone-50 p-3 text-sm text-stone-600">{text}</p>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
