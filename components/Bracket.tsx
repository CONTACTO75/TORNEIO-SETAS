"use client";
import { BYE, roundName, type Computed, type Match } from "@/lib/bracket";

const W = 184, H = 52, COL = 240, SLOT = 68, PADL = 34, HEAD = 56, GAP = 70;

interface Props {
  data: Computed;
  names: Record<string, string>;
  canEdit: boolean;
  onPick?: (m: Match) => void;
}

export default function Bracket({ data, names, canEdit, onPick }: Props) {
  const { structure: st, byId } = data;
  const k = st.rounds;
  const pos: Record<string, { x: number; y: number }> = {};

  // Chave de vencedores
  for (let r = 1; r <= k; r++)
    for (let i = 0; i < st.size / 2 ** r; i++) {
      const y = r === 1 ? HEAD + i * SLOT : (pos[`W${r - 1}-${2 * i}`].y + pos[`W${r - 1}-${2 * i + 1}`].y) / 2;
      pos[`W${r}-${i}`] = { x: PADL + (r - 1) * COL, y };
    }
  const wbBottom = HEAD + (st.size / 2 - 1) * SLOT + H;
  let height = wbBottom;
  let width = PADL + k * COL;
  const lbTop = wbBottom + GAP;

  if (st.format === "double") {
    const last = 2 * k - 2;
    for (let j = 1; j <= last; j++) {
      const c = st.size / 2 ** (Math.ceil(j / 2) + 1);
      for (let i = 0; i < c; i++) {
        let y: number;
        if (j === 1) y = lbTop + HEAD + i * SLOT;
        else if (j % 2 === 0) y = pos[`L${j - 1}-${i}`].y;
        else y = (pos[`L${j - 1}-${2 * i}`].y + pos[`L${j - 1}-${2 * i + 1}`].y) / 2;
        pos[`L${j}-${i}`] = { x: PADL + (j - 1) * COL, y };
      }
    }
    const gx = PADL + Math.max(k, last) * COL;
    const gy = (pos[`W${k}-0`].y + pos[`L${last}-0`].y) / 2;
    pos.GF1 = { x: gx, y: gy };
    pos.GF2 = { x: gx + COL, y: gy };
    height = lbTop + HEAD + (st.size / 4 - 1) * SLOT + H;
    width = gx + 2 * COL + 60;
  } else {
    width += 60;
  }

  // Linhas de ligação (só para quem avança por vitória)
  const lines: string[] = [];
  for (const m of data.matches) {
    if (!m.winTo) continue;
    const a = pos[m.id], b = pos[m.winTo.match];
    const x1 = a.x + W, y1 = a.y + H / 2;
    const x2 = b.x, y2 = b.y + (m.winTo.slot === 0 ? H / 4 : (3 * H) / 4);
    const mx = x2 - 22;
    lines.push(`M${x1},${y1} H${mx} V${y2} H${x2}`);
  }
  if (st.format === "double" && byId.GF2.status !== "skip") {
    const a = pos.GF1, b = pos.GF2;
    lines.push(`M${a.x + W},${a.y + H / 2} H${b.x}`);
  }

  const label = (m: Match, s: 0 | 1) => {
    const p = m.p[s];
    if (p === BYE) return { text: "bye", tbd: true };
    if (p) return { text: names[p] ?? "Jogador apagado", tbd: false };
    if (m.id === "GF2") return { text: "Só se necessário", tbd: true };
    const f = m.from[s];
    if (!f) return { text: "", tbd: true };
    const num = st.byId[f].num;
    return { text: `${m.fromLoser[s] ? "Perdedor" : "Vencedor"} do J${num}`, tbd: true };
  };

  // Títulos das rondas
  const titles: { x: number; y: number; t: string }[] = [];
  const seen = new Set<string>();
  for (const m of data.matches) {
    const key = `${m.section}${m.round}`;
    if (seen.has(key) || m.section === "GF") continue;
    seen.add(key);
    titles.push({ x: pos[m.id].x, y: m.section === "W" ? 30 : lbTop + 30, t: roundName(st, m) });
  }
  if (st.format === "double") {
    titles.push({ x: pos.GF1.x, y: pos.GF1.y - 24, t: "Grande final" });
    if (byId.GF2.status !== "skip") titles.push({ x: pos.GF2.x, y: pos.GF2.y - 24, t: "Desempate" });
  }

  const final = st.format === "double" ? (byId.GF2.status === "done" ? pos.GF2 : pos.GF1) : pos[`W${k}-0`];

  return (
    <div className="bracket-wrap">
      <div className="bracket" style={{ width, height }}>
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }} aria-hidden>
          {lines.map((d, i) => <path key={i} d={d} fill="none" stroke="#6f7772" strokeWidth={1.4} />)}
        </svg>
        {st.format === "double" && <>
          <div className="bsec-title" style={{ left: PADL, top: 0 }}>Quadro de vencedores</div>
          <div className="bsec-title" style={{ left: PADL, top: lbTop }}>Quadro de perdedores</div>
        </>}
        {titles.map((t, i) => <div key={i} className="rtitle" style={{ left: t.x, top: t.y }}>{t.t}</div>)}
        {data.matches.map((m) => {
          if (m.id === "GF2" && m.status === "skip") return null;
          const p = pos[m.id];
          const clickable = canEdit && (m.status === "ready" || m.status === "done");
          const Tag = clickable ? "button" : "div";
          return (
            <Tag key={m.id} className={`mbox ${m.status}`} style={{ left: p.x, top: p.y, height: H }}
              onClick={clickable ? () => onPick?.(m) : undefined}
              aria-label={clickable ? `Jogo ${m.num}: introduzir resultado` : undefined}>
              <span className="mnum">{m.num}</span>
              {([0, 1] as const).map((s) => {
                const l = label(m, s);
                const win = m.status === "done" && m.winner === m.p[s];
                return (
                  <div key={s} className={`mrow ${win ? "win" : ""}`}>
                    <span className={`mname ${l.tbd ? "tbd" : ""}`}>{l.text}</span>
                    <span className="mscore">{m.s[s] ?? ""}</span>
                  </div>
                );
              })}
            </Tag>
          );
        })}
        {data.champion && (
          <div className="champ" style={{ left: final.x + W + 24, top: final.y + H / 2 - 30 }}>
            <small>Campeão</small>{names[data.champion]}
          </div>
        )}
      </div>
    </div>
  );
}
