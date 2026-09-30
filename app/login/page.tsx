"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError("Email ou palavra-passe incorretos.");
    else router.push("/");
  };

  return (
    <div style={{ maxWidth: 400 }}>
      <h1 style={{ marginBottom: 8 }}>Entrar</h1>
      <p className="muted" style={{ marginTop: 0 }}>Só os organizadores precisam de entrar. Para ver as árvores e classificações não é preciso conta.</p>
      <form onSubmit={submit} className="panel" style={{ display: "grid", gap: 14 }}>
        {error && <div className="notice" style={{ margin: 0 }}>{error}</div>}
        <label className="field">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label className="field">Palavra-passe<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
        <button className="btn green" disabled={busy}>{busy ? "A entrar…" : "Entrar"}</button>
      </form>
    </div>
  );
}
