import { NextResponse } from "next/server";
import { getBggGame } from "@/lib/bgg";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "A valid BGG id is required." }, { status: 400 });
  }

  if (!process.env.BGG_APP_TOKEN) {
    return NextResponse.json(
      { error: "Set BGG_APP_TOKEN to enable BoardGameGeek lookup. Manual entry still works." },
      { status: 503 },
    );
  }

  try {
    const game = await getBggGame(id);
    if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 });
    return NextResponse.json({ game });
  } catch {
    return NextResponse.json({ error: "BoardGameGeek details are unavailable right now." }, { status: 502 });
  }
}
