import Link from "next/link";
import { notFound } from "next/navigation";
import { JoinNightForm } from "@/components/JoinNightForm";
import { getNight } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function VibePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ participantId?: string }>;
}) {
  const { slug } = await params;
  const { participantId } = await searchParams;
  const night = await getNight(slug);
  if (!night) notFound();
  const participant = night.participants.find((item) => item.id === participantId);

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto grid w-full max-w-4xl gap-6 px-5 py-8">
        <header>
          <Link href={`/n/${slug}`} className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">
            Back to dashboard
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">
            Set your vibe{participant ? `, ${participant.displayName}` : ""}
          </h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            Tell the group what kind of game night you want. This does not change the games being brought.
          </p>
        </header>
        <JoinNightForm initialNight={night} initialParticipantId={participantId} mode="vibe" />
      </div>
    </main>
  );
}
