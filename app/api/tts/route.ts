// ---------- app/api/tts/route.ts ----------
// TTS: 英文を音声化（mp3）して返す
import { NextResponse } from "next/server";
import { openai } from "../_lib/openai";
export const runtime = "edge";
export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text) return new NextResponse("no text", { status: 400 });
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts", // 2025時点のTTSモデル想定
      voice: "alloy", // 適宜変更: alloy/verse/coral 等
      input: text,
      format: "mp3"
    });
    const arrayBuffer = await speech.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store"
      }
    });
  } catch (e: any) {
    return new NextResponse(e?.message ?? "tts failed", { status: 500 });
  }
}
