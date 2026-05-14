import Link from "next/link";
import { notFound } from "next/navigation";
import { JoinNightForm } from "@/components/JoinNightForm";
import { getNight } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function GamesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ gameId?: string }>;
}) {
  const { slug } = await params;
  const { gameId } = await searchParams;
  const night = await getNight(slug);
  if (!night) notFound();

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto grid w-full max-w-4xl gap-6 px-5 py-8">
        <header>
          <Link href={`/n/${slug}`} className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">
            Back to dashboard
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">Add games being brought</h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            Add the titles available for this night.
          </p>
        </header>
        <JoinNightForm initialNight={night} initialGameId={gameId} mode="games" />
      </div>
    </main>
  );
}
