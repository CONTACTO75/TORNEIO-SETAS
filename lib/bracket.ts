// Motor de chaves de eliminação simples e dupla.
// O estado da árvore é sempre recalculado a partir de: formato + ordem do sorteio + resultados.
// Assim, corrigir um resultado antigo faz tudo o que vem a seguir reajustar-se sozinho.

export type Format = "single" | "double";
export const BYE = "BYE";
export type Slot = string | null; // id do jogador, "BYE" ou null (ainda por definir)

export interface Result {
  match_id: string;
  p1: string;
  p2: string;
  s1: number;
  s2: number;
}

type Target = { match: string; slot: 0 | 1 } | null;

export interface MatchDef {
  id: string;
  section: "W" | "L" | "GF";
  round: number; // ronda dentro da secção (1..)
  index: number; // posição dentro da ronda (0..)
  num: number; // número do jogo, pela ordem natural de jogo
  winTo: Target;
  loseTo: Target;
  // De onde vem cada lugar (para mostrar "Perdedor J13" nos lugares ainda vazios)
  from: [string | null, string | null];
  fromLoser: [boolean, boolean];
}

export interface Match extends MatchDef {
  p: [Slot, Slot];
  s: [number | null, number | null];
  status: "pending" | "ready" | "done" | "bye" | "skip";
  winner: Slot;
  loser: Slot;
}

export interface Structure {
  format: Format;
  size: number; // tamanho da chave (potência de 2)
  rounds: number; // rondas da chave de vencedores
  matches: MatchDef[]; // já em ordem de jogo (dependências antes)
  byId: Record<string, MatchDef>;
}

export function bracketSize(players: number): number {
  let s = 2;
  while (s < players) s *= 2;
  return s;
}

/** Posições-padrão de cabeças de série: 1 v 16, 8 v 9, ... para os byes caírem espalhados. */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((x) => [x, n + 1 - x]);
  }
  return order;
}

export function lbCount(size: number, j: number) {
  return size / 2 ** (Math.ceil(j / 2) + 1);
}

/** Para onde vão os perdedores da ronda r da chave principal (cruzamento para evitar repetir jogos cedo). */
function crossover(i: number, count: number, r: number) {
  if (count <= 1) return 0;
  return r % 2 === 0 ? count - 1 - i : (i + count / 2) % count;
}

export function buildStructure(format: Format, playerCount: number): Structure {
  const minPlayers = format === "double" ? 3 : 2;
  const size = bracketSize(Math.max(playerCount, minPlayers));
  const k = Math.log2(size);
  const defs: Record<string, MatchDef> = {};
  const mk = (id: string, section: MatchDef["section"], round: number, index: number) =>
    (defs[id] = { id, section, round, index, num: 0, winTo: null, loseTo: null, from: [null, null], fromLoser: [false, false] });

  for (let r = 1; r <= k; r++)
    for (let i = 0; i < size / 2 ** r; i++) mk(`W${r}-${i}`, "W", r, i);

  if (format === "double") {
    for (let j = 1; j <= 2 * k - 2; j++)
      for (let i = 0; i < lbCount(size, j); i++) mk(`L${j}-${i}`, "L", j, i);
    mk("GF1", "GF", 1, 0);
    mk("GF2", "GF", 2, 0);
  }

  const link = (fromId: string, kind: "win" | "lose", to: string, slot: 0 | 1) => {
    const t = { match: to, slot };
    if (kind === "win") defs[fromId].winTo = t;
    else defs[fromId].loseTo = t;
    defs[to].from[slot] = fromId;
    defs[to].fromLoser[slot] = kind === "lose";
  };

  // Chave de vencedores
  for (let r = 1; r < k; r++)
    for (let i = 0; i < size / 2 ** r; i++)
      link(`W${r}-${i}`, "win", `W${r + 1}-${Math.floor(i / 2)}`, (i % 2) as 0 | 1);

  if (format === "double") {
    link(`W${k}-0`, "win", "GF1", 0);
    // Perdedores da ronda 1 emparelham entre si
    for (let i = 0; i < size / 2; i++)
      link(`W1-${i}`, "lose", `L1-${Math.floor(i / 2)}`, (i % 2) as 0 | 1);
    // Perdedores das rondas seguintes entram nas rondas pares da chave de perdedores
    for (let r = 2; r <= k; r++) {
      const c = size / 2 ** r;
      for (let i = 0; i < c; i++) link(`W${r}-${i}`, "lose", `L${2 * r - 2}-${crossover(i, c, r)}`, 1);
    }
    // Avanço dentro da chave de perdedores
    const last = 2 * k - 2;
    for (let j = 1; j < last; j++)
      for (let i = 0; i < lbCount(size, j); i++) {
        if (j % 2 === 1) link(`L${j}-${i}`, "win", `L${j + 1}-${i}`, 0);
        else link(`L${j}-${i}`, "win", `L${j + 1}-${Math.floor(i / 2)}`, (i % 2) as 0 | 1);
      }
    link(`L${last}-0`, "win", "GF1", 1);
  }

  // Ordem de jogo: W1, W2, L1, L2, W3, L3, L4, W4, ...
  const order: string[] = [];
  const pushW = (r: number) => { for (let i = 0; i < size / 2 ** r; i++) order.push(`W${r}-${i}`); };
  const pushL = (j: number) => { for (let i = 0; i < lbCount(size, j); i++) order.push(`L${j}-${i}`); };
  pushW(1);
  for (let r = 2; r <= k; r++) {
    pushW(r);
    if (format === "double") { pushL(2 * r - 3); pushL(2 * r - 2); }
  }
  if (format === "double") order.push("GF1", "GF2");

  const matches = order.map((id, n) => ({ ...defs[id], num: n + 1 }));
  const byId = Object.fromEntries(matches.map((m) => [m.id, m]));
  return { format, size, rounds: k, matches, byId };
}

export interface Computed {
  structure: Structure;
  matches: Match[];
  byId: Record<string, Match>;
  champion: string | null;
  staleResults: string[]; // resultados guardados que já não batem certo com os jogadores do jogo
  places: Record<string, number>; // jogador -> lugar final (1 = campeão)
}

export function isFinal(structure: Structure, matchId: string) {
  return structure.format === "double" ? matchId.startsWith("GF") : matchId === `W${structure.rounds}-0`;
}

export function computeBracket(format: Format, seeds: string[], results: Result[]): Computed {
  const st = buildStructure(format, seeds.length);
  const resById = Object.fromEntries(results.map((r) => [r.match_id, r]));
  const matches: Match[] = st.matches.map((d) => ({
    ...d, p: [null, null], s: [null, null], status: "pending", winner: null, loser: null,
  }));
  const byId = Object.fromEntries(matches.map((m) => [m.id, m]));

  const order = seedOrder(st.size);
  for (let i = 0; i < st.size / 2; i++) {
    const m = byId[`W1-${i}`];
    m.p = [order[2 * i], order[2 * i + 1]].map((s) => (s <= seeds.length ? seeds[s - 1] : BYE)) as [Slot, Slot];
  }

  const stale: string[] = [];
  let champion: string | null = null;

  for (const m of matches) {
    if (m.id === "GF2") {
      const g = byId.GF1;
      if (g.status === "done" && g.winner === g.p[1]) m.p = [g.p[0], g.p[1]];
      else if (g.status === "done" || g.status === "bye") { m.status = "skip"; if (resById.GF2) stale.push("GF2"); continue; }
    }
    const [a, b] = m.p;
    const r = resById[m.id];
    if (a === null || b === null) {
      m.status = "pending";
      if (r) stale.push(m.id);
    } else if (a === BYE || b === BYE) {
      m.status = "bye";
      m.winner = a === BYE ? b : a;
      m.loser = BYE;
      if (r) stale.push(m.id);
    } else if (r && ((r.p1 === a && r.p2 === b) || (r.p1 === b && r.p2 === a))) {
      m.s = r.p1 === a ? [r.s1, r.s2] : [r.s2, r.s1];
      m.status = "done";
      m.winner = m.s[0]! > m.s[1]! ? a : b;
      m.loser = m.winner === a ? b : a;
    } else {
      m.status = "ready";
      if (r) stale.push(m.id);
    }

    if (m.status === "done" || m.status === "bye") {
      if (m.winTo) byId[m.winTo.match].p[m.winTo.slot] = m.winner;
      if (m.loseTo) byId[m.loseTo.match].p[m.loseTo.slot] = m.loser;
      if (format === "single" && m.id === `W${st.rounds}-0`) champion = m.winner;
      if (m.id === "GF1" && m.winner === m.p[0]) champion = m.winner;
      if (m.id === "GF2") champion = m.winner;
    }
  }
  if (champion === BYE) champion = null;

  // Lugares finais
  const places: Record<string, number> = {};
  const setPlace = (pl: Slot, place: number) => { if (pl && pl !== BYE) places[pl] = place; };
  if (format === "single") {
    for (const m of matches)
      if (m.status === "done") setPlace(m.loser, st.size / 2 ** m.round + 1);
  } else {
    let eliminated = 0;
    const cum: number[] = [];
    for (let j = 1; j <= 2 * st.rounds - 2; j++) { eliminated += lbCount(st.size, j); cum[j] = eliminated; }
    for (const m of matches) {
      if (m.status !== "done") continue;
      if (m.section === "L") setPlace(m.loser, st.size - cum[m.round] + 1);
      if (m.id === "GF1" && m.winner === m.p[0]) setPlace(m.loser, 2);
      if (m.id === "GF2") setPlace(m.loser, 2);
    }
  }
  if (champion) places[champion] = 1;

  return { structure: st, matches, byId, champion, staleResults: stale, places };
}

/** Jogos que ficam anulados se este resultado mudar (para avisar antes de gravar). */
export function affectedBy(format: Format, seeds: string[], results: Result[], change: Result | { match_id: string; remove: true }) {
  const before = computeBracket(format, seeds, results);
  const next = results.filter((r) => r.match_id !== change.match_id);
  if (!("remove" in change)) next.push(change);
  const after = computeBracket(format, seeds, next);
  return before.matches
    .filter((m) => m.id !== change.match_id && m.status === "done" && after.byId[m.id].status !== "done")
    .map((m) => m.num);
}

export function roundName(st: Structure, m: MatchDef): string {
  if (m.section === "GF") return m.round === 1 ? "Grande final" : "Final (desempate)";
  if (m.section === "W") {
    const left = st.rounds - m.round;
    if (st.format === "single") {
      if (left === 0) return "Final";
      if (left === 1) return "Meias-finais";
      if (left === 2) return "Quartos de final";
      return `Ronda ${m.round}`;
    }
    if (left === 0) return "Final dos vencedores";
    return `Vencedores R${m.round}`;
  }
  const lastL = 2 * st.rounds - 2;
  if (m.round === lastL) return "Final dos perdedores";
  return `Perdedores R${m.round}`;
}

export function placeLabel(place: number, st: Structure): string {
  // lugares partilhados: ex. 5-6, 9-12
  const all = new Set<number>();
  if (st.format === "single") {
    all.add(1); all.add(2);
    for (let r = 1; r < st.rounds; r++) all.add(st.size / 2 ** r + 1);
  } else {
    all.add(1); all.add(2);
    let e = 0;
    for (let j = 1; j <= 2 * st.rounds - 2; j++) { e += lbCount(st.size, j); all.add(st.size - e + 1); }
  }
  const sorted = [...all].sort((a, b) => a - b);
  const i = sorted.indexOf(place);
  const end = i >= 0 && i < sorted.length - 1 ? sorted[i + 1] - 1 : st.size;
  return end > place ? `${place}.º–${end}.º` : `${place}.º`;
}

// ---------- Pontos de liga ----------
export type PointsRule = { from: number; points: number };
export const DEFAULT_POINTS: PointsRule[] = [
  { from: 1, points: 25 }, { from: 2, points: 18 }, { from: 3, points: 15 }, { from: 4, points: 12 },
  { from: 5, points: 10 }, { from: 7, points: 8 }, { from: 9, points: 6 }, { from: 13, points: 4 },
  { from: 17, points: 2 }, { from: 25, points: 1 },
];

export function pointsFor(place: number, rules: PointsRule[]): number {
  let pts = 0;
  for (const r of [...rules].sort((a, b) => a.from - b.from)) if (place >= r.from) pts = r.points;
  return pts;
}

export function parsePoints(text: string): PointsRule[] | null {
  const parts = text.split(/[;,\n]/).map((s) => s.trim()).filter(Boolean);
  const rules: PointsRule[] = [];
  for (const p of parts) {
    const m = p.match(/^(\d+)\s*[=:]\s*(\d+)$/);
    if (!m) return null;
    rules.push({ from: +m[1], points: +m[2] });
  }
  return rules.length ? rules.sort((a, b) => a.from - b.from) : null;
}

export function formatPoints(rules: PointsRule[]) {
  return rules.map((r) => `${r.from}=${r.points}`).join("; ");
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
