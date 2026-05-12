import { NextResponse } from "next/server";
import { submissionSchema } from "@/lib/schemas";
import { addSubmission } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const parsed = submissionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Check your games and preferences, then try again." }, { status: 400 });
  }

  const night = await addSubmission(slug, parsed.data);
  if (!night) {
    return NextResponse.json({ error: "Night not found." }, { status: 404 });
  }

  return NextResponse.json({ night });
}
