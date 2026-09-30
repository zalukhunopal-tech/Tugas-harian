import { useEffect, useRef, useState } from "react";
import { api } from "../api";

interface Place {
  name: string;
  lat: number;
  lon: number;
  bbox: [number, number, number, number] | null;
}

export default function GeocodeBox({ onPick }: { onPick: (bbox: [number, number, number, number]) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Place[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (q.trim().length < 3) {
      setItems([]);
      setMsg(null);
      return;
    }
    const mine = ++seq.current;
    const t = window.setTimeout(async () => {
      try {
        const r = await api.geocode(q.trim());
        if (mine !== seq.current) return; // hasil basi
        setItems(r);
        setMsg(r.length ? null : "Lokasi tidak ditemukan.");
        setOpen(true);
      } catch (e) {
        if (mine === seq.current) setMsg((e as Error).message);
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [q]);

  const pick = (p: Place) => {
    const d = 0.02;
    onPick(p.bbox ?? [p.lon - d, p.lat - d, p.lon + d, p.lat + d]);
    setOpen(false);
  };

  return (
    <div className="geocode">
      <input
        type="search"
        placeholder="Cari lokasi…"
        aria-label="Cari lokasi"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Enter" && items[0] && pick(items[0])}
      />
      {open && (items.length > 0 || msg) && (
        <ul className="geo-results">
          {msg && <li className="muted">{msg}</li>}
          {items.map((p, i) => (
            <li key={i}>
              <button type="button" onClick={() => pick(p)}>
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
