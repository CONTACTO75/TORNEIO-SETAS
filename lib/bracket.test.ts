import { computeBracket, Result, BYE, Format, affectedBy } from "./bracket";

function simulate(format: Format, n: number, seed: number) {
  let x = seed;
  const rnd = () => ((x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const players = Array.from({ length: n }, (_, i) => `P${i + 1}`);
  const results: Result[] = [];
  for (let guard = 0; guard < 500; guard++) {
    const c = computeBracket(format, players, results);
    const ready = c.matches.find((m) => m.status === "ready");
    if (!ready) {
      if (!c.champion) throw new Error(`${format} ${n}: sem campeão`);
      // validações
      const losses: Record<string, number> = {};
      for (const m of c.matches) if (m.status === "done") losses[m.loser!] = (losses[m.loser!] || 0) + 1;
      for (const p of players) {
        const l = losses[p] || 0;
        const max = format === "double" ? 2 : 1;
        if (p !== c.champion && l !== max) {

          throw new Error(`${format} ${n}: ${p} tem ${l} derrotas`);
        }
        if (c.places[p] === undefined) throw new Error(`${format} ${n}: ${p} sem lugar`);
      }
      if (c.places[c.champion] !== 1) throw new Error("campeão sem lugar 1");
      return c;
    }
    const w = rnd() < 0.5;
    results.push({ match_id: ready.id, p1: ready.p[0]!, p2: ready.p[1]!, s1: w ? 3 : 1, s2: w ? 2 : 3 });
  }
  throw new Error("loop");
}

let ok = 0;
for (const f of ["single", "double"] as Format[])
  for (let n = f === "double" ? 3 : 2; n <= 64; n++)
    for (let s = 1; s <= 25; s++) { simulate(f, n, s * 7919 + n); ok++; }
console.log("simulações OK:", ok);

// byes nunca se enfrentam na ronda 1
for (let n = 3; n <= 64; n++) {
  const c = computeBracket("double", Array.from({ length: n }, (_, i) => `P${i}`), []);
  for (const m of c.matches.filter((m) => m.id.startsWith("W1-")))
    if (m.p[0] === BYE && m.p[1] === BYE) throw new Error("BYE v BYE na R1 " + n);
}
console.log("byes OK");

// corrigir resultado anula dependentes
const pl = Array.from({ length: 8 }, (_, i) => `P${i + 1}`);
const c0 = computeBracket("double", pl, []);
const m1 = c0.byId["W1-0"];
const res: Result[] = [{ match_id: "W1-0", p1: m1.p[0]!, p2: m1.p[1]!, s1: 3, s2: 0 }];
const m2 = c0.byId["W1-1"];
res.push({ match_id: "W1-1", p1: m2.p[0]!, p2: m2.p[1]!, s1: 3, s2: 0 });
const c1 = computeBracket("double", pl, res);
const n = c1.byId["W2-0"];
res.push({ match_id: "W2-0", p1: n.p[0]!, p2: n.p[1]!, s1: 3, s2: 1 });
const aff = affectedBy("double", pl, res, { match_id: "W1-0", p1: m1.p[0]!, p2: m1.p[1]!, s1: 0, s2: 3 });
console.log("jogos afetados ao inverter J1:", aff);
const c16 = computeBracket("double", Array.from({ length: 16 }, (_, i) => `P${i}`), []);
console.log("16 jogadores: jogos", c16.matches.length, "| ex. perdedores W2 ->", ["W2-0","W2-1","W2-2","W2-3"].map(id => c16.byId[id].loseTo!.match).join(","));
