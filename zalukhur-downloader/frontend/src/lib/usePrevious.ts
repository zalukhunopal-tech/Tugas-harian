import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { Geometry, PreviousScene } from "../types";

/** Kandidat citra sebelumnya (lebih lama, menutupi AOI, terdekat dulu). Hanya hasil permintaan terakhir dipakai. */
export function usePrevious(sceneId: string, aoi: Geometry, lookback: number, enabled: boolean) {
  const [cands, setCands] = useState<PreviousScene[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    api
      .previousScenes(sceneId, aoi, lookback)
      .then((r) => {
        if (mine !== seq.current) return;
        setCands(r.scenes);
        setMessage(r.message);
      })
      .catch((e: Error) => mine === seq.current && setError(e.message))
      .finally(() => mine === seq.current && setLoading(false));
  }, [enabled, sceneId, aoi, lookback]);

  return { cands, message, error, loading };
}
