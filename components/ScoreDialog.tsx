"use client";
import { useState } from "react";
import type { Match } from "@/lib/bracket";

interface Props {
  match: Match;
  title: string;
  firstTo: number;
  names: Record<string, string>;
  warn: (s1: number | null, s2: number | null) => number[];
  onSave: (s1: number, s2: number) => Promise<void>;
  onClear: () => Promise<void>;
  onClose: () => void;
}

export default function ScoreDialog({ match, title, firstTo, names, warn, onSave, onClear, onClose }: Props) {
  const [s1, setS1] = useState<string>(match.s[0]?.toString() ?? "");
  const [s2, setS2] = useState<string>(match.s[1]?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const n1 = names[match.p[0]!], n2 = names[match.p[1]!];
  const a = s1 === "" ? null : +s1, b = s2 === "" ? null : +s2;

  let error = "";
  if (a !== null && b !== null) {
    if (a === b) error = "Não pode haver empate.";
    else if (Math.max(a, b) !== firstTo) error = `O vencedor tem de ter ${firstTo} legs.`;
  }
  const valid = a !== null && b !== null && !error;
  const affected = valid ? warn(a, b) : [];

  const quick: [number, number][] = [];
  for (let x = 0; x < firstTo; x++) quick.push([firstTo, x]);
  for (let x = firstTo - 1; x >= 0; x--) quick.push([x, firstTo]);

  const save = async (x: number, y: number) => {
    const aff = warn(x, y);
    if (aff.length && !confirm(`Isto anula os resultados dos jogos ${aff.join(", ")}, que dependem deste. Continuar?`)) return;
    setBusy(true);
    await onSave(x, y);
    setBusy(false);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <h2>Jogo {match.num}</h2>
        <div className="muted small">{title}, primeiro a {firstTo} legs</div>
        <div className="score-grid">
          <span className="pname">{n1}</span>
          <input inputMode="numeric" type="number" min={0} max={firstTo} value={s1} onChange={(e) => setS1(e.target.value)} aria-label={`Legs de ${n1}`} autoFocus />
          <span className="pname">{n2}</span>
          <input inputMode="numeric" type="number" min={0} max={firstTo} value={s2} onChange={(e) => setS2(e.target.value)} aria-label={`Legs de ${n2}`} />
        </div>
        <div className="small muted" style={{ marginBottom: 6 }}>Resultado rápido</div>
        <div className="quick">
          {quick.map(([x, y]) => (
            <button key={`${x}-${y}`} className={x > y ? "p1" : "p2"} disabled={busy} onClick={() => save(x, y)}
              title={`${x > y ? n1 : n2} ganha ${Math.max(x, y)}-${Math.min(x, y)}`}>{x}-{y}</button>
          ))}
        </div>
        {error && <div className="notice" style={{ marginBottom: 14 }}>{error}</div>}
        {affected.length > 0 && <div className="notice" style={{ marginBottom: 14 }}>Ao gravar, os resultados dos jogos {affected.join(", ")} deixam de valer.</div>}
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row">
            <button className="btn green" disabled={!valid || busy} onClick={() => save(a!, b!)}>Gravar resultado</button>
            <button className="btn ghost" onClick={onClose}>Cancelar</button>
          </div>
          {match.status === "done" && (
            <button className="btn ghost" disabled={busy} onClick={async () => {
              const aff = warn(null, null);
              if (!confirm(aff.length ? `Apagar este resultado anula também os jogos ${aff.join(", ")}. Continuar?` : "Apagar este resultado?")) return;
              setBusy(true); await onClear(); setBusy(false);
            }}>Apagar resultado</button>
          )}
        </div>
      </div>
    </div>
  );
}
