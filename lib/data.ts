"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Format, PointsRule, Result } from "./bracket";

export interface Player { id: string; name: string }
export interface Season { id: string; name: string; points: PointsRule[] }
export interface Tournament {
  id: string; name: string; date: string; format: Format;
  first_to: number; first_to_final: number;
  status: "draft" | "running" | "finished";
  season_id: string | null; seeds: string[];
}
export type ResultRow = Result & { tournament_id: string; updated_at?: string };

export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const check = async (uid: string | null) => {
      setUserId(uid);
      if (!uid) { setIsAdmin(false); setReady(true); return; }
      const { data } = await supabase.from("admins").select("user_id").eq("user_id", uid).maybeSingle();
      setIsAdmin(Boolean(data));
      setReady(true);
    };
    supabase.auth.getSession().then(({ data }) => check(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { check(s?.user.id ?? null); });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { userId, isAdmin, ready };
}

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    const { data } = await supabase.from("players").select("id,name").order("name");
    setPlayers(data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { players, loading, reload };
}

export function useSeasons() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const reload = useCallback(async () => {
    const { data } = await supabase.from("seasons").select("id,name,points").order("created_at", { ascending: false });
    setSeasons(data ?? []);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { seasons, reload };
}

export const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });

export const statusLabel = { draft: "Em preparação", running: "A decorrer", finished: "Terminado" } as const;
