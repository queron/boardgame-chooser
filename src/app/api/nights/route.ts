import { NextResponse } from "next/server";
import { createNightSchema } from "@/lib/schemas";
import { createNight } from "@/lib/store";

export async function POST(request: Request) {
  const parsed = createNightSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the night name and try again." }, { status: 400 });
  }

  const night = await createNight(parsed.data);
  return NextResponse.json({ night });
}
