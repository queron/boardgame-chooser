import { NextResponse } from "next/server";
import { searchBgg } from "@/lib/bgg";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  if (!process.env.BGG_APP_TOKEN) {
    return NextResponse.json(
      { error: "Set BGG_APP_TOKEN to enable BoardGameGeek lookup. Manual entry still works." },
      { status: 503 },
    );
  }

  try {
    const results = await searchBgg(query);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "BoardGameGeek search is unavailable right now." }, { status: 502 });
  }
}
