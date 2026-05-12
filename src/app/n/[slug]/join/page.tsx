import Link from "next/link";
import { notFound } from "next/navigation";
import { JoinNightForm } from "@/components/JoinNightForm";
import { getNight } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function JoinNightPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const night = await getNight(slug);
  if (!night) notFound();

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto grid w-full max-w-4xl gap-6 px-5 py-8">
        <header>
          <Link href={`/n/${slug}`} className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">
            Back to dashboard
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">Join {night.title}</h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            Add the games you can bring, then describe what kind of night you want. BGG lookup fills the boring
            details; you can correct anything before submitting.
          </p>
        </header>
        <JoinNightForm slug={slug} />
        <footer className="text-xs leading-5 text-stone-500">
          Board game metadata is retrieved from BoardGameGeek&apos;s XML API. BGG content and trademarks belong to
          their respective owners.
        </footer>
      </div>
    </main>
  );
}
