import { NextResponse } from "next/server";
import { preferenceSubmissionSchema } from "@/lib/schemas";
import { savePreference } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const parsed = preferenceSubmissionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Check the attendee and vibe details, then try again." },
        { status: 400 },
      );
    }

    const result = await savePreference(slug, parsed.data);
    if (!result) {
      return NextResponse.json({ error: "Night not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to save vibe", error);
    const message = error instanceof Error ? error.message : "Could not save vibe.";
    const isConfigError = message.includes("Production persistence is not configured");

    return NextResponse.json(
      { error: isConfigError ? message : "Could not save vibe. Check the server persistence configuration." },
      { status: isConfigError ? 503 : 500 },
    );
  }
}
