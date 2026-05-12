import { NextResponse } from "next/server";
import { recommendGames } from "@/lib/recommendation";
import { getNight } from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const night = await getNight(slug);
  if (!night) {
    return NextResponse.json({ error: "Night not found." }, { status: 404 });
  }

  return NextResponse.json({ night, recommendation: recommendGames(night) });
}
