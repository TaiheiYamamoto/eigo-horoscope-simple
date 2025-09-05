import { NextResponse } from "next/server";
import { openai } from "../_lib/openai";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { history, question } = await req.json();

    const sys =
      "You are a friendly ESL tutor giving astrology-themed advice. " +
      "Answer first in simple English (4-6 sentences, CEFR A2-B1), then add Japanese translation.";

    const user =
      `Context (previous horoscope JSON): ${JSON.stringify(history).slice(0, 2000)}\n` +
      `Learner question (English): ${question}`;

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ]
    });

    const content = r.choices[0]?.message?.content ?? "";
    return NextResponse.json({ content });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "chat failed" }, { status: 500 });
  }
}
