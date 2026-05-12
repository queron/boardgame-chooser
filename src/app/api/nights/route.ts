import { NextResponse } from "next/server";
import { createNightSchema } from "@/lib/schemas";
import { createNight } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const parsed = createNightSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Check the night name and try again." }, { status: 400 });
    }

    const night = await createNight(parsed.data);
    return NextResponse.json({ night });
  } catch (error) {
    console.error("Failed to create game night", error);
    const message = error instanceof Error ? error.message : "Could not create a game night.";
    const isConfigError = message.includes("Production persistence is not configured");

    return NextResponse.json(
      {
        error: isConfigError
          ? message
          : "Could not create a game night. Check the server persistence configuration.",
      },
      { status: isConfigError ? 503 : 500 },
    );
  }
}
