import { NextResponse } from "next/server";
import { openai } from "../_lib/openai";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text) return new NextResponse("no text", { status: 400 });

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",     // 好みで verse / coral などに変更可
      input: text,
      format: "mp3"
    });

    const buf = await speech.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: { "content-type": "audio/mpeg", "cache-control": "no-store" }
    });
  } catch (e: any) {
    return new NextResponse(e?.message ?? "tts failed", { status: 500 });
  }
}
