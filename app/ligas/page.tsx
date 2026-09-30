"use client";
import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth, useSeasons } from "@/lib/data";
import { DEFAULT_POINTS } from "@/lib/bracket";

export default function Ligas() {
  const { isAdmin } = useAuth();
  const { seasons, reload } = useSeasons();
  const [name, setName] = useState("");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await supabase.from("seasons").insert({ name: name.trim(), points: DEFAULT_POINTS });
    setName(""); reload();
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="page-head"><h1>Ligas</h1></div>
      <p className="muted" style={{ marginTop: -12 }}>Uma liga junta vários torneios (jornadas) numa classificação acumulada por pontos.</p>
      {isAdmin && (
        <form onSubmit={add} className="row" style={{ flexWrap: "nowrap", margin: "20px 0" }}>
          <input placeholder="Nome da liga, ex.: Liga de Inverno 2026/27" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn green" style={{ whiteSpace: "nowrap" }}>Criar liga</button>
        </form>
      )}
      {seasons.length === 0 ? <div className="empty"><p className="muted">Ainda não há ligas.</p></div> : (
        <div className="tlist">
          {seasons.map((s) => (
            <Link key={s.id} href={`/ligas/${s.id}`} className="titem" style={{ gridTemplateColumns: "1fr auto" }}>
              <div className="tname">{s.name}</div>
              <span className="muted small">Ver classificação</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
