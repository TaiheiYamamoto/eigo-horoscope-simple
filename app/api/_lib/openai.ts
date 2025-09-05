// ---------- app/api/_lib/openai.ts ----------
import OpenAI from "openai";
export const openai = new OpenAI({ apiKey: process.env.openai_key });
