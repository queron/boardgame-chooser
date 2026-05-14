import { NextResponse } from "next/server";
import { updateNightSchema } from "@/lib/schemas";
import { recommendGames } from "@/lib/recommendation";
import { deleteNight, getNight, updateNightDetails } from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const night = await getNight(slug);
  if (!night) {
    return NextResponse.json({ error: "Night not found." }, { status: 404 });
  }

  return NextResponse.json({ night, recommendation: recommendGames(night) });
}

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const parsed = updateNightSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Check the night name and date, then try again." }, { status: 400 });
    }

    const night = await updateNightDetails(slug, parsed.data);
    if (!night) {
      return NextResponse.json({ error: "Night not found." }, { status: 404 });
    }

    return NextResponse.json({ night });
  } catch (error) {
    console.error("Failed to update game night", error);
    const message = error instanceof Error ? error.message : "Could not update the game night.";
    const isConfigError = message.includes("Production persistence is not configured");

    return NextResponse.json(
      { error: isConfigError ? message : "Could not update the game night. Check the server persistence configuration." },
      { status: isConfigError ? 503 : 500 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const deleted = await deleteNight(slug);
    if (!deleted) {
      return NextResponse.json({ error: "Night not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete game night", error);
    const message = error instanceof Error ? error.message : "Could not delete the game night.";
    const isConfigError = message.includes("Production persistence is not configured");

    return NextResponse.json(
      { error: isConfigError ? message : "Could not delete the game night. Check the server persistence configuration." },
      { status: isConfigError ? 503 : 500 },
    );
  }
}
