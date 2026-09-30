"use client";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { computeBracket, roundName } from "@/lib/bracket";
import { usePlayers, type ResultRow, type Tournament } from "@/lib/data";
import Bracket from "@/components/Bracket";
import { Champion, Fit, Jogos, TopBar, type Screen } from "@/components/Tv";


export default function TvPage() {
  return <Suspense fallback={null}><Tv /></Suspense>;
}

function Tv() {
  const { id } = useParams<{ id: string }>();
  const secs = Math.max(5, Number(useSearchParams().get("s")) || 20);
  const { players, reload: reloadPlayers } = usePlayers();
  const [t, setT] = useState<Tournament | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const newest = useRef<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: td }, { data: rd }] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", id).maybeSingle(),
      supabase.from("results").select("*").eq("tournament_id", id),
    ]);
    if (td) setT(td as Tournament);
    const rows = (rd as ResultRow[]) ?? [];
    setResults(rows);
    const latest = rows.reduce<ResultRow | null>((a, r) => (!a || r.updated_at! > a.updated_at! ? r : a), null);
    if (latest && newest.current && latest.updated_at! > newest.current) setFlash(latest.match_id);
    newest.current = latest?.updated_at ?? newest.current ?? "0";
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel(`tv-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "results" }, (p) => {
        const row = (p.new && "tournament_id" in p.new ? p.new : p.old) as Partial<ResultRow>;
        if (!row?.tournament_id || row.tournament_id === id) load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${id}` }, () => { load(); reloadPlayers(); })
      .subscribe();
    // Rede de segurança: se a ligação ao vivo cair, atualiza na mesma a cada minuto
    const poll = setInterval(load, 60000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [id, load, reloadPlayers]);

  useEffect(() => { const c = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(c); }, []);
  useEffect(() => { if (flash) { const f = setTimeout(() => setFlash(null), 8000); return () => clearTimeout(f); } }, [flash]);

  const names = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p.name])), [players]);
  const data = useMemo(() => (t && t.status !== "draft" && t.seeds.length >= (t.format === "double" ? 3 : 2)
    ? computeBracket(t.format, t.seeds, results) : null), [t, results]);

  const screens: Screen[] = useMemo(() => {
    if (!data) return [];
    const s: Screen[] = [];
    if (data.champion) s.push({ key: "champ", title: "Resultado final" });
    else s.push({ key: "jogos", title: "Jogos" });
    if (data.structure.format === "double" && data.structure.size >= 16) {
      s.push({ key: "W", title: "Quadro de vencedores" }, { key: "L", title: "Quadro de perdedores" });
    } else s.push({ key: "all", title: "Árvore" });
    return s;
  }, [data]);

  useEffect(() => {
    if (paused || screens.length < 2) return;
    const tm = setTimeout(() => setIdx((i) => (i + 1) % screens.length), secs * 1000);
    return () => clearTimeout(tm);
  }, [idx, paused, screens.length, secs]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % Math.max(1, screens.length));
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + screens.length) % Math.max(1, screens.length));
      if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
      if (e.key === "f") document.documentElement.requestFullscreen?.();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [screens.length]);

  if (!t) return <div className="tv"><div className="tv-center">A carregar…</div></div>;
  if (!data) return (
    <div className="tv"><TopBar name={t.name} now={now} />
      <div className="tv-center"><div className="tv-big">{t.name}</div><div className="tv-sub">A árvore aparece aqui quando o torneio começar.</div></div>
    </div>
  );

  const screen = screens[idx % screens.length];
  const flashMatch = flash ? data.byId[flash] : null;

  return (
    <div className="tv">
      <TopBar name={t.name} now={now} screens={screens} idx={idx % screens.length} paused={paused}
        onPick={(i) => setIdx(i)} onPause={() => setPaused((p) => !p)} />
      <div className="tv-body">
        {screen.key === "jogos" && <Jogos data={data} names={names} results={results} firstTo={t.first_to} />}
        {screen.key === "champ" && <Champion data={data} names={names} />}
        {(screen.key === "W" || screen.key === "L" || screen.key === "all") && (
          <Fit key={screen.key + results.length}>
            <div className="tv-sisal">
              <Bracket data={data} names={names} canEdit={false} bare section={screen.key === "all" ? undefined : (screen.key as "W" | "L")} />
            </div>
          </Fit>
        )}
      </div>
      {!paused && screens.length > 1 && <div className="tv-progress" key={`${idx}-${secs}`} style={{ animationDuration: `${secs}s` }} />}
      {flashMatch && flashMatch.status === "done" && (
        <div className="tv-flash" role="status">
          <div className="tv-flash-label">Jogo {flashMatch.num}, {roundName(data.structure, flashMatch)}</div>
          <div className="tv-flash-score">
            <span className={flashMatch.winner === flashMatch.p[0] ? "w" : ""}>{names[flashMatch.p[0]!]}</span>
            <b>{flashMatch.s[0]}–{flashMatch.s[1]}</b>
            <span className={flashMatch.winner === flashMatch.p[1] ? "w" : ""}>{names[flashMatch.p[1]!]}</span>
          </div>
        </div>
      )}
    </div>
  );
}

