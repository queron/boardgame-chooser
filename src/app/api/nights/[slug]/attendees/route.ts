import { NextResponse } from "next/server";
import { attendeeInputSchema } from "@/lib/schemas";
import { addAttendee } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const parsed = attendeeInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter an attendee name and try again." }, { status: 400 });
    }

    const result = await addAttendee(slug, parsed.data);
    if (!result) {
      return NextResponse.json({ error: "Night not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to add attendee", error);
    const message = error instanceof Error ? error.message : "Could not add attendee.";
    const isConfigError = message.includes("Production persistence is not configured");

    return NextResponse.json(
      { error: isConfigError ? message : "Could not add attendee. Check the server persistence configuration." },
      { status: isConfigError ? 503 : 500 },
    );
  }
}
