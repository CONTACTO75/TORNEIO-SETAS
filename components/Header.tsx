"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/data";

function Board() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
      <circle cx="14" cy="14" r="13" fill="#b8212c" />
      <circle cx="14" cy="14" r="10" fill="#f5f5f2" />
      <circle cx="14" cy="14" r="7" fill="#17583f" />
      <circle cx="14" cy="14" r="4" fill="#f5f5f2" />
      <circle cx="14" cy="14" r="1.8" fill="#b8212c" />
    </svg>
  );
}

export default function Header() {
  const path = usePathname();
  const router = useRouter();
  const { userId, isAdmin } = useAuth();
  const on = (p: string) => (p === "/" ? path === "/" || path.startsWith("/torneios") : path.startsWith(p)) ? "on" : "";
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <Link href="/" className="brand"><Board /><span>Torneios de Dardos</span></Link>
          <nav className="nav">
            <Link href="/" className={on("/")}>Torneios</Link>
            <Link href="/ligas" className={on("/ligas")}>Ligas</Link>
            <Link href="/jogadores" className={on("/jogadores")}>Jogadores</Link>
            <span className="spacer" />
            {userId ? (
              <button className="link" onClick={async () => { await supabase.auth.signOut(); router.push("/"); }}>
                Sair{isAdmin ? "" : " (sem permissões)"}
              </button>
            ) : (
              <Link href="/login" className={on("/login")}>Entrar</Link>
            )}
          </nav>
        </div>
      </header>
      {!isConfigured && (
        <div style={{ maxWidth: 1200, margin: "20px auto 0", padding: "0 20px" }}>
          <div className="notice">
            A ligação à base de dados não está configurada. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (ver README).
          </div>
        </div>
      )}
    </>
  );
}
