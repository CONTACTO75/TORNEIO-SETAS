"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth, usePlayers } from "@/lib/data";

export default function Jogadores() {
  const { isAdmin } = useAuth();
  const { players, loading, reload } = usePlayers();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const { error } = await supabase.from("players").insert({ name: n });
    if (error) setMsg(error.code === "23505" ? `Já existe um jogador chamado ${n}.` : error.message);
    else { setName(""); setMsg(""); reload(); }
  };

  const save = async () => {
    if (!editing) return;
    const { error } = await supabase.from("players").update({ name: editing.name.trim() }).eq("id", editing.id);
    if (error) setMsg(error.code === "23505" ? "Esse nome já está a ser usado." : error.message);
    else { setEditing(null); setMsg(""); reload(); }
  };

  const remove = async (id: string, n: string) => {
    const { count } = await supabase.from("tournaments").select("id", { count: "exact", head: true }).contains("seeds", [id]);
    if (count) { setMsg(`${n} já jogou ou está inscrito em ${count} torneio(s) e não pode ser apagado. Pode mudar-lhe o nome.`); return; }
    if (!confirm(`Apagar ${n}?`)) return;
    await supabase.from("players").delete().eq("id", id);
    reload();
  };

  const shown = players.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-head"><h1>Jogadores</h1><span className="muted">{players.length} registados</span></div>
      {msg && <div className="notice">{msg}</div>}
      {isAdmin && (
        <form onSubmit={add} className="row" style={{ marginBottom: 20, flexWrap: "nowrap" }}>
          <input placeholder="Nome do novo jogador" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn green" style={{ whiteSpace: "nowrap" }}>Adicionar jogador</button>
        </form>
      )}
      {players.length > 8 && <input placeholder="Procurar jogador" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />}
      {loading ? <p className="muted">A carregar…</p> : players.length === 0 ? (
        <div className="empty"><p>Ainda não há jogadores. {isAdmin ? "Adicione-os acima." : ""}</p></div>
      ) : (
        <ul className="plist" style={{ maxHeight: "none" }}>
          {shown.map((p) => (
            <li key={p.id}>
              {editing?.id === p.id ? (
                <>
                  <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus
                    onKeyDown={(e) => e.key === "Enter" && save()} />
                  <button className="btn small green" onClick={save}>Guardar</button>
                  <button className="btn small ghost" onClick={() => setEditing(null)}>Cancelar</button>
                </>
              ) : (
                <>
                  <span className="grow">{p.name}</span>
                  {isAdmin && <>
                    <button className="btn small ghost" onClick={() => setEditing({ id: p.id, name: p.name })}>Mudar nome</button>
                    <button className="btn small ghost" onClick={() => remove(p.id, p.name)}>Apagar</button>
                  </>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
