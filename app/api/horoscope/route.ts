import { NextResponse } from "next/server";
import { openai } from "../_lib/openai";

export const runtime = "edge";

/** 生年月日(ISO)から12星座名（英語）を返す */
function zodiacFromISO(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Unknown";
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return (
    (m===3&&day>=21)||(m===4&&day<=19) ? "Aries" :
    (m===4&&day>=20)||(m===5&&day<=20) ? "Taurus" :
    (m===5&&day>=21)||(m===6&&day<=21) ? "Gemini" :
    (m===6&&day>=22)||(m===7&&day<=22) ? "Cancer" :
    (m===7&&day>=23)||(m===8&&day<=22) ? "Leo" :
    (m===8&&day>=23)||(m===9&&day<=22) ? "Virgo" :
    (m===9&&day>=23)||(m===10&&day<=23) ? "Libra" :
    (m===10&&day>=24)||(m===11&&day<=22) ? "Scorpio" :
    (m===11&&day>=23)||(m===12&&day<=21) ? "Sagittarius" :
    (m===12&&day>=22)||(m===1&&day<=19) ? "Capricorn" :
    (m===1&&day>=20)||(m===2&&day<=18) ? "Aquarius" : "Pisces"
  );
}

/** LLMの出力から最初のJSONブロックを安全に拾ってパース */
function parseFirstJsonBlock(text: string) {
  // ```json ... ``` で囲まれている場合を除去
  const cleaned = text.replace(/```json|```/g, "").trim();

  // そのままJSONとして読めるか試す
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 文章内に { ... } が混在する場合、最初のブロックを抽出
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }

  // 失敗したら空
  return {};
}

export async function POST(req: Request) {
  try {
    const { name, birthISO, topic } = await req.json();

    const sign = zodiacFromISO(birthISO);
    const sys =
      "You are an ESL-friendly horoscope tutor. Keep language CEFR A2–B1 and helpful for learners.";

    const user = `
Create a horoscope for the following user.

User:
- Name: ${name || "Learner"}
- Sign: ${sign}
- Topic: ${topic || "general"}

Return STRICT JSON ONLY with these keys (do not add any extra commentary):

{
  "title": string,
  "english": string,               // 6–8 sentences, simple English
  "japanese": string,              // natural Japanese translation
  "luckyColor": string,            // common color name in English (e.g., blue, emerald, lavender)
  "luckyNumber": number,           // integer 1–99
  "points": string[],              // 3–5 key points in English (short)
  "usefulPhrases": [ { "en": string, "ja": string } ], // 3–5 pairs
  "practicePrompts": string[]      // 3–5 learner questions in English
}
`.trim();

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ]
    });

    const content = r.choices[0]?.message?.content ?? "{}";
    const json = parseFirstJsonBlock(content);

    // 最低限のフォールバック
    const luckyNumber =
      Number.isFinite(json?.luckyNumber)
        ? Math.max(1, Math.min(99, Math.round(json.luckyNumber)))
        : Math.floor(Math.random() * 99) + 1;

    const luckyColor = (typeof json?.luckyColor === "string" && json.luckyColor) ? json.luckyColor : "blue";

    // 配列型の保険
    const points = Array.isArray(json?.points) ? json.points : [];
    const usefulPhrases = Array.isArray(json?.usefulPhrases) ? json.usefulPhrases : [];
    const practicePrompts = Array.isArray(json?.practicePrompts) ? json.practicePrompts : [];

    // 最終レスポンス
    return NextResponse.json({
      title: json?.title ?? `Your ${sign} reading`,
      sign,
      english: json?.english ?? "Today is a good day to learn and practice English. Keep it simple and be kind to yourself.",
      japanese: json?.japanese ?? "今日は英語を学び、練習するのに良い日です。シンプルに、そして自分に優しく取り組みましょう。",
      luckyColor,
      luckyNumber,
      points,
      usefulPhrases,
      practicePrompts
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "horoscope failed" },
      { status: 500 }
    );
  }
}
