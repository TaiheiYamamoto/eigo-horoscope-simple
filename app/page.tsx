"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  en: string;
  ja?: string;
};

type Learn = {
  points?: string[];
  usefulPhrases?: { en: string; ja: string }[];
  practicePrompts?: string[];
};

function splitEnJa(raw: string): { en: string; ja?: string } {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return { en: raw, ja: undefined };
  const boundary = lines.findIndex((l) => /[ぁ-んァ-ン一-龠]/.test(l));
  if (boundary > 0) {
    return {
      en: lines.slice(0, boundary).join("\n"),
      ja: lines.slice(boundary).join("\n"),
    };
  }
  return { en: raw, ja: undefined };
}

export default function Page() {
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [topic, setTopic] = useState("love");

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [luckyColor, setLuckyColor] = useState<string | null>(null);
  const [luckyNumber, setLuckyNumber] = useState<number | null>(null);
  const [learn, setLearn] = useState<Learn | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [recOn, setRecOn] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  const canGenerate = useMemo(
    () => !!name && /^\d{4}-\d{2}-\d{2}$/.test(birth),
    [name, birth]
  );

  async function speak(text: string) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const buf = await res.arrayBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch(() => {});
      }
    } catch {}
  }

  async function generateHoroscope() {
    if (!canGenerate) {
      alert("Name と 生年月日(YYYY-MM-DD) を入れてください");
      return;
    }
    setLoading(true);
    setMsgs([]);
    setLuckyColor(null);
    setLuckyNumber(null);
    setLearn(null);

    try {
      const r = await fetch("/api/horoscope", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          birthISO: new Date(birth).toISOString(),
          topic,
        }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);

      const color = (j.luckyColor || "blue") as string;
      const num = Number.isFinite(j.luckyNumber) ? Number(j.luckyNumber) : null;
      setLuckyColor(color);
      setLuckyNumber(num);

      const learnData: Learn = {
        points: Array.isArray(j.points) ? j.points : undefined,
        usefulPhrases: Array.isArray(j.usefulPhrases) ? j.usefulPhrases : undefined,
        practicePrompts: Array.isArray(j.practicePrompts) ? j.practicePrompts : undefined,
      };
      setLearn(learnData);

      const extra = `\n\nLucky Color: ${color}  •  Lucky Number: ${
        num ?? ""
      }`.trim();
      const first: Msg = {
        id: crypto.randomUUID(),
        role: "assistant",
        en: (j.english ?? "") + (extra ? extra : ""),
        ja: j.japanese ?? undefined,
      };
      setMsgs([first]);
      speak(first.en);
    } catch (e: any) {
      alert(e.message || "failed to generate");
    } finally {
      setLoading(false);
    }
  }

  async function sendFollowUp() {
    const text = input.trim();
    if (!text) return;
    if (!msgs.length) {
      alert("先に占いを生成してください");
      return;
    }

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", en: text };
    setMsgs((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ history: msgs[0], question: text }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);

      const { en, ja } = splitEnJa(j.content || "");
      const asst: Msg = { id: crypto.randomUUID(), role: "assistant", en, ja };
      setMsgs((prev) => [...prev, asst]);
      speak(asst.en);
    } catch (e: any) {
      alert(e.message || "chat failed");
    } finally {
      setLoading(false);
    }
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
      setInput((j.text || "").trim());
      setRecOn(false);
    };
    recRef.current = rec;
    rec.start();
    setRecOn(true);
  }
  function stopRec() {
    recRef.current?.stop();
  }

  return (
    <main style={styles.shell}>
      <header style={styles.header}>
        <h1 style={styles.title}>
          ✦ Zodiac Horoscope in English ✦<br />
          <span style={{ fontSize: 16, fontWeight: "normal" }}>英語で星座占い</span>
        </h1>
        <audio ref={audioRef} controls style={{ height: 28 }} />
      </header>

      <section style={styles.card}>
        <div style={styles.row}>
          <label style={styles.label}>What's your name?</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
          />
        </div>
        <div style={styles.row}>
          <label style={styles.label}>When were you born? (YYYY-MM-DD)</label>
          <input
            value={birth}
            onChange={(e) => setBirth(e.target.value)}
            placeholder="1990-01-23"
            style={styles.input}
          />
        </div>
        <div style={styles.row}>
          <label style={styles.label}>Which aspect?</label>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            style={styles.input}
          >
            <option value="love">恋愛 (Love)</option>
            <option value="money">金運 (Money)</option>
            <option value="work-study">仕事・勉強 (Work/Study)</option>
          </select>
        </div>
        <button
          onClick={generateHoroscope}
          disabled={!canGenerate || loading}
          style={styles.primaryBtn}
        >
          {loading ? "Generating..." : "占いを開始（新しい会話）"}
        </button>
      </section>

      {luckyColor && luckyNumber !== null && (
        <div style={styles.luckyBox}>
          <div
            style={{
              ...styles.colorDot,
              background: (luckyColor || "blue").toLowerCase(),
            }}
          />
          <div style={{ fontSize: 14 }}>
            <strong>Lucky Color:</strong> {luckyColor}　/　
            <strong>Lucky Number:</strong> {luckyNumber}
          </div>
        </div>
      )}

      {learn && (
        <section style={styles.learnBox}>
          {learn.points && learn.points.length > 0 && (
            <div style={styles.section}>
              <h4 style={styles.h4}>Key Points</h4>
              <ul style={{ margin: "6px 0 0 18px" }}>
                {learn.points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {learn.usefulPhrases && learn.usefulPhrases.length > 0 && (
            <div style={styles.section}>
              <h4 style={styles.h4}>Useful Phrases</h4>
              <ul style={{ margin: "6px 0 0 18px" }}>
                {learn.usefulPhrases.map((ph, i) => (
                  <li key={i}>
                    <strong>{ph.en}</strong> — {ph.ja}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {learn.practicePrompts && learn.practicePrompts.length > 0 && (
            <div style={styles.section}>
              <h4 style={styles.h4}>Practice Prompts</h4>
              <ol style={{ margin: "6px 0 0 18px" }}>
                {learn.practicePrompts.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}

      <section style={styles.chatWrap}>
        {msgs.map((m) => (
          <div
            key={m.id}
            style={{
              ...styles.bubble,
              ...(m.role === "user" ? styles.user : styles.asst),
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
              {m.role === "user" ? "You" : "Astro Tutor"}
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.en}</div>
            {m.ja && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ cursor: "pointer" }}>日本語訳を表示</summary>
                <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>
                  {m.ja}
                </div>
              </details>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </section>

      <section style={styles.inputRow}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendFollowUp();
            }
          }}
          placeholder="Ask in English… e.g., Any tips for staying focused this week?"
          style={styles.textbox}
        />
        {!recOn ? (
          <button onClick={startRec} title="Speak" style={styles.iconBtn}>
            🎙️
          </button>
        ) : (
          <button onClick={stopRec} title="Stop" style={styles.iconBtn}>
            ⏹
          </button>
        )}
        <button
          onClick={sendFollowUp}
          disabled={loading || !input.trim()}
          style={styles.sendBtn}
        >
          {loading ? "…" : "Send"}
        </button>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    maxWidth: 860,
    margin: "0 auto",
    padding: 16,
    fontFamily: "'Segoe UI', 'Noto Sans JP', sans-serif",
    background: "linear-gradient(180deg, #0b1d3a 0%, #1a103d 100%)",
    color: "#fdfdfd",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderBottom: "1px solid rgba(255,255,255,0.2)",
    paddingBottom: 8,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 1,
    textShadow: "0 0 6px rgba(255,255,255,0.6)",
  },

  card: {
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    background: "rgba(255,255,255,0.05)",
  },

  luckyBox: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    border: "1px solid gold",
    padding: 12,
    borderRadius: 12,
    margin: "12px 0",
    background: "rgba(255,215,0,0.1)",
    boxShadow: "0 0 10px rgba(255,215,0,0.3)",
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "2px solid #fff",
  },

  learnBox: {
    border: "1px solid silver",
    borderRadius: 12,
    padding: 12,
    margin: "12px 0",
    background: "rgba(255,255,255,0.08)",
    boxShadow: "0 0 8px rgba(192,192,192,0.3)",
  },
  section: { marginBottom: 12 },
  h4: { margin: "0 0 6px 0", fontSize: 15, color: "#ffd700" },

  chatWrap: {
    display: "grid",
    gap: 10,
    margin: "12px 0",
    maxHeight: "55vh",
    overflowY: "auto",
    padding: "0 4px",
  },
  bubble: { padding: 12, borderRadius: 14, maxWidth: "80%" },
  user: {
    justifySelf: "end",
    background: "#3b5998",
    border: "1px solid #4a6ea8",
  },
  asst: {
    justifySelf: "start",
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.3)",
  },

  inputRow: {
    display: "grid",
    gridTemplateColumns: "1fr 48px 86px",
    gap: 8,
    alignItems: "center",
    position: "sticky",
    bottom: 0,
    background: "#0b1d3a",
    paddingTop: 8,
  },
  textbox: { padding: 10, borderRadius: 10, border: "1px solid #ddd" },
  iconBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ccc",
    background: "#fff",
    cursor: "pointer",
  },
  sendBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #ccc",
    background: "#ffd700",
    color: "#111",
    cursor: "pointer",
  },
};
