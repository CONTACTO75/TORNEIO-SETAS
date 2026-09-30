"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth, useSeasons } from "@/lib/data";

export default function NovoTorneio() {
  const router = useRouter();
  const { isAdmin, ready } = useAuth();
  const { seasons } = useSeasons();
  const [f, setF] = useState({
    name: "", date: new Date().toISOString().slice(0, 10), format: "double",
    first_to: 3, first_to_final: 4, season_id: "",
  });
  const [err, setErr] = useState("");
  const set = (k: string, v: string | number) => setF({ ...f, [k]: v });

  if (ready && !isAdmin) return <div className="notice">Precisa de entrar como organizador para criar torneios.</div>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from("tournaments")
      .insert({ ...f, name: f.name.trim(), season_id: f.season_id || null }).select("id").single();
    if (error) setErr(error.message);
    else router.push(`/torneios/${data.id}`);
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ marginBottom: 20 }}>Criar torneio</h1>
      {err && <div className="notice">{err}</div>}
      <form onSubmit={submit} className="panel" style={{ display: "grid", gap: 18 }}>
        <div className="form-grid">
          <label className="field">Nome<input required value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: 3.ª jornada, Taberna do Zé" /></label>
          <label className="field">Data<input type="date" required value={f.date} onChange={(e) => set("date", e.target.value)} /></label>
        </div>
        <div className="form-grid">
          <label className="field">Formato
            <select value={f.format} onChange={(e) => set("format", e.target.value)}>
              <option value="double">Eliminação dupla</option>
              <option value="single">Eliminação simples</option>
            </select>
          </label>
          <label className="field">Liga (jornada)
            <select value={f.season_id} onChange={(e) => set("season_id", e.target.value)}>
              <option value="">Nenhuma, torneio avulso</option>
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label className="field">Jogos à melhor de… (legs para ganhar)
            <input type="number" min={1} max={21} value={f.first_to} onChange={(e) => set("first_to", +e.target.value)} />
          </label>
          <label className="field">Na final, legs para ganhar
            <input type="number" min={1} max={21} value={f.first_to_final} onChange={(e) => set("first_to_final", +e.target.value)} />
          </label>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          Ex.: 3 legs para ganhar é um jogo à melhor de 5. Os jogadores escolhem-se no passo seguinte.
        </p>
        <div><button className="btn green">Criar e escolher jogadores</button></div>
      </form>
    </div>
  );
}
