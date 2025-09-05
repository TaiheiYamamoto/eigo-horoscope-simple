"use client";
import { useRef, useState } from "react";

export default function Page() {
  // --- 初回の質問 ---
  const [name, setName] = useState("");
  const [birth, setBirth] = useState(""); // YYYY-MM-DD
  const [topic, setTopic] = useState("love");

  // --- 占い結果 ---
  const [out, setOut] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // --- 追質問 ---
  const [qText, setQText] = useState("");
  const [answer, setAnswer] = useState("");

  // --- TTS 用 ---
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- 録音用 ---
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [recOn, setRecOn] = useState(false);

  async function gen() {
    if (!name || !birth) { alert("Name と 生年月日(YYYY-MM-DD) を入れてください"); return; }
    setLoading(true); setOut(null);
    try {
      const r = await fetch("/api/horoscope", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, birthISO: new Date(birth).toISOString(), topic })
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setOut(j);
    } catch (e:any) {
      alert(e.message || "failed");
    } finally { setLoading(false); }
  }

  async function ask() {
    if (!out) { alert("先に占いを生成してください"); return; }
    if (!qText.trim()) { alert("質問文が空です"); return; }
    setLoading(true); setAnswer("");
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ history: out, question: qText })
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setAnswer(j.content);

      // 英語行を抽出して TTS
      const enLine = (j.content as string).split("\n").find((line: string) => /[A-Za-z]/.test(line)) || j.content;
      const tts = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: enLine })
      });
      const buf = await tts.arrayBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch(() => {/* ブラウザ自動再生ガード対策 */});
      }
    } catch (e:any) {
      alert(e.message || "chat failed");
    } finally { setLoading(false); }
  }

  async function startRec() {
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
      setQText((j.text || "").trim());
      setRecOn(false);
    };
    recRef.current = rec;
    rec.start();
    setRecOn(true);
  }
  function stopRec() { recRef.current?.stop(); }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 12 }}>英語で星占い</h1>

      {/* 初回の3質問 */}
      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        <label>What's your name?
          <input value={name} onChange={e=>setName(e.target.value)} style={{ marginLeft: 8, padding: 6 }} />
        </label>
        <label>When were you born? (YYYY-MM-DD)
          <input value={birth} onChange={e=>setBirth(e.target.value)} placeholder="1990-01-23" style={{ marginLeft: 8, padding: 6 }} />
        </label>
        <label>Which aspect?
          <select value={topic} onChange={e=>setTopic(e.target.value)} style={{ marginLeft: 8, padding: 6 }}>
            <option value="love">恋愛 (Love)</option>
            <option value="money">金運 (Money)</option>
            <option value="work-study">仕事・勉強 (Work/Study)</option>
          </select>
        </label>
        <button onClick={gen} disabled={loading} style={{ width: 180, padding: 8, marginTop: 8 }}>
          {loading ? "Generating..." : "占いを見る"}
        </button>
      </div>

      {/* 占い結果 */}
      {out && (
        <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h2>{out.title} — <span style={{ opacity: .6 }}>{out.sign}</span></h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{out.english}</p>
          <details style={{ marginTop: 8 }}>
            <summary>日本語訳を表示</summary>
            <p style={{ whiteSpace: "pre-wrap" }}>{out.japanese}</p>
          </details>
        </section>
      )}

      {/* 悩み相談（追質問） */}
      {out && (
        <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Ask about your reading（英語推奨 / 🎙️可）</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              value={qText}
              onChange={e=>setQText(e.target.value)}
              placeholder="e.g., How can I improve my focus this week?"
              style={{ flex: 1, padding: 8 }}
            />
            {!recOn
              ? <button onClick={startRec} style={{ padding: "8px 12px" }}>🎙️</button>
              : <button onClick={stopRec} style={{ padding: "8px 12px" }}>⏹</button>
            }
            <button onClick={ask} disabled={loading} style={{ padding: "8px 12px" }}>
              {loading ? "Thinking..." : "Send"}
            </button>
          </div>

          {!!answer && (
            <div style={{ border: "1px dashed #ccc", borderRadius: 8, padding: 12 }}>
              <p style={{ marginTop: 0, whiteSpace: "pre-wrap" }}>{answer}</p>
              <audio ref={audioRef} controls style={{ width: "100%", marginTop: 8 }} />
            </div>
          )}
        </section>
      )}
    </main>
  );
}
