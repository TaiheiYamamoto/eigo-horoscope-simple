// ---------- app/page.tsx ----------
"use client";
import { useRef, useState } from "react";

const TOPICS = [
  { value: "love", label: "恋愛 (Love)" },
  { value: "money", label: "金運 (Money)" },
  { value: "work-study", label: "仕事・勉強 (Work/Study)" }
];

export default function Page() {
  // step 1: questions
  const [name, setName] = useState("");
  const [birthISO, setBirthISO] = useState(""); // YYYY-MM-DD
  const [topic, setTopic] = useState("love");

  // step 2: generated horoscope
  const [horoscope, setHoroscope] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // follow-up chat
  const [qText, setQText] = useState("");
  const [answer, setAnswer] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // STT helpers
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [recOn, setRecOn] = useState(false);

  async function startRec(lang: "en" | "ja" = "en") {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
    chunksRef.current = [];
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const fd = new FormData();
      fd.append("file", blob, "speech.webm");
      fd.append("lang", "en");
      const r = await fetch("/api/transcribe", { method: "POST", body: fd });
      const j = await r.json();
      // If we are in the initial Q&A phase, fill the focused field; otherwise, put into qText
      if (!horoscope) {
        // heuristics: fill the first empty among name → birth →
        if (!name) setName(j.text.trim());
        else if (!birthISO) setBirthISO(j.text.trim());
        else setQText(j.text.trim());
      } else {
        setQText(j.text.trim());
      }
      setRecOn(false);
    };
    recRef.current = rec;
    rec.start();
    setRecOn(true);
  }
  function stopRec() { recRef.current?.stop(); }

  async function generateHoroscope() {
    if (!name || !birthISO || !topic) { alert("Please fill all fields."); return; }
    setLoading(true);
    setAnswer("");
    try {
      const r = await fetch("/api/horoscope", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, birthISO: new Date(birthISO).toISOString(), topic })
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setHoroscope(j);
    } catch (e: any) {
      alert(e.message || "Failed to generate.");
    } finally {
      setLoading(false);
    }
  }

  async function askFollowup() {
    if (!qText.trim()) return;
    setLoading(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ history: horoscope, question: qText })
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setAnswer(j.content);
      // TTS for English part: naive split — before first JP line (「」 or Japanese chars). Fallback entire text.
      const en = j.content.split(/\n/).find((line: string) => /[a-zA-Z]/.test(line)) || j.content;
      const tts = await fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: en }) });
      const buf = await tts.arrayBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
      if (!audioRef.current) return;
      audioRef.current.src = url;
      audioRef.current.play().catch(() => {});
    } catch (e: any) {
      alert(e.message || "Chat failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 840, margin: "40px auto", padding: 16, fontFamily: "system-ui, Arial" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>英語で星占い</h1>

      {/* Step 1: AI asks 2-3 questions */}
      {!horoscope && (
        <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <p style={{ marginTop: 0, opacity: 0.8 }}>AI: What's your name?（ニックネーム可）</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name (in English)" style={{ flex: 1, padding: 8 }} />
            {!recOn ? <button onClick={()=>startRec("en")} style={{ padding: "8px 12px" }}>🎙️</button> : <button onClick={stopRec} style={{ padding: "8px 12px" }}>⏹</button>}
          </div>

          <p style={{ marginTop: 12, opacity: 0.8 }}>AI: When were you born?（生年月日：YYYY-MM-DD でOK）</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={birthISO} onChange={e=>setBirthISO(e.target.value)} placeholder="1990-01-23" style={{ flex: 1, padding: 8 }} />
            {!recOn ? <button onClick={()=>startRec("en")} style={{ padding: "8px 12px" }}>🎙️</button> : <button onClick={stopRec} style={{ padding: "8px 12px" }}>⏹</button>}
          </div>

          <p style={{ marginTop: 12, opacity: 0.8 }}>AI: What aspect do you want to know?（知りたい運勢）</p>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={topic} onChange={e=>setTopic(e.target.value)} style={{ padding: 8 }}>
              {TOPICS.map(t=> <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button disabled={loading} onClick={generateHoroscope} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc" }}>
              {loading ? "Generating..." : "占いを見る / Generate"}
            </button>
          </div>
        </section>
      )}

      {/* Step 2: Horoscope result */}
      {horoscope && (
        <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>{horoscope.title} — <span style={{ opacity: 0.7 }}>{horoscope.sign}</span></h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{horoscope.english}</p>
          <details style={{ marginTop: 8 }}>
            <summary>日本語訳を表示</summary>
            <p style={{ whiteSpace: "pre-wrap" }}>{horoscope.japanese}</p>
          </details>
        </section>
      )}

      {/* Step 3: Follow-up Q&A (悩み相談) */}
      {horoscope && (
        <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Ask a question about your reading（英語推奨／STT可）</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={qText} onChange={e=>setQText(e.target.value)} placeholder="e.g., How can I improve my focus this week?" style={{ flex: 1, padding: 8 }} />
            {!recOn ? <button onClick={()=>startRec("en")} style={{ padding: "8px 12px" }}>🎙️</button> : <button onClick={stopRec} style={{ padding: "8px 12px" }}>⏹</button>}
            <button disabled={loading} onClick={askFollowup} style={{ padding: "8px 12px" }}>{loading ? "Thinking..." : "Send"}</button>
          </div>
          {!!answer && (
            <div style={{ border: "1px dashed #ccc", borderRadius: 8, padding: 12 }}>
              <p style={{ marginTop: 0, whiteSpace: "pre-wrap" }}>{answer}</p>
              <audio ref={audioRef} controls style={{ width: "100%", marginTop: 8 }} />
            </div>
          )}
        </section>
      )}

      <footer style={{ marginTop: 24, opacity: 0.6, fontSize: 12 }}>
        Tips: Use HTTPS for mic permission. Keep answers short (10–30s). If Safari mic is unstable, try Chrome.
      </footer>
    </main>
  );
}
