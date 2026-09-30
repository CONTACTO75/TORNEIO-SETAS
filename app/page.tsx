"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtDate, statusLabel, useAuth, type Tournament } from "@/lib/data";

export default function Home() {
  const { isAdmin } = useAuth();
  const [list, setList] = useState<(Tournament & { seasons: { name: string } | null })[] | null>(null);

  useEffect(() => {
    supabase.from("tournaments").select("*, seasons(name)").order("date", { ascending: false }).order("created_at", { ascending: false })
      .then(({ data }) => setList((data as never) ?? []));
  }, []);

  const running = list?.filter((t) => t.status === "running") ?? [];
  const others = list?.filter((t) => t.status !== "running") ?? [];

  const Item = ({ t }: { t: (typeof others)[number] }) => (
    <Link href={`/torneios/${t.id}`} className="titem">
      <div className="tdate">{fmtDate(t.date)}</div>
      <div>
        <div className="tname">{t.name}</div>
        <div className="muted small">
          {t.format === "double" ? "Eliminação dupla" : "Eliminação simples"}, {t.seeds.length} jogadores
          {t.seasons ? `, ${t.seasons.name}` : ""}
        </div>
      </div>
      <span className={`badge ${t.status}`}>{statusLabel[t.status]}</span>
    </Link>
  );

  return (
    <>
      <div className="page-head">
        <h1>Torneios</h1>
        {isAdmin && <Link href="/torneios/novo" className="btn green">Criar torneio</Link>}
      </div>
      {list === null ? <p className="muted">A carregar…</p> : list.length === 0 ? (
        <div className="empty">
          <p>Ainda não há torneios.</p>
          {isAdmin ? <Link href="/torneios/novo" className="btn green">Criar o primeiro torneio</Link>
            : <p className="muted small">Os organizadores podem criar torneios depois de entrar.</p>}
        </div>
      ) : (
        <>
          {running.length > 0 && (
            <section style={{ marginBottom: 36 }}>
              <h2 style={{ marginBottom: 10 }}>A decorrer</h2>
              <div className="tlist">{running.map((t) => <Item key={t.id} t={t} />)}</div>
            </section>
          )}
          {others.length > 0 && (
            <section>
              {running.length > 0 && <h2 style={{ marginBottom: 10 }}>Outros torneios</h2>}
              <div className="tlist">{others.map((t) => <Item key={t.id} t={t} />)}</div>
            </section>
          )}
        </>
      )}
    </>
  );
}
