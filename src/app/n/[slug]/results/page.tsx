import Link from "next/link";
import { notFound } from "next/navigation";
import { ResultsPanel } from "@/components/ResultsPanel";
import { recommendGames } from "@/lib/recommendation";
import { getNight } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const night = await getNight(slug);
  if (!night) notFound();

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto grid w-full max-w-4xl gap-6 px-5 py-8">
        <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <Link href={`/n/${slug}`} className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">
              Back to dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-semibold text-stone-950">{night.title}</h1>
          </div>
          <Link
            href={`/n/${slug}/join`}
            className="inline-flex h-10 items-center rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Add another submission
          </Link>
        </header>
        <ResultsPanel recommendation={recommendGames(night)} night={night} />
      </div>
    </main>
  );
}
