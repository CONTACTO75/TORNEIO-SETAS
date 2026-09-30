"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  affectedBy, bracketSize, computeBracket, isFinal, placeLabel, roundName, shuffle,
  type Match, type Result,
} from "@/lib/bracket";
import { fmtDate, statusLabel, useAuth, usePlayers, useSeasons, type ResultRow, type Tournament } from "@/lib/data";
import Bracket from "@/components/Bracket";
import ScoreDialog from "@/components/ScoreDialog";

type Tab = "arvore" | "jogos" | "class";

export default function TorneioPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { players, reload: reloadPlayers } = usePlayers();
  const { seasons } = useSeasons();
  const [t, setT] = useState<Tournament | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab>("arvore");
  const [pick, setPick] = useState<Match | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const [{ data: td }, { data: rd }] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", id).maybeSingle(),
      supabase.from("results").select("*").eq("tournament_id", id),
    ]);
    if (!td) { setMissing(true); return; }
    setT(td as Tournament);
    setResults((rd as ResultRow[]) ?? []);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Ao vivo: quem está a ver recebe os resultados assim que são gravados
  useEffect(() => {
    const ch = supabase.channel(`torneio-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "results" }, (p) => {
        const row = (p.new && "tournament_id" in p.new ? p.new : p.old) as Partial<ResultRow>;
        if (!row?.tournament_id || row.tournament_id === id) load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  const names = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p.name])), [players]);
  const data = useMemo(() => (t && t.seeds.length >= (t.format === "double" ? 3 : 2)
    ? computeBracket(t.format, t.seeds, results) : null), [t, results]);

  if (missing) return <div className="notice">Este torneio não existe ou foi apagado. <Link href="/">Ver torneios</Link></div>;
  if (!t) return <p className="muted">A carregar…</p>;

  const season = seasons.find((s) => s.id === t.season_id);
  const update = async (patch: Partial<Tournament>) => {
    setT({ ...t, ...patch });
    const { error } = await supabase.from("tournaments").update(patch).eq("id", t.id);
    if (error) setErr(error.message);
  };

  const saveResult = async (m: Match, s1: number, s2: number) => {
    const row: Result = { match_id: m.id, p1: m.p[0]!, p2: m.p[1]!, s1, s2 };
    const { error } = await supabase.from("results").upsert({ ...row, tournament_id: t.id, updated_at: new Date().toISOString() });
    if (error) { setErr(error.message); return; }
    await afterChange([...results.filter((r) => r.match_id !== m.id), { ...row, tournament_id: t.id }]);
  };
  const clearResult = async (m: Match) => {
    await supabase.from("results").delete().eq("tournament_id", t.id).eq("match_id", m.id);
    await afterChange(results.filter((r) => r.match_id !== m.id));
  };
  const afterChange = async (next: ResultRow[]) => {
    const c = computeBracket(t.format, t.seeds, next);
    if (c.staleResults.length)
      await supabase.from("results").delete().eq("tournament_id", t.id).in("match_id", c.staleResults);
    const status = c.champion ? "finished" : "running";
    if (status !== t.status) await supabase.from("tournaments").update({ status }).eq("id", t.id);
    setPick(null);
    load();
  };

  const removeTournament = async () => {
    if (!confirm(`Apagar o torneio "${t.name}" e todos os resultados?`)) return;
    await supabase.from("tournaments").delete().eq("id", t.id);
    router.push("/");
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="muted" style={{ marginBottom: 4 }}>
            {fmtDate(t.date)}{season && <>, <Link href={`/ligas/${season.id}`}>{season.name}</Link></>}
          </div>
          <h1>{t.name}</h1>
          <div className="row" style={{ marginTop: 8 }}>
            <span className={`badge ${t.status}`}>{statusLabel[t.status]}</span>
            <span className="muted small">
              {t.format === "double" ? "Eliminação dupla" : "Eliminação simples"}, {t.seeds.length} jogadores,
              primeiro a {t.first_to} legs (final: {t.first_to_final})
            </span>
          </div>
        </div>
        <div className="row no-print">
          {t.status !== "draft" && <button className="btn ghost" onClick={() => { setTab("arvore"); setTimeout(() => window.print(), 50); }}>Imprimir árvore</button>}
          {isAdmin && t.status !== "draft" && results.length === 0 && (
            <button className="btn ghost" onClick={() => update({ status: "draft" })}>Voltar à preparação</button>
          )}
          {isAdmin && <button className="btn ghost" onClick={removeTournament}>Apagar torneio</button>}
        </div>
      </div>
      {err && <div className="notice">{err}</div>}

      {t.status === "draft" ? (
        isAdmin ? <Setup t={t} players={players} names={names} update={update} reloadPlayers={reloadPlayers} seasons={seasons} />
          : <div className="panel"><h3>Torneio em preparação</h3><p className="muted">A árvore aparece aqui quando o organizador iniciar o torneio.</p>
            {t.seeds.length > 0 && <p>Inscritos: {t.seeds.map((s) => names[s]).join(", ")}</p>}</div>
      ) : data && (
        <>
          <div className="tabs">
            {([["arvore", "Árvore"], ["jogos", `Jogos por jogar (${data.matches.filter((m) => m.status === "ready").length})`], ["class", "Classificação"]] as [Tab, string][])
              .map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
          </div>
          {tab === "arvore" && <>
            {isAdmin && t.status === "running" && <p className="muted small no-print">Toque num jogo com contorno vermelho para introduzir o resultado. Os jogos já jogados também podem ser corrigidos.</p>}
            <Bracket data={data} names={names} canEdit={isAdmin} onPick={setPick} />
          </>}
          {tab === "jogos" && <MatchLists data={data} names={names} canEdit={isAdmin} onPick={setPick} />}
          {tab === "class" && <Standings data={data} names={names} seeds={t.seeds} />}
        </>
      )}

      {pick && data && (
        <ScoreDialog
          match={pick} names={names}
          title={roundName(data.structure, pick)}
          firstTo={isFinal(data.structure, pick.id) ? t.first_to_final : t.first_to}
          warn={(s1, s2) => affectedBy(t.format, t.seeds, results,
            s1 === null || s2 === null ? { match_id: pick.id, remove: true }
              : { match_id: pick.id, p1: pick.p[0]!, p2: pick.p[1]!, s1, s2 })}
          onSave={(s1, s2) => saveResult(pick, s1, s2)}
          onClear={() => clearResult(pick)}
          onClose={() => setPick(null)}
        />
      )}
    </>
  );
}

// ---------- Preparação: inscrever, ordenar e sortear ----------
function Setup({ t, players, names, update, reloadPlayers, seasons }: {
  t: Tournament; players: { id: string; name: string }[]; names: Record<string, string>;
  update: (p: Partial<Tournament>) => Promise<void>; reloadPlayers: () => Promise<void>;
  seasons: { id: string; name: string }[];
}) {
  const [q, setQ] = useState("");
  const [newName, setNewName] = useState("");
  const seeds = t.seeds;
  const min = t.format === "double" ? 3 : 2;
  const toggle = (pid: string) => update({ seeds: seeds.includes(pid) ? seeds.filter((s) => s !== pid) : [...seeds, pid] });
  const move = (i: number, d: number) => {
    const s = [...seeds]; const j = i + d;
    if (j < 0 || j >= s.length) return;
    [s[i], s[j]] = [s[j], s[i]]; update({ seeds: s });
  };
  const addPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = newName.trim(); if (!n) return;
    const { data, error } = await supabase.from("players").insert({ name: n }).select("id").single();
    if (error) { alert(error.code === "23505" ? `Já existe um jogador chamado ${n}.` : error.message); return; }
    setNewName(""); await reloadPlayers(); update({ seeds: [...seeds, data.id] });
  };
  const size = bracketSize(Math.max(seeds.length, min));
  const preview = seeds.length >= min ? computeBracket(t.format, seeds, []) : null;

  return (
    <>
      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="form-grid">
          <label className="field">Formato
            <select value={t.format} onChange={(e) => update({ format: e.target.value as Tournament["format"] })}>
              <option value="double">Eliminação dupla</option><option value="single">Eliminação simples</option>
            </select>
          </label>
          <label className="field">Legs para ganhar<input type="number" min={1} max={21} value={t.first_to} onChange={(e) => update({ first_to: +e.target.value || 1 })} /></label>
          <label className="field">Legs para ganhar a final<input type="number" min={1} max={21} value={t.first_to_final} onChange={(e) => update({ first_to_final: +e.target.value || 1 })} /></label>
          <label className="field">Liga
            <select value={t.season_id ?? ""} onChange={(e) => update({ season_id: e.target.value || null })}>
              <option value="">Nenhuma</option>{seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="setup">
        <section>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <h2>Inscritos ({seeds.length})</h2>
            <button className="btn ghost small" disabled={seeds.length < 2} onClick={() => update({ seeds: shuffle(seeds) })}>Sortear posições</button>
          </div>
          <p className="muted small" style={{ marginTop: 0 }}>
            A ordem é a das cabeças de série: o 1.º e o 2.º só se podem encontrar na final.
            {seeds.length >= min && size > seeds.length && ` Chave de ${size}: ${size - seeds.length} bye(s), atribuídos aos primeiros da lista.`}
          </p>
          {seeds.length === 0 ? <div className="empty"><p className="muted">Escolha jogadores na lista ao lado.</p></div> : (
            <ul className="plist">
              {seeds.map((s, i) => (
                <li key={s}>
                  <span className="seed">{i + 1}</span>
                  <span className="grow">{names[s] ?? "Jogador apagado"}</span>
                  <button className="iconbtn" onClick={() => move(i, -1)} aria-label="Subir">↑</button>
                  <button className="iconbtn" onClick={() => move(i, 1)} aria-label="Descer">↓</button>
                  <button className="iconbtn" onClick={() => toggle(s)} aria-label="Retirar">✕</button>
                </li>
              ))}
            </ul>
          )}
          <div style={{ marginTop: 16 }}>
            <button className="btn red" disabled={seeds.length < min} onClick={() => update({ status: "running" })}>
              Iniciar torneio
            </button>
            {seeds.length < min && <span className="muted small" style={{ marginLeft: 10 }}>São precisos pelo menos {min} jogadores.</span>}
          </div>
        </section>
        <section>
          <h2 style={{ marginBottom: 10 }}>Jogadores</h2>
          <form onSubmit={addPlayer} className="row" style={{ flexWrap: "nowrap", marginBottom: 10 }}>
            <input placeholder="Novo jogador" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button className="btn small green" style={{ whiteSpace: "nowrap" }}>Adicionar e inscrever</button>
          </form>
          <input placeholder="Procurar" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
          <ul className="plist">
            {players.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).map((p) => (
              <li key={p.id}><label><input type="checkbox" checked={seeds.includes(p.id)} onChange={() => toggle(p.id)} />{p.name}</label></li>
            ))}
          </ul>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn ghost small" onClick={() => update({ seeds: [...seeds, ...players.filter((p) => !seeds.includes(p.id)).map((p) => p.id)] })}>Inscrever todos</button>
            <button className="btn ghost small" onClick={() => update({ seeds: [] })}>Limpar</button>
          </div>
        </section>
      </div>

      {preview && <>
        <h2 style={{ margin: "36px 0 12px" }}>Pré-visualização</h2>
        <Bracket data={preview} names={names} canEdit={false} />
      </>}
    </>
  );
}

// ---------- Lista de jogos ----------
function MatchLists({ data, names, canEdit, onPick }: {
  data: ReturnType<typeof computeBracket>; names: Record<string, string>; canEdit: boolean; onPick: (m: Match) => void;
}) {
  const ready = data.matches.filter((m) => m.status === "ready");
  const done = data.matches.filter((m) => m.status === "done").reverse();
  const Line = ({ m }: { m: Match }) => {
    const Tag = canEdit ? "button" : "div";
    return (
      <Tag className="mline" onClick={canEdit ? () => onPick(m) : undefined}>
        <span className="n">{m.num}</span>
        <span>
          <span className="vs">{names[m.p[0]!]}{m.status === "done" ? <em>{m.s[0]} – {m.s[1]}</em> : <em>contra</em>}{names[m.p[1]!]}</span>
          <div className="muted small">{roundName(data.structure, m)}</div>
        </span>
        {canEdit && <span className="muted small">{m.status === "done" ? "Corrigir" : "Resultado"}</span>}
      </Tag>
    );
  };
  return (
    <div style={{ maxWidth: 760 }}>
      {data.champion ? <div className="notice ok">Torneio terminado. Campeão: <strong>{names[data.champion]}</strong></div> : null}
      {ready.length > 0 && <>
        <h2 style={{ marginBottom: 10 }}>Podem jogar agora</h2>
        <div className="match-list" style={{ marginBottom: 32 }}>{ready.map((m) => <Line key={m.id} m={m} />)}</div>
      </>}
      {done.length > 0 && <>
        <h2 style={{ marginBottom: 10 }}>Jogados</h2>
        <div className="match-list">{done.map((m) => <Line key={m.id} m={m} />)}</div>
      </>}
    </div>
  );
}

// ---------- Classificação do torneio ----------
function Standings({ data, names, seeds }: { data: ReturnType<typeof computeBracket>; names: Record<string, string>; seeds: string[] }) {
  const stats: Record<string, { w: number; l: number; lf: number; la: number }> = {};
  const get = (p: string) => (stats[p] ??= { w: 0, l: 0, lf: 0, la: 0 });
  for (const m of data.matches) {
    if (m.status !== "done") continue;
    const [a, b] = m.p as [string, string];
    get(a).lf += m.s[0]!; get(a).la += m.s[1]!;
    get(b).lf += m.s[1]!; get(b).la += m.s[0]!;
    get(m.winner!).w++; get(m.loser!).l++;
  }
  const rows = [...seeds]
    .sort((a, b) => (data.places[a] ?? 999) - (data.places[b] ?? 999) || (stats[b]?.w ?? 0) - (stats[a]?.w ?? 0));
  if (!rows.length) return <p className="muted">A classificação aparece quando houver resultados.</p>;
  return (
    <div className="scroll-x" style={{ maxWidth: 760 }}>
      <table className="tbl">
        <thead><tr><th>Lugar</th><th>Jogador</th><th className="num">V</th><th className="num">D</th><th className="num">Legs</th><th className="num">Dif.</th></tr></thead>
        <tbody>
          {rows.map((p) => {
            const s = stats[p] ?? { w: 0, l: 0, lf: 0, la: 0 };
            const pl = data.places[p];
            return (
              <tr key={p} className={pl === 1 ? "first" : ""}>
                <td className="pos">{pl ? placeLabel(pl, data.structure) : <span className="muted small">em jogo</span>}</td>
                <td>{names[p] ?? "Jogador apagado"}</td>
                <td className="num">{s.w}</td><td className="num">{s.l}</td>
                <td className="num">{s.lf}–{s.la}</td><td className="num">{s.lf - s.la > 0 ? "+" : ""}{s.lf - s.la}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
