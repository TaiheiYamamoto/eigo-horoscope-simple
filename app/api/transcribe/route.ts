// ---------- app/api/transcribe/route.ts ----------
// STT: audio/webm → text (Whisper)
import { NextResponse } from "next/server";
import { openai } from "../_lib/openai";
export const runtime = "edge";
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const lang = (form.get("lang") as string) || "en"; // "en" or "ja"
    if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });
    const tr = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "json",
      temperature: 0.2,
      language: lang
    });
    return NextResponse.json({ text: tr.text ?? "" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "transcribe failed" }, { status: 500 });
  }
}
