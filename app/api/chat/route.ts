// ---------- app/api/chat/route.ts ----------
// 追質問: 英語の質問（STT or 入力）→ 英文回答 + 日本語訳を返す
import { NextResponse } from "next/server";
import { openai } from "../_lib/openai";
export const runtime = "edge";
export async function POST(req: Request) {
  try {
    const { history, question } = await req.json();
    const sys = "You are a friendly ESL tutor giving astrology-themed advice. CEFR A2-B1 English. Be practical.";
    const user = `Answer concisely in English first (4-6 sentences), then provide a Japanese translation.\nContext (previous horoscope or info): ${JSON.stringify(history).slice(0, 2000)}\nLearner question: ${question}`;
    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ]
    });
    const content = r.choices[0]?.message?.content ?? "";
    // simple split: English then JP — we keep both as fields
    return NextResponse.json({ content });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "chat failed" }, { status: 500 });
  }
}
