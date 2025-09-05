import { NextResponse } from "next/server";
import { openai } from "../_lib/openai";

export const runtime = "edge";

function zodiacFromISO(iso: string) {
  const d = new Date(iso);
  const m = d.getUTCMonth() + 1, day = d.getUTCDate();
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

export async function POST(req: Request) {
  try {
    const { name, birthISO, topic } = await req.json();
    const sign = zodiacFromISO(birthISO);
    const sys = "You are an ESL-friendly horoscope guide. CEFR A2-B1. Short and clear.";
    const user = `Create a concise horoscope (6-8 sentences) for Sign: ${sign}. 
User name: ${name}. Topic: ${topic}.
Return JSON: {"title":string,"english":string,"japanese":string}`;

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }]
    });

    const raw = r.choices[0]?.message?.content ?? "{}";
    const json = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json({ ...json, sign });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "horoscope failed" }, { status: 500 });
  }
}
