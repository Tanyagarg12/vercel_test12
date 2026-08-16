// Server route behind the copilot chat panel.
//
// The widget is a client component, so it cannot read API_BASE_URL (which is
// deliberately server-only). It posts here instead; this route runs the tool
// layer against the platform API and returns the finished answer.

import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/copilot/router";
import { askPlatformCopilot } from "@/lib/copilot/serverAsk";

export async function POST(request: Request) {
  let question = "";
  try {
    const body = (await request.json()) as { question?: unknown };
    question = typeof body.question === "string" ? body.question : "";
  } catch {
    return NextResponse.json({ error: "Expected a JSON body with a `question` string." }, { status: 400 });
  }

  if (!question.trim()) {
    return NextResponse.json({ error: "`question` must not be empty." }, { status: 400 });
  }

  try {
    // The tool layer produces the grounded answer. The platform's own copilot is
    // asked in parallel purely for its prose, which is only present once an LLM
    // key is configured on that side.
    const [answer, platform] = await Promise.all([
      answerQuestion(question),
      askPlatformCopilot(question).catch(() => null),
    ]);

    return NextResponse.json({
      ...answer,
      platformAnswer: platform?.llmUsed ? platform.answer : null,
      platformNote: platform?.note ?? null,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Copilot failed: ${reason}` }, { status: 500 });
  }
}
