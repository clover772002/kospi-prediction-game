"use client";

import { useEffect, useState } from "react";
import { getWeeklySurvivalBoard, type WeeklySurvivalBoardData } from "@/lib/api";

export function useWeeklySurvivalBoard(token: string | null) {
  const [board, setBoard] = useState<WeeklySurvivalBoardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setBoard(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const data = await getWeeklySurvivalBoard(token);
        if (!cancelled) setBoard(data);
      } catch {
        if (!cancelled) setBoard(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { board, loading };
}
