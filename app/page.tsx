"use client";
import { useState } from "react";

export default function Page() {
  const [name, setName] = useState("");
  const [birth, setBirth] = useState(""); // YYYY-MM-DD
  const [topic, setTopic] = useState("love");
  const [out, setOut] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 12 }}>英語で星占い</h1>

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

      {out && (
        <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h2>{out.title} — <span style={{ opacity: .6 }}>{out.sign}</span></h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{out.english}</p>
          <details style={{ marginTop: 8 }}>
            <summary>日本語訳を表示</summary>
            <p style={{ whiteSpace: "pre-wrap" }}>{out.japanese}</p>
          </details>
        </section>
      )}
    </main>
  );
}
