import { CreateNightForm } from "@/components/CreateNightForm";

export default function Home() {
  return (
    <main className="min-h-screen bg-stone-50">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Board Game Chooser</p>
          <h1 className="mt-4 text-4xl font-semibold text-stone-950 sm:text-6xl">
            Pick the right game for the people at the table.
          </h1>
          <p className="mt-5 text-lg leading-8 text-stone-600">
            Create a shared night, let friends add the games they can bring, collect the mood everyone wants,
            and get an explainable recommendation instead of a twenty minute negotiation.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-stone-700 sm:grid-cols-3">
            <div className="border-l-4 border-emerald-600 pl-3">Share-link access</div>
            <div className="border-l-4 border-sky-600 pl-3">BGG metadata lookup</div>
            <div className="border-l-4 border-amber-500 pl-3">Ranked play plan</div>
          </div>
        </div>
        <CreateNightForm />
      </section>
    </main>
  );
}
