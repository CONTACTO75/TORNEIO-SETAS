"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { placeLabel, roundName, type Computed } from "@/lib/bracket";
import { BYE, placeLabel, roundName, type Computed } from "@/lib/bracket";

export type Screen = { key: string; title: string };

export function TopBar({ name, now, screens, idx, paused, onPick, onPause }: {
  name: string; now: Date; screens?: Screen[]; idx?: number; paused?: boolean;
  onPick?: (i: number) => void; onPause?: () => void;
}) {
  return (
    <header className="tv-top">
      <div className="tv-name">{name}</div>
      <nav className="tv-screens">
        {screens?.map((s, i) => (
          <button key={s.key} className={i === idx ? "on" : ""} onClick={() => onPick?.(i)}>{s.title}</button>
        ))}
        {screens && screens.length > 1 && <button className="tv-ctl" onClick={onPause}>{paused ? "Retomar rotação" : "Pausar"}</button>}
        <button className="tv-ctl" onClick={() => document.documentElement.requestFullscreen?.()}>Ecrã inteiro</button>
      </nav>
      <div className="tv-clock">{now.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</div>
    </header>
  );
}

export function Jogos({ data, names, results, firstTo }: { data: Computed; names: Record<string, string>; results: ResultRow[]; firstTo: number }) {
  const ready = data.matches.filter((m) => m.status === "ready");
  const latest = [...results].sort((a, b) => (b.updated_at! > a.updated_at! ? 1 : -1))
    .map((r) => data.byId[r.match_id]).filter((m) => m && m.status === "done").slice(0, 7);
    const upcoming = data.matches.filter((m) => m.status === "pending" && (m.p[0] || m.p[1]) && m.p[0] !== BYE && m.p[1] !== BYE && m.id !== "GF2").slice(0, 4);
  return (
    <div className="tv-jogos">
      <section>
        <h2 className="tv-h">Ao alvo</h2>
        {ready.length === 0 ? <div className="tv-sub">Sem jogos prontos. A aguardar resultados.</div> : (
          <ol className="tv-ready">
            {ready.slice(0, 8).map((m) => (
              <li key={m.id}>
                <span className="tv-num">{m.num}</span>
                <span className="tv-players"><span>{names[m.p[0]!]}</span><em>contra</em><span>{names[m.p[1]!]}</span></span>
                <span className="tv-round">{roundName(data.structure, m)}</span>
              </li>
            ))}
            {ready.length > 8 && <li className="tv-more">e mais {ready.length - 8} jogos</li>}
          </ol>
        )}
        {upcoming.length > 0 && <>
          <h3 className="tv-h3">A seguir</h3>
          <ul className="tv-next">
            {upcoming.map((m) => {
              const other = (s: 0 | 1) => m.p[s] ? names[m.p[s]!] ?? "?" : `${m.fromLoser[s] ? "perdedor" : "vencedor"} do J${data.structure.byId[m.from[s]!].num}`;
              return <li key={m.id}><b>{m.num}</b> {other(0)} contra {other(1)}</li>;
            })}
          </ul>
        </>}
      </section>
      <section className="tv-side">
        <h2 className="tv-h">Últimos resultados</h2>
        {latest.length === 0 ? <div className="tv-sub">Ainda sem resultados. Jogos à melhor de {firstTo * 2 - 1} legs.</div> : (
          <ul className="tv-results">
            {latest.map((m) => (
              <li key={m.id}>
                <span className={m.winner === m.p[0] ? "w" : ""}>{names[m.p[0]!]}</span>
                <b>{m.s[0]}–{m.s[1]}</b>
                <span className={m.winner === m.p[1] ? "w" : ""}>{names[m.p[1]!]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function Champion({ data, names }: { data: Computed; names: Record<string, string> }) {
  const ranked = Object.entries(data.places).sort((a, b) => a[1] - b[1]).slice(0, 8);
  return (
    <div className="tv-champ">
      <div>
        <div className="tv-sub">Campeão</div>
        <div className="tv-champ-name">{names[data.champion!]}</div>
      </div>
      <ol className="tv-podium">
        {ranked.slice(1).map(([p, pl]) => (
          <li key={p}><span>{placeLabel(pl, data.structure)}</span>{names[p]}</li>
        ))}
      </ol>
    </div>
  );
}

/** Escala o conteúdo para caber inteiro no espaço disponível */
export function Fit({ children }: { children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => {
      if (!outer.current || !inner.current) return;
      const w = inner.current.offsetWidth, h = inner.current.offsetHeight;
      const W = outer.current.clientWidth, H = outer.current.clientHeight;
      setScale(Math.min(W / w, H / h, 1.6));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (outer.current) ro.observe(outer.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer} className="tv-fit">
      <div ref={inner} style={{ position: "absolute", left: "50%", top: "50%", width: "max-content", transform: `translate(-50%, -50%) scale(${scale})` }}>{children}</div>
    </div>
  );
}
