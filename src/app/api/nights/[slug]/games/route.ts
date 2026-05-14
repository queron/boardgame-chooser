import { NextResponse } from "next/server";
import { gamesSubmissionSchema } from "@/lib/schemas";
import { saveGames } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const parsed = gamesSubmissionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Check the game details, then try again. Player counts and play times need positive numbers." },
        { status: 400 },
      );
    }

    const result = await saveGames(slug, parsed.data);
    if (!result) {
      return NextResponse.json({ error: "Night not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to save games", error);
    const message = error instanceof Error ? error.message : "Could not save games.";
    const isConfigError = message.includes("Production persistence is not configured");

    return NextResponse.json(
      { error: isConfigError ? message : "Could not save games. Check the server persistence configuration." },
      { status: isConfigError ? 503 : 500 },
    );
  }
}
