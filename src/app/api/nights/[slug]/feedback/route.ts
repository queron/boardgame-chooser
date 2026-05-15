import { NextResponse } from "next/server";
import { feedbackSubmissionSchema } from "@/lib/schemas";
import { addFeedback } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const parsed = feedbackSubmissionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Check the feedback details, then try again." }, { status: 400 });
    }

    const result = await addFeedback(slug, parsed.data);
    if (!result) {
      return NextResponse.json({ error: "Night not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to save feedback", error);
    const message = error instanceof Error ? error.message : "Could not save feedback.";
    const isConfigError = message.includes("Production persistence is not configured");

    return NextResponse.json(
      { error: isConfigError ? message : "Could not save feedback. Check the server persistence configuration." },
      { status: isConfigError ? 503 : 500 },
    );
  }
}
