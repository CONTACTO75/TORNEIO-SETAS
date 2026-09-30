"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { computeBracket, formatPoints, parsePoints, placeLabel, pointsFor } from "@/lib/bracket";
import { fmtDate, statusLabel, useAuth, usePlayers, type ResultRow, type Season, type Tournament } from "@/lib/data";

export default function Liga() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { players } = usePlayers();
  const [season, setSeason] = useState<Season | null>(null);
  const [tours, setTours] = useState<Tournament[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [pointsText, setPointsText] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const { data: s } = await supabase.from("seasons").select("*").eq("id", id).maybeSingle();
    if (!s) return;
    setSeason(s as Season); setPointsText(formatPoints((s as Season).points));
    const { data: ts } = await supabase.from("tournaments").select("*").eq("season_id", id).order("date");
    setTours((ts as Tournament[]) ?? []);
    const ids = (ts ?? []).map((t) => t.id);
    if (ids.length) {
      const { data: rs } = await supabase.from("results").select("*").in("tournament_id", ids);
      setResults((rs as ResultRow[]) ?? []);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const names = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p.name])), [players]);

  const table = useMemo(() => {
    if (!season) return [];
    const acc: Record<string, { pts: number; played: number; wins: number; w: number; l: number; lf: number; la: number; per: Record<string, number | null> }> = {};
    const started = tours.filter((t) => t.status !== "draft");
    for (const t of started) {
      const c = computeBracket(t.format, t.seeds, results.filter((r) => r.tournament_id === t.id));
      for (const p of t.seeds) {
        const a = (acc[p] ??= { pts: 0, played: 0, wins: 0, w: 0, l: 0, lf: 0, la: 0, per: {} });
        a.played++;
        const pl = c.places[p];
        const pts = pl ? pointsFor(pl, season.points) : null;
        a.per[t.id] = pts;
        a.pts += pts ?? 0;
        if (pl === 1) a.wins++;
      }
      for (const m of c.matches) {
        if (m.status !== "done") continue;
        const [x, y] = m.p as [string, string];
        acc[x].lf += m.s[0]!; acc[x].la += m.s[1]!; acc[y].lf += m.s[1]!; acc[y].la += m.s[0]!;
        acc[m.winner!].w++; acc[m.loser!].l++;
      }
    }
    return Object.entries(acc).sort(([, a], [, b]) => b.pts - a.pts || b.wins - a.wins || (b.lf - b.la) - (a.lf - a.la));
  }, [season, tours, results]);

  if (!season) return <p className="muted">A carregar…</p>;
  const started = tours.filter((t) => t.status !== "draft");

  const savePoints = async () => {
    const rules = parsePoints(pointsText);
    if (!rules) { setMsg("Formato inválido. Use lugar=pontos separados por ponto e vírgula, ex.: 1=25; 2=18; 3=15"); return; }
    await supabase.from("seasons").update({ points: rules }).eq("id", id);
    setMsg("Pontuação guardada."); load();
  };

  return (
    <>
      <div className="page-head">
        <div><div className="muted"><Link href="/ligas">Ligas</Link></div><h1>{season.name}</h1></div>
        {isAdmin && <button className="btn ghost" onClick={async () => {
          if (!confirm("Apagar esta liga? Os torneios ficam, mas deixam de pertencer à liga.")) return;
          await supabase.from("seasons").delete().eq("id", id); router.push("/ligas");
        }}>Apagar liga</button>}
      </div>

      <h2 style={{ marginBottom: 12 }}>Classificação geral</h2>
      {table.length === 0 ? <div className="empty"><p className="muted">A classificação aparece quando a primeira jornada começar.</p></div> : (
        <div className="scroll-x" style={{ marginBottom: 40 }}>
          <table className="tbl">
            <thead><tr>
              <th>Pos.</th><th>Jogador</th><th className="num">Pontos</th><th className="num">Jornadas</th><th className="num">Vitórias</th>
              <th className="num">Jogos V–D</th><th className="num">Dif. legs</th>
              {started.map((t, i) => <th key={t.id} className="num" title={t.name}>J{i + 1}</th>)}
            </tr></thead>
            <tbody>
              {table.map(([p, a], i) => (
                <tr key={p} className={i === 0 ? "first" : ""}>
                  <td className="pos">{i + 1}</td><td>{names[p] ?? "Jogador apagado"}</td>
                  <td className="num"><strong>{a.pts}</strong></td><td className="num">{a.played}</td><td className="num">{a.wins}</td>
                  <td className="num">{a.w}–{a.l}</td><td className="num">{a.lf - a.la > 0 ? "+" : ""}{a.lf - a.la}</td>
                  {started.map((t) => <td key={t.id} className="num muted">{t.id in a.per ? (a.per[t.id] ?? "…") : "–"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Desempate: vitórias em jornadas, depois diferença de legs. «…» = ainda em jogo nessa jornada.</p>
        </div>
      )}

      <h2 style={{ marginBottom: 12 }}>Jornadas</h2>
      {tours.length === 0 ? <p className="muted">Ainda não há torneios nesta liga. Ao criar um torneio, escolha esta liga.</p> : (
        <div className="tlist" style={{ marginBottom: 40 }}>
          {tours.map((t, i) => {
            const c = t.status !== "draft" ? computeBracket(t.format, t.seeds, results.filter((r) => r.tournament_id === t.id)) : null;
            return (
              <Link key={t.id} href={`/torneios/${t.id}`} className="titem">
                <div className="tdate">Jornada {i + 1}</div>
                <div><div className="tname">{t.name}</div><div className="muted small">{fmtDate(t.date)}
                  {c?.champion ? `, venceu ${names[c.champion]}` : ""}</div></div>
                <span className={`badge ${t.status}`}>{statusLabel[t.status]}</span>
              </Link>
            );
          })}
        </div>
      )}

      <h2 style={{ marginBottom: 8 }}>Pontos por lugar</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Cada regra vale a partir desse lugar. Lugares partilhados (ex. {placeLabel(5, computeBracket("double", Array.from({ length: 16 }, (_, i) => `${i}`), []).structure)}) recebem os pontos do primeiro lugar do grupo.
      </p>
      {isAdmin ? (
        <div className="row" style={{ maxWidth: 760, flexWrap: "nowrap" }}>
          <input value={pointsText} onChange={(e) => setPointsText(e.target.value)} />
          <button className="btn green" onClick={savePoints} style={{ whiteSpace: "nowrap" }}>Guardar pontuação</button>
        </div>
      ) : <p>{pointsText}</p>}
      {msg && <p className="small">{msg}</p>}
    </>
  );
}
