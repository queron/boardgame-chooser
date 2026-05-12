import type { Recommendation } from "@/lib/types";

export function ResultsPanel({ recommendation }: { recommendation: Recommendation }) {
  const hasResults = recommendation.rankedGames.length > 0;

  return (
    <section className="grid gap-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Recommendation</p>
        <h2 className="mt-1 text-2xl font-semibold text-stone-950">Best fit for tonight</h2>
      </div>

      {!hasResults ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Add at least one compatible game and one player submission to unlock the recommendation.
        </div>
      ) : null}

      <div className="grid gap-4">
        {recommendation.rankedGames.map((ranked, index) => (
          <article key={ranked.game.id} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row">
              {ranked.game.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ranked.game.imageUrl}
                  alt=""
                  className="h-28 w-20 rounded-md object-cover"
                  loading="lazy"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">#{index + 1}</p>
                    <h3 className="text-xl font-semibold text-stone-950">{ranked.game.title}</h3>
                  </div>
                  <span className="rounded-md bg-stone-900 px-3 py-1 text-sm font-semibold text-white">
                    {ranked.score}/115
                  </span>
                </div>
                <p className="mt-2 text-sm text-stone-600">
                  {ranked.game.minPlayers}-{ranked.game.maxPlayers} players · {ranked.game.playingTime} min
                  {ranked.game.weight ? ` · weight ${ranked.game.weight}` : ""}
                </p>
                <ul className="mt-3 grid gap-1 text-sm text-stone-700">
                  {ranked.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
        <h3 className="font-semibold text-sky-950">Suggested play order</h3>
        <ol className="mt-2 grid gap-1 text-sm text-sky-950">
          {recommendation.suggestedOrder.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      {recommendation.exclusions.length > 0 ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <h3 className="font-semibold text-rose-950">Excluded by player count</h3>
          <ul className="mt-2 grid gap-1 text-sm text-rose-950">
            {recommendation.exclusions.map((excluded) => (
              <li key={excluded.game.id}>{excluded.reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
