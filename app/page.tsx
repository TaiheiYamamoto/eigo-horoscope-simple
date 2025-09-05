"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  en: string;       // 英文（TTS対象）
  ja?: string;      // 和訳（任意）
};

function splitEnJa(raw: string): { en: string; ja?: string } {
  // 返答が「英語→日本語」の順に来る想定。うまく分割できなければ全文を英語扱い。
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return { en: raw, ja: undefined };
  // 英語部分＝英字含む行～日本語っぽい行の境界で分割
  const boundary = lines.findIndex(l => /[ぁ-んァ-ン一-龠]/.test(l));
  if (boundary > 0) {
    return { en: lines.slice(0, boundary).join("\n"), ja: lines.slice(boundary).join("\n") };
  }
  return { en: raw, ja: undefined };
}

export default function Page() {
  // 初回質問フォーム
  const [name, setName] = useState("");
  const [birth, setBirth] = useState(""); // YYYY-MM-DD
  const [topic, setTopic] = useState("love");

  // チャットメッセージ
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // TTS / スクロール
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // 録音（STT）
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [recOn, setRecOn] = useState(false);

  // 画面下まで自動スクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  const canGenerate = useMemo(() => !!name && /^\d{4}-\d{2}-\d{2}$/.test(birth), [name, birth]);

  async function speak(text: string) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text })
      });
      const buf = await res.arrayBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch(() => {});
      }
    } catch {}
  }

  // 1) 最初の「占い」生成 → アシスタントの最初のメッセージに
  async function generateHoroscope() {
    if (!canGenerate) {
      alert("Name と 生年月日(YYYY-MM-DD) を入れてください");
      return;
    }
    setLoading(true);
    setMsgs([]); // 新規セッションとして開始
    try {
      const r = await fetch("/api/horoscope", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, birthISO: new Date(birth).toISOString(), topic })
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);

      const first: Msg = {
        id: crypto.randomUUID(),
        role: "assistant",
        en: j.english ?? "",
        ja: j.japanese ?? undefined
      };
      setMsgs([first]);
      speak(first.en);
    } catch (e: any) {
      alert(e.message || "failed to generate");
    } finally {
      setLoading(false);
    }
  }

  // 2) 追質問：ユーザー→アシスタント（チャットUI）
  async function sendFollowUp() {
    const text = input.trim();
    if (!text) return;
    if (!msgs.length) {
      alert("先に占いを生成してください");
      return;
    }

    // 画面にユーザー発言を即時表示
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", en: text };
    setMsgs(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ history: msgs[0], question: text })
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);

      const { en, ja } = splitEnJa(j.content || "");
      const asst: Msg = { id: crypto.randomUUID(), role: "assistant", en, ja };
      setMsgs(prev => [...prev, asst]);
      speak(asst.en);
    } catch (e: any) {
      alert(e.message || "chat failed");
    } finally {
      setLoading(false);
    }
  }

  // 3) STT：🎙️録音開始/停止→テキスト起こして入力欄へ
  async function startRec() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
    chunksRef.current = [];
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const fd = new FormData();
      fd.append("file", blob, "speech.webm");
      fd.append("lang", "en"); // 日本語で話すなら "ja"
      const r = await fetch("/api/transcribe", { method: "POST", body: fd });
      const j = await r.json();
      setInput((j.text || "").trim());
      setRecOn(false);
    };
    recRef.current = rec;
    rec.start();
    setRecOn(true);
  }
  function stopRec() { recRef.current?.stop(); }

  // UI: シンプルなチャットバブル
  return (
    <main style={styles.shell}>
      <header style={styles.header}>
        <h1 style={{ margin: 0, fontSize: 20 }}>英語で星占い</h1>
        <audio ref={audioRef} controls style={{ height: 28 }} />
      </header>

      {/* 初回フォーム */}
      <section style={styles.card}>
        <div style={styles.row}>
          <label style={styles.label}>What's your name?</label>
          <input value={name} onChange={e=>setName(e.target.value)} style={styles.input} />
        </div>
        <div style={styles.row}>
          <label style={styles.label}>When were you born? (YYYY-MM-DD)</label>
          <input value={birth} onChange={e=>setBirth(e.target.value)} placeholder="1990-01-23" style={styles.input} />
        </div>
        <div style={styles.row}>
          <label style={styles.label}>Which aspect?</label>
          <select value={topic} onChange={e=>setTopic(e.target.value)} style={styles.input}>
            <option value="love">恋愛 (Love)</option>
            <option value="money">金運 (Money)</option>
            <option value="work-study">仕事・勉強 (Work/Study)</option>
          </select>
        </div>
        <button onClick={generateHoroscope} disabled={!canGenerate || loading} style={styles.primaryBtn}>
          {loading ? "Generating..." : "占いを開始（新しい会話）"}
        </button>
      </section>

      {/* チャット欄 */}
      <section style={styles.chatWrap}>
        {msgs.map(m => (
          <div key={m.id} style={{ ...styles.bubble, ...(m.role === "user" ? styles.user : styles.asst) }}>
            <div style={{ fontSize: 12, opacity: .7, marginBottom: 4 }}>
              {m.role === "user" ? "You" : "Astro Tutor"}
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.en}</div>
            {m.ja && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ cursor: "pointer" }}>日本語訳を表示</summary>
                <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{m.ja}</div>
              </details>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </section>

      {/* 入力欄（追質問） */}
      <section style={styles.inputRow}>
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendFollowUp(); } }}
          placeholder="Ask in English… e.g., Any tips for staying focused this week?"
          style={styles.textbox}
        />
        {!recOn
          ? <button onClick={startRec} title="Speak" style={styles.iconBtn}>🎙️</button>
          : <button onClick={stopRec} title="Stop" style={styles.iconBtn}>⏹</button>
        }
        <button onClick={sendFollowUp} disabled={loading || !input.trim()} style={styles.sendBtn}>
          {loading ? "…" : "Send"}
        </button>
      </section>
    </main>
  );
}

/** --- 最小スタイル（インラインCSS） --- */
const styles: Record<string, React.CSSProperties> = {
  shell: { maxWidth: 860, margin: "0 auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Arial" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  card: { border: "1px solid #eee", borderRadius: 12, padding: 12, marginBottom: 12 },
  row: { display: "grid", gridTemplateColumns: "220px 1fr", gap: 8, alignItems: "center", marginBottom: 8 },
  label: { fontSize: 14, opacity: .8 },
  input: { padding: 8, borderRadius: 8, border: "1px solid #ddd" },
  primaryBtn: { padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc", background: "#111", color: "#fff", cursor: "pointer" },

  chatWrap: { display: "grid", gap: 10, margin: "12px 0", maxHeight: "55vh", overflowY: "auto", padding: "0 4px" },
  bubble: { padding: 12, borderRadius: 14, maxWidth: "80%" },
  user: { justifySelf: "end", background: "#DCF1FF", border: "1px solid #B9E1FF" },
  asst: { justifySelf: "start", background: "#F5F5F7", border: "1px solid #E6E6EA" },

  inputRow: { display: "grid", gridTemplateColumns: "1fr 48px 86px", gap: 8, alignItems: "center", position: "sticky", bottom: 0, background: "#fff", paddingTop: 8 },
  textbox: { padding: 10, borderRadius: 10, border: "1px solid #ddd" },
  iconBtn: { padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc", background: "#fff", cursor: "pointer" },
  sendBtn: { padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc", background: "#111", color: "#fff", cursor: "pointer" },
};
