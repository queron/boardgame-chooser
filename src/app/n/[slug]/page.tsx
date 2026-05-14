import Link from "next/link";
import { notFound } from "next/navigation";
import { AttendeesPanel } from "@/components/AttendeesPanel";
import { NightDetailsEditor } from "@/components/NightDetailsEditor";
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
  const preferenceByParticipant = night.preferences.map((preference) => preference.participantId);

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-8">
        <header className="grid gap-5 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <Link href="/" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">
                Board Game Chooser
              </Link>
              <div className="mt-2">
                <NightDetailsEditor night={night} />
              </div>
            </div>
            <ShareActions slug={slug} />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Metric label="Attendees" value={night.participants.length} />
          <Metric label="Games being brought" value={night.games.length} />
          <Metric label="Compatible games" value={night.games.length - recommendation.exclusions.length} />
        </section>

        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="grid content-start gap-5">
            <AttendeesPanel
              slug={slug}
              participants={night.participants}
              preferenceByParticipant={preferenceByParticipant}
            />

            <Panel
              title="Games being brought"
              action={
                <Link
                  href={`/n/${slug}/games`}
                  className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50"
                >
                  Add games
                </Link>
              }
            >
              {night.games.length === 0 ? (
                <EmptyState text="The pool is empty. Attendees can optionally add games they are bringing." />
              ) : (
                <div className="grid gap-3">
                  {night.games.map((game) => (
                    <article key={game.id} className="rounded-md border border-stone-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-stone-950">{game.title}</h3>
                        <Link
                          href={`/n/${slug}/games?gameId=${game.id}`}
                          className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-semibold text-stone-800 hover:bg-stone-100"
                        >
                          Edit
                        </Link>
                      </div>
                      <p className="mt-1 text-xs text-stone-600">
                        {game.minPlayers}-{game.maxPlayers} players | {formatPlayTime(game)}
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

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-stone-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-md bg-stone-50 p-3 text-sm text-stone-600">{text}</p>;
}
